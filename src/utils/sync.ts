/**
 * المزامنة السحابية وقواعد أمان Firestore
 * تنبيه لقواعد الأمان:
 * 1. مستند المريض يجب أن يتضمن caregiverUids: [] عند الإنشاء وإلا يُرفض.
 * 2. المرافق يربط نفسه عبر updateDoc مباشر مع arrayUnion بدون getDoc مسبق.
 * 3. المزامنة تنظف الكائنات من أي undefined قبل الإرسال.
 */
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  deleteField,
  runTransaction,
  collection,
  query,
  where,
  limit,
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import {
  UserProfile,
  PatientDocument,
  Medication,
  DoseLog,
  VitalMeasurement,
  DailyReminder,
  WaterReminderConfig,
  PatientAlert,
  DeletedTombstones,
} from '../types';
import { formatDateYMD, parseDoseKey, pruneTombstones } from './storage';

const MAX_ALERTS = 50;

/**
 * إضافة تنبيه جديد إلى قائمة التنبيهات بترتيب أقدم ← أحدث (كما تتوقع واجهة المرافق)
 * مع الاحتفاظ بآخر 50 فقط. الفرز بالوقت يصحّح أي مستند قديم مخلوط الترتيب.
 */
function appendAlert(existing: unknown, alert: PatientAlert): PatientAlert[] {
  const list: PatientAlert[] = Array.isArray(existing) ? (existing as PatientAlert[]) : [];
  return [...list, alert]
    .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''))
    .slice(-MAX_ALERTS);
}

/**
 * البحث عن مستند مريض سابق يخص هذا الحساب (لإعادة استخدام كود الربط بدل توليد كود جديد)
 */
export async function findPatientCodeByUid(uid: string): Promise<string | null> {
  try {
    const q = query(collection(db, 'patients'), where('patientUid', '==', uid), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;
  } catch (err) {
    console.warn('Could not look up existing patient document:', err);
  }
  return null;
}

/**
 * تنظيف الكائنات التكراري من أي حقول undefined لتجنب أخطاء Firestore
 */
export function cleanForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => cleanForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (value !== undefined) {
        result[key] = cleanForFirestore(value);
      }
    }
    return result as T;
  }
  return data;
}

/**
 * توليد معرّف عشوائي آمن للتنبيهات
 */
function generateAlertId(): string {
  const arr = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 6; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `alert_${Date.now()}_${hex}`;
}

/**
 * جلب الملف الشخصي للمستخدم من Firestore (users/{uid})
 * يفرّق بين عدم وجود المستند وبين خطأ الشبكة
 */
export async function getUserProfileFromCloud(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return snap.data() as UserProfile;
  }
  return null;
}

/**
 * حفظ أو تحديث ملف المستخدم في users/{uid}
 */
export async function saveUserProfileToCloud(profile: UserProfile): Promise<void> {
  try {
    const userRef = doc(db, 'users', profile.uid);
    const cleanData = cleanForFirestore(profile);
    await setDoc(userRef, cleanData, { merge: true });
  } catch (err) {
    console.error('Failed to save user profile to cloud:', err);
    throw err;
  }
}

/**
 * إنشاء مستند المريض الأولي عند تسجيل حساب مريض جديد
 * ⚠️ شرط حرج: caregiverUids: [] إلزامي في البداية حتى تقبل قواعد الأمان
 */
export async function initializePatientCloudDocument(
  pairingCode: string,
  patientUid: string,
  patientName: string
): Promise<void> {
  try {
    const patientRef = doc(db, 'patients', pairingCode);
    const initialDoc: PatientDocument = {
      patientUid,
      patientName,
      caregiverUids: [], // إلزامي عند الإنشاء
      state: {
        medications: [],
        doseLogs: {},
        vitals: [],
        reminders: [],
        water: {
          enabled: true,
          dailyGoalMl: 2000,
          glassSizeMl: 250,
          drunkTodayMl: 0,
          lastLogDate: formatDateYMD(),
          intervalMinutes: 60,
          startTime: '08:00',
          endTime: '22:00',
        },
        lastUpdated: new Date().toISOString(),
      },
      alerts: [],
    };
    const cleanDoc = cleanForFirestore(initialDoc);
    await setDoc(patientRef, cleanDoc, { merge: true });
  } catch (err) {
    console.error('Failed to initialize patient document:', err);
    throw err;
  }
}

/**
 * سحب حالة المريض من السحابة لدمجها محلياً
 */
export async function pullPatientStateFromCloud(
  pairingCode: string
): Promise<PatientDocument['state'] | null> {
  if (!pairingCode) return null;
  try {
    const patientRef = doc(db, 'patients', pairingCode);
    const snap = await getDoc(patientRef);
    if (snap.exists()) {
      const data = snap.data() as PatientDocument;
      return data.state || null;
    }
    return null;
  } catch (err) {
    console.error('Failed to pull patient state from cloud:', err);
    throw err;
  }
}

/**
 * مزامنة حالة المريض من التخزين المحلي إلى Firestore
 * - استبعاد الأدوية التجريبية (isExample)
 * - اقتصار doseLogs على آخر 60 يوماً فقط
 * - اقتصار القياسات vitals على آخر 200 قياس
 * - تنظيف أي undefined قبل الإرسال
 */
export interface SyncPatientOptions {
  patientUid?: string;
  patientName?: string;
  allowEditMeds?: boolean;
  newAlert?: PatientAlert;
}

export async function syncPatientStateToCloud(
  pairingCode: string,
  state: {
    medications: Medication[];
    doseLogs: Record<string, DoseLog>;
    vitals: VitalMeasurement[];
    reminders: DailyReminder[];
    water: WaterReminderConfig;
    deleted?: DeletedTombstones;
  },
  options?: SyncPatientOptions
): Promise<void> {
  if (!pairingCode) return;

  // 1. استبعاد أدوية الأمثلة التجريبية تماماً من المزامنة
  const realMeds = (state.medications || []).filter(
    (m) => !m.isExample && !m.id.startsWith('med_sample_')
  );

  // 2. تقليص doseLogs لاقتصارها على آخر 60 يوماً باستخدام parseDoseKey بدقة
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 60);
  const cutoffStr = formatDateYMD(cutoffDate);

  const prunedLogs: Record<string, DoseLog> = {};
  for (const [key, log] of Object.entries(state.doseLogs || {})) {
    const parsed = parseDoseKey(key);
    const logDate = parsed ? parsed.date : null;
    // إذا كان التاريخ يقع ضمن آخر 60 يوماً أو لم نتمكن من تحليله نحتفظ به
    if (!logDate || logDate >= cutoffStr) {
      prunedLogs[key] = log;
    }
  }

  // 3. اقتصار القياسات على آخر 200 قياس في السحابة مع استبعاد بيانات العينة
  const realVitals = (state.vitals || [])
    .filter((v) => !v.id.startsWith('vit_sample_'))
    .slice(0, 200);

  // 4. استبعاد التذكيرات التجريبية الافتراضية ما لم يعدّلها المستخدم
  const realReminders = (state.reminders || []).filter((r) => {
    if (r.id === 'rem_walk' || r.id === 'rem_bp') {
      return Boolean(r.updatedAt);
    }
    return true;
  });

  const patientRef = doc(db, 'patients', pairingCode);
  const updates: Record<string, unknown> = {
    'state.medications': realMeds,
    'state.doseLogs': prunedLogs,
    'state.vitals': realVitals,
    'state.reminders': realReminders,
    'state.water': state.water,
    'state.deleted': pruneTombstones(state.deleted || { medications: {}, vitals: {} }),
    'state.lastUpdated': new Date().toISOString(),
  };

  if (typeof options?.allowEditMeds === 'boolean') {
    updates['allowEditMeds'] = options.allowEditMeds;
  }

  const cleanUpdates = cleanForFirestore(updates);

  try {
    await updateDoc(patientRef, cleanUpdates);
  } catch (err: unknown) {
    const errCode = (err as { code?: string })?.code;
    const errMsg = (err as Error)?.message || '';
    // في حال عدم وجود المستند (not-found)، نهيئه ثم نعيد المحاولة مرة واحدة
    if (errCode === 'not-found' || errMsg.includes('NOT_FOUND') || errMsg.includes('No document to update')) {
      const currentUid = options?.patientUid || auth.currentUser?.uid || '';
      const currentName = options?.patientName || auth.currentUser?.displayName || 'المريض';
      await initializePatientCloudDocument(pairingCode, currentUid, currentName);
      await updateDoc(patientRef, cleanUpdates);
    } else {
      throw err;
    }
  }

  if (options?.newAlert) {
    await pushPatientAlert(pairingCode, options.newAlert);
  }
}

/**
 * إرسال تنبيه فوري للمرافقين في مستند المريض مع قص المصفوفة لآخر 50 تنبيه
 */
export async function pushPatientAlert(pairingCode: string, alert: PatientAlert): Promise<void> {
  if (!pairingCode) return;
  try {
    const patientRef = doc(db, 'patients', pairingCode);
    const cleanAlert = cleanForFirestore(alert);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(patientRef);
      if (!snap.exists()) return;
      const data = snap.data() as PatientDocument;
      tx.update(patientRef, { alerts: appendAlert(data.alerts, cleanAlert) });
    });
  } catch (err) {
    console.warn('Failed to push patient alert:', err);
  }
}

/**
 * تسجيل وتحديث حالة الجرعة مع إرسال تنبيه حي للمرافق وقص التنبيهات لآخر 50
 */
export async function recordDoseInCloud(
  pairingCode: string,
  doseKey: string,
  log: DoseLog,
  medName: string,
  doseAmount: number,
  form: string,
  timeStr: string,
  patientName?: string
): Promise<void> {
  if (!pairingCode) return;
  try {
    const parsedKey = parseDoseKey(doseKey);
    const medId = parsedKey?.medId || doseKey;
    const finalTimeStr = timeStr || parsedKey?.time || 'الموعد';

    const patientRef = doc(db, 'patients', pairingCode);
    const alertType =
      log.status === 'taken' ? 'taken' : log.status === 'skipped' ? 'skipped' : 'delayed';
    const title =
      log.status === 'taken'
        ? `✅ تم أخذ دواء ${medName}`
        : log.status === 'skipped'
        ? `⚠️ تم تخطي دواء ${medName}`
        : `⏰ تم تأجيل دواء ${medName}`;

    const body = `${patientName || 'المريض'} — موعد ${finalTimeStr} — الجرعة: ${doseAmount} ${form}`;

    const newAlert: PatientAlert = {
      id: generateAlertId(),
      type: alertType,
      title,
      body,
      timestamp: new Date().toISOString(),
      medId,
    };

    const cleanLog = cleanForFirestore(log);
    const cleanAlert = cleanForFirestore(newAlert);

    // معاملة (Transaction) لقراءة التنبيهات وكتابتها معاً دون فقد تنبيه عند جرعتين متتاليتين.
    // لو فشلت (مثلاً بدون إنترنت) فالمزامنة الكاملة لاحقاً ترفع سجل الجرعة نفسه.
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(patientRef);
      if (!snap.exists()) return;
      const data = snap.data() as PatientDocument;
      tx.update(patientRef, {
        [`state.doseLogs.${doseKey}`]: cleanLog,
        'state.lastUpdated': new Date().toISOString(),
        alerts: appendAlert(data.alerts, cleanAlert),
      });
    });
  } catch (err) {
    console.error('Failed to record dose in cloud:', err);
  }
}

/**
 * ربط المرافق بالمريض باستخدام كود الربط
 * ⚠️ يتم عبر updateDoc مباشر دون getDoc مسبق حتى تسمح قواعد الأمان
 */
export async function linkCaregiverToPatient(
  pairingCode: string,
  caregiverUid: string
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanCode = pairingCode.trim().toUpperCase();
    if (!cleanCode.startsWith('RAF-')) {
      return { success: false, message: 'صيغة كود الربط غير صحيحة، يجب أن يبدأ بـ RAF-' };
    }

    const patientRef = doc(db, 'patients', cleanCode);
    // إضافة UID المرافق مباشرة لمصفوفة caregiverUids
    await updateDoc(patientRef, {
      caregiverUids: arrayUnion(caregiverUid),
    });

    // تحديث قائمة المرضى المرتبطين في ملف المرافق باستخدام setDoc مع merge
    const userRef = doc(db, 'users', caregiverUid);
    await setDoc(
      userRef,
      {
        linkedPatientCodes: arrayUnion(cleanCode),
        activePatientCode: cleanCode,
      },
      { merge: true }
    );

    return { success: true, message: 'تم الربط بالمريض بنجاح!' };
  } catch (err) {
    console.error('Failed to link caregiver:', err);
    return {
      success: false,
      message: 'تعذر الربط. تأكد من صحة كود المريض واتصالك بالإنترنت.',
    };
  }
}

/**
 * فك ارتباط المرافق بالمريض
 */
export async function unlinkCaregiverFromPatient(
  pairingCode: string,
  caregiverUid: string
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanCode = pairingCode.trim().toUpperCase();
    const patientRef = doc(db, 'patients', cleanCode);
    await updateDoc(patientRef, {
      caregiverUids: arrayRemove(caregiverUid),
    });

    // إزالة الكود من ملف المرافق
    const userRef = doc(db, 'users', caregiverUid);
    await setDoc(
      userRef,
      {
        linkedPatientCodes: arrayRemove(cleanCode),
      },
      { merge: true }
    );

    return { success: true, message: 'تم فك الارتباط بنجاح.' };
  } catch (err) {
    return { success: false, message: (err as Error)?.message || 'فشل فك الارتباط' };
  }
}

/**
 * تعديل مخزون الدواء من قبل المرافق
 */
export async function updateMedicationStockByCaregiver(
  pairingCode: string,
  medId: string,
  newStock: number
): Promise<void> {
  try {
    const patientRef = doc(db, 'patients', pairingCode);
    await updateDoc(patientRef, {
      [`stockEdits.${medId}`]: newStock,
    });
  } catch (err) {
    console.error('Failed to update stock by caregiver:', err);
    throw err;
  }
}

/**
 * مسح تعديل المخزون المطبق من قبل المريض بعد اعتماده
 */
export async function clearPatientStockEdit(
  pairingCode: string,
  medId: string
): Promise<void> {
  try {
    const patientRef = doc(db, 'patients', pairingCode);
    await updateDoc(patientRef, {
      [`stockEdits.${medId}`]: deleteField(),
    });
  } catch (err) {
    console.warn('Could not clear applied stockEdit from cloud:', err);
  }
}

/**
 * استماع لحظي لمستند المريض (onSnapshot) للمرافق أو المريض
 */
export function subscribeToPatientDocument(
  pairingCode: string,
  onData: (doc: PatientDocument) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const patientRef = doc(db, 'patients', pairingCode);
  return onSnapshot(
    patientRef,
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as PatientDocument);
      }
    },
    (err) => {
      console.warn('Patient snapshot error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * توليد كود ربط عشوائي مشفر للمريض بصيغة RAF-XXXXXXXXXX بطول 10 أحرف
 */
export function generatePairingCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const array = new Uint8Array(10);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 10; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  let random = '';
  for (let i = 0; i < 10; i++) {
    random += chars[array[i] % chars.length];
  }
  return `RAF-${random}`;
}
