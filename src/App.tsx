/**
 * الموجه الأساسي للتطبيق (Role-Based Router)
 * يفصل تماماً بين واجهة المريض (PatientApp) وواجهة المرافق (CaregiverApp)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { syncStatus, describeError } from './utils/syncStatus';
import { onAuthStateChanged } from 'firebase/auth';
import { App as CapApp } from '@capacitor/app';
import { auth, isFirebaseConfigured } from './lib/firebase';
import { logout, registerSessionInterval, unregisterSessionInterval } from './lib/session';
import {
  Medication,
  DoseLog,
  VitalMeasurement,
  DailyReminder,
  WaterReminderConfig,
  CaregiverConfig,
  AppSettings,
  UserProfile,
} from './types';
import {
  Storage,
  formatDateYMD,
  parseDoseKey,
  mergeTombstones,
} from './utils/storage';
import {
  rescheduleNativeAlarms,
  scheduleTestAlarm,
  cancelAllNativeAlarms,
  scheduleSnoozeAlarm,
} from './utils/nativeAlarms';
import { registerNotificationListeners } from './utils/notifications';
import { unlockAudioContext } from './utils/audio';
import {
  syncPatientStateToCloud,
  generatePairingCode,
  getUserProfileFromCloud,
  recordDoseInCloud,
  pullPatientStateFromCloud,
  subscribeToPatientDocument,
  clearPatientStockEdit,
} from './utils/sync';

import { PatientApp } from './components/PatientApp';
import { CaregiverApp } from './components/CaregiverApp';
import { AuthScreen } from './components/AuthScreen';
import { ErrorBoundary } from './components/ErrorBoundary';

interface ToastItem {
  id: string;
  message: string;
  type?: 'info' | 'warning' | 'success';
}

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(() => Storage.getUserProfile());

  // حالة المريض (خاصة فقط بالمريض)
  const [medications, setMedications] = useState<Medication[]>(() => Storage.getMedications());
  const [doseLogs, setDoseLogs] = useState<Record<string, DoseLog>>(() => Storage.getDoseLogs());
  const [vitals, setVitals] = useState<VitalMeasurement[]>(() => Storage.getVitals());
  const [reminders, setReminders] = useState<DailyReminder[]>(() => Storage.getReminders());
  const [water, setWater] = useState<WaterReminderConfig>(() => Storage.getWaterConfig());
  const [caregiverConfig, setCaregiverConfig] = useState<CaregiverConfig>(() =>
    Storage.getCaregiverConfig()
  );
  const [settings, setSettings] = useState<AppSettings>(() => Storage.getSettings());

  // حالة المزامنة مع السحابة
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [syncErrorDetail, setSyncErrorDetail] = useState('');

  // منبّه الجرعة الحية للمريض والتطبيق مفتوح
  const [activeAlarm, setActiveAlarm] = useState<{
    med: Medication;
    time: string;
    doseKey: string;
  } | null>(null);

  // مراجع لحفظ أحدث القيم لتجنب إعادة تشغيل الـ intervals والمستمعات دون داعٍ
  const activeAlarmRef = useRef(activeAlarm);
  activeAlarmRef.current = activeAlarm;

  const medicationsRef = useRef(medications);
  medicationsRef.current = medications;

  const doseLogsRef = useRef(doseLogs);
  doseLogsRef.current = doseLogs;

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const showToast = useCallback((msg: string, type: 'info' | 'warning' | 'success' = 'info') => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message: msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  // فك قفل الصوت عند أول تفاعل
  useEffect(() => {
    const handleFirstTouch = () => {
      unlockAudioContext();
      window.removeEventListener('pointerdown', handleFirstTouch);
      window.removeEventListener('touchstart', handleFirstTouch);
    };
    window.addEventListener('pointerdown', handleFirstTouch);
    window.addEventListener('touchstart', handleFirstTouch);
    return () => {
      window.removeEventListener('pointerdown', handleFirstTouch);
      window.removeEventListener('touchstart', handleFirstTouch);
    };
  }, []);

  // تطبيق إعدادات الرؤية وحجم الخط والوضع الداكن
  useEffect(() => {
    const root = document.documentElement;
    if (settings.fontSize === 'large') {
      root.style.fontSize = '18px';
    } else if (settings.fontSize === 'huge') {
      root.style.fontSize = '21px';
    } else {
      root.style.fontSize = '16px';
    }

    if (settings.darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    if (settings.highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  }, [settings]);

  // التحقق من الجلسة في Firebase Auth وقراءة الدور الدقيق من Firestore
  const loadedUidRef = useRef<string | null>(Storage.getActiveUser());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // عزل البيانات: لو الحساب مختلف عن آخر حساب محمّل نبدّل مساحة التخزين ونعيد تحميل الحالة
        if (loadedUidRef.current !== firebaseUser.uid) {
          Storage.setActiveUser(firebaseUser.uid);
          loadedUidRef.current = firebaseUser.uid;
          setMedications(Storage.getMedications());
          setDoseLogs(Storage.getDoseLogs());
          setVitals(Storage.getVitals());
          setReminders(Storage.getReminders());
          setWater(Storage.getWaterConfig());
          setCaregiverConfig(Storage.getCaregiverConfig());
        }
        // جلب الملف من Firestore لضمان مطابقة الدور الحقيقي مع حماية try/catch
        let cloudProfile: UserProfile | null = null;
        try {
          cloudProfile = await getUserProfileFromCloud(firebaseUser.uid);
        } catch (err) {
          console.warn('Error reading profile in onAuthStateChanged:', err);
        }

        if (cloudProfile) {
          setProfile(cloudProfile);
          Storage.saveUserProfile(cloudProfile);
        } else {
          const stored = Storage.getUserProfile();
          if (stored && stored.uid === firebaseUser.uid) {
            setProfile(stored);
          }
        }
      } else {
        // عند خلو الجلسة نعود لشاشة الدخول فقط. لا نمسح البيانات المحلية تلقائياً:
        // بياناتها معزولة بمعرّف كل مستخدم، والمسح يتم فقط عند الضغط على «تسجيل الخروج».
        loadedUidRef.current = null;
        setProfile((prev) => (prev && prev.uid !== 'guest_local' ? null : prev));
        setCloudHydrated(false);
      }
    });
    return () => unsub();
  }, []);

  // سحب الحالة من السحابة عند تسجيل دخول مريض حقيقي مع دمج ذكي بالأحدث (Bidirectional Sync)
  useEffect(() => {
    if (!profile) {
      setCloudHydrated(false);
      return;
    }

    if (profile.role !== 'patient' || profile.uid === 'guest_local' || !profile.pairingCode) {
      setCloudHydrated(true);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const cloudState = await pullPatientStateFromCloud(profile.pairingCode!);
        if (!isMounted) return;
        if (cloudState) {
          const cloudLastUpdated = cloudState.lastUpdated || '';

          // دمج سجلات الحذف (Tombstones) حتى لا يعود دواء أو قياس تم حذفه على جهاز آخر أو أثناء انقطاع النت
          const mergedDeleted = mergeTombstones(Storage.getDeleted(), cloudState.deleted);
          Storage.saveDeleted(mergedDeleted);

          // 1. دمج الأدوية بالـ id (الأحدث يكسب ولا يحذف عنصر محلي غير موجود بالسحابة لو كانت المزامنة أقدم منه)
          if (cloudState.medications && Array.isArray(cloudState.medications)) {
            const cloudMeds = cloudState.medications.filter(
              (m) => !m.isExample && !m.id.startsWith('med_sample_') && !mergedDeleted.medications[m.id]
            );
            const localMeds = Storage.getMedications().filter((m) => !mergedDeleted.medications[m.id]);
            const mergedMap = new Map<string, Medication>();

            for (const lm of localMeds) {
              mergedMap.set(lm.id, lm);
            }

            for (const cm of cloudMeds) {
              const lm = mergedMap.get(cm.id);
              if (!lm) {
                mergedMap.set(cm.id, cm);
              } else {
                const lmTime = lm.updatedAt || '';
                const cmTime = cm.updatedAt || cloudLastUpdated;
                if (!lmTime || cmTime >= lmTime) {
                  mergedMap.set(cm.id, { ...lm, ...cm });
                }
              }
            }

            // لا نُسقط أي دواء محلي (لم يُحذف صراحةً)، حتى لو لم يصل للسحابة بعد
            const finalMeds: Medication[] = [...mergedMap.values()];
            setMedications(finalMeds);
            Storage.saveMedications(finalMeds);
          }

          // 2. دمج سجلات الجرعات
          if (cloudState.doseLogs) {
            const localLogs = Storage.getDoseLogs();
            const mergedLogs: Record<string, DoseLog> = { ...localLogs };
            for (const [k, cLog] of Object.entries(cloudState.doseLogs)) {
              const lLog = mergedLogs[k];
              if (!lLog) {
                mergedLogs[k] = cLog;
              } else {
                if (cLog.status === 'taken' || lLog.status !== 'taken') {
                  const cTime = cLog.timestamp || '';
                  const lTime = lLog.timestamp || '';
                  if (cTime >= lTime) {
                    mergedLogs[k] = cLog;
                  }
                }
              }
            }
            setDoseLogs(mergedLogs);
            Storage.saveDoseLogs(mergedLogs);
          }

          // 3. دمج القياسات vitals
          if (cloudState.vitals && Array.isArray(cloudState.vitals)) {
            const localVitals = Storage.getVitals().filter((v) => !mergedDeleted.vitals[v.id]);
            const cloudVitals = cloudState.vitals.filter((v) => !mergedDeleted.vitals[v.id]);
            const mergedMap = new Map<string, VitalMeasurement>();
            for (const lv of localVitals) mergedMap.set(lv.id, lv);
            for (const cv of cloudVitals) {
              const lv = mergedMap.get(cv.id);
              if (!lv) {
                mergedMap.set(cv.id, cv);
              } else {
                const lvTime = lv.updatedAt || lv.dateTime;
                const cvTime = cv.updatedAt || cv.dateTime;
                if (cvTime >= lvTime) {
                  mergedMap.set(cv.id, { ...lv, ...cv });
                }
              }
            }
            const finalVitals: VitalMeasurement[] = [...mergedMap.values()];
            setVitals(finalVitals);
            Storage.saveVitals(finalVitals);
          }

          // 4. دمج التذكيرات reminders
          if (cloudState.reminders && Array.isArray(cloudState.reminders)) {
            const localReminders = Storage.getReminders();
            const mergedMap = new Map<string, DailyReminder>();
            for (const lr of localReminders) mergedMap.set(lr.id, lr);
            for (const cr of cloudState.reminders) {
              const lr = mergedMap.get(cr.id);
              if (!lr) {
                mergedMap.set(cr.id, cr);
              } else {
                const lrTime = lr.updatedAt || '';
                const crTime = cr.updatedAt || cloudLastUpdated;
                if (crTime >= lrTime) {
                  mergedMap.set(cr.id, { ...lr, ...cr });
                }
              }
            }
            const finalReminders: DailyReminder[] = [...mergedMap.values()];
            setReminders(finalReminders);
            Storage.saveReminders(finalReminders);
          }

          // 5. دمج الماء water
          if (cloudState.water) {
            const localWater = Storage.getWaterConfig();
            const cw = cloudState.water;
            let mergedWater = { ...localWater };
            if (cw.lastLogDate === localWater.lastLogDate) {
              mergedWater = {
                ...cw,
                drunkTodayMl: Math.max(cw.drunkTodayMl || 0, localWater.drunkTodayMl || 0),
              };
            } else if ((cw.updatedAt || '') >= (localWater.updatedAt || '')) {
              mergedWater = { ...localWater, ...cw };
            }
            // لو بيانات الماء المدموجة تخص يوماً سابقاً نبدأ اليوم من الصفر (لا نعرض مجموع أمس كأنه اليوم)
            const todayYMD = formatDateYMD();
            if (mergedWater.lastLogDate !== todayYMD) {
              mergedWater = {
                ...mergedWater,
                drunkTodayMl: 0,
                lastLogDate: todayYMD,
                updatedAt: new Date().toISOString(),
              };
            }
            setWater(mergedWater);
            Storage.saveWaterConfig(mergedWater);
          }

          Storage.saveLastSyncTimestamp(cloudLastUpdated || new Date().toISOString());
        }
      } catch (err) {
        console.error('Error hydrating from cloud:', err);
      } finally {
        if (isMounted) {
          setCloudHydrated(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [profile?.uid, profile?.pairingCode, profile?.role]);

  // جدولة المنبّهات: حصرياً للمريض فقط مع debounce 500ms
  // للمرافق: إلغاء كافة الإشعارات المعلّقة
  useEffect(() => {
    if (profile?.role === 'patient') {
      const timer = setTimeout(() => {
        rescheduleNativeAlarms(medications, doseLogs, settings);
      }, 500);
      return () => clearTimeout(timer);
    } else if (profile?.role === 'caregiver') {
      cancelAllNativeAlarms();
    }
  }, [profile?.role, medications, doseLogs, settings]);

  // إعادة الجدولة عند عودة التطبيق للمقدمة (للمريض فقط)
  useEffect(() => {
    if (profile?.role !== 'patient') return;

    let removeListener: (() => void) | null = null;
    try {
      const subPromise = CapApp.addListener('appStateChange', (state) => {
        if (state.isActive) {
          rescheduleNativeAlarms(medications, doseLogs, settings);
        }
      });
      subPromise.then((sub) => {
        removeListener = () => sub.remove();
      });
    } catch {
      // ignore
    }
    return () => {
      if (removeListener) removeListener();
    };
  }, [profile?.role, medications, doseLogs, settings]);

  // الاستماع لنقر الإشعار في أندرويد لفتح شاشة التنبيه للجرعة المحددة
  useEffect(() => {
    if (profile?.role !== 'patient') return;

    const cleanup = registerNotificationListeners((action) => {
      const extra = action.notification?.extra;
      const doseKey = extra?.doseKey;
      const medId = extra?.medId;

      if (doseKey && medId) {
        const currentLogs = doseLogsRef.current;
        const currentMeds = medicationsRef.current;
        const existingLog = currentLogs[doseKey];

        if (existingLog?.status === 'taken' || existingLog?.status === 'skipped') {
          return;
        }

        const med = currentMeds.find((m) => m.id === medId);
        if (med) {
          const parsed = parseDoseKey(doseKey);
          const timeStr = (extra.timeStr as string) || parsed?.time || 'الموعد';
          setActiveAlarm({
            med,
            time: timeStr,
            doseKey,
          });
        }
      }
    });

    return cleanup;
  }, [profile?.role]);

  // مزامنة حالة المريض السحابية إلى Firestore عند حدوث تغييرات (مع Debounce 2 ثانية)
  // لا يتم الرفع قبل اكتمال السحب الأولي ولا لحساب الزائر، ونكتب allowEditMeds في المستند
  useEffect(() => {
    if (!cloudHydrated || profile?.role !== 'patient' || !profile.pairingCode || profile.uid === 'guest_local') {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        await syncPatientStateToCloud(
          profile.pairingCode!,
          {
            medications,
            doseLogs,
            vitals,
            reminders,
            water,
            deleted: Storage.getDeleted(),
          },
          {
            patientUid: profile.uid,
            patientName: profile.displayName,
            allowEditMeds: caregiverConfig.allowEditMeds,
          }
        );
        Storage.saveLastSyncTimestamp(new Date().toISOString());
        syncStatus.lastSuccessAt = new Date().toISOString();
        syncStatus.lastError = null;
        setSyncError(false);
        setSyncErrorDetail('');
      } catch (err) {
        console.error('Failed to sync patient state to cloud:', err);
        syncStatus.lastError = describeError(err);
        syncStatus.lastErrorAt = new Date().toISOString();
        setSyncError(true);
        setSyncErrorDetail((err as { code?: string })?.code || 'unknown');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [medications, doseLogs, vitals, reminders, water, profile, cloudHydrated, caregiverConfig.allowEditMeds]);

  // استماع المريض لتعديلات المخزون من المرافق عبر stockEdits
  useEffect(() => {
    if (profile?.role !== 'patient' || !profile.pairingCode || profile.uid === 'guest_local') {
      return;
    }

    const unsub = subscribeToPatientDocument(profile.pairingCode, (docData) => {
      if (!docData) return;
      if (docData.allowEditMeds === false) return;

      const stockEdits = docData.stockEdits;
      if (stockEdits && typeof stockEdits === 'object') {
        const entries = Object.entries(stockEdits);
        if (entries.length > 0) {
          let hasChange = false;
          const updatedList = [...medicationsRef.current];

          for (const [medId, newStock] of entries) {
            if (typeof newStock === 'number') {
              const idx = updatedList.findIndex((m) => m.id === medId);
              if (idx !== -1 && updatedList[idx].stock !== newStock) {
                updatedList[idx] = {
                  ...updatedList[idx],
                  stock: newStock,
                  updatedAt: new Date().toISOString(),
                };
                hasChange = true;
              }
              clearPatientStockEdit(profile.pairingCode!, medId).catch(console.error);
            }
          }

          if (hasChange) {
            setMedications(updatedList);
            Storage.saveMedications(updatedList);
            showToast('تم تحديث مخزون الأدوية بواسطة المرافق.');
          }
        }
      }
    });

    return () => unsub();
  }, [profile?.role, profile?.pairingCode, profile?.uid, showToast]);

  // فحص مواعيد الجرعات والتنبيه الفوري عندما يكون المريض فاتحاً للتطبيق
  useEffect(() => {
    if (profile?.role !== 'patient') return;

    const checkForegroundAlarms = () => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      const todayStr = formatDateYMD(now);
      const dayOfWeek = now.getDay();
      const currentMs = now.getTime();

      const currentMeds = medicationsRef.current;
      const currentLogs = doseLogsRef.current;

      for (const med of currentMeds) {
        if (!med.active || med.isExample || med.id.startsWith('med_sample_')) continue;
        if (!med.days.includes(dayOfWeek)) continue;
        if (med.startDate && todayStr < med.startDate) continue;
        if (med.endDate && todayStr > med.endDate) continue;

        for (const timeStr of med.times) {
          const doseKey = `${med.id}_${todayStr}_${timeStr}`;
          const existingLog = currentLogs[doseKey];

          if (existingLog?.status === 'taken' || existingLog?.status === 'skipped') {
            continue;
          }

          // معالجة التأجيل (Snooze): لا نفتح المنبّه إلا بعد حلول وقت until
          if (existingLog?.status === 'snoozed') {
            if (existingLog.until) {
              const untilMs = new Date(existingLog.until).getTime();
              if (currentMs >= untilMs) {
                if (!activeAlarmRef.current || activeAlarmRef.current.doseKey !== doseKey) {
                  setActiveAlarm({
                    med,
                    time: timeStr,
                    doseKey,
                  });
                  return;
                }
              }
            }
            continue;
          }

          // إذا لم تُؤخذ الجرعة بعد وموعدها يوافق الدقيقة الحالية
          if (timeStr === currentTimeStr) {
            if (!activeAlarmRef.current || activeAlarmRef.current.doseKey !== doseKey) {
              setActiveAlarm({
                med,
                time: currentTimeStr,
                doseKey,
              });
              return;
            }
          }
        }
      }
    };

    checkForegroundAlarms();
    const interval = setInterval(checkForegroundAlarms, 15000);
    registerSessionInterval(interval as unknown as number);
    return () => {
      clearInterval(interval);
      unregisterSessionInterval(interval as unknown as number);
    };
  }, [profile?.role]);

  // تأكيد الجرعة (أخذتها) وإرسال تنبيه حي للمرافقين في Firestore
  const handleTakeDose = (medId: string, doseKey: string, doseAmount?: number) => {
    // منع التأكيد المزدوج إذا كانت مسجلة مسبقاً
    if (doseLogs[doseKey]?.status === 'taken') {
      return;
    }

    const targetMed = medications.find((m) => m.id === medId);
    const amount = doseAmount ?? targetMed?.dose ?? 1;

    // تحذير نفاد أو انخفاض المخزون يظهر مع رسالة النجاح في قائمة التوست
    if (targetMed && targetMed.stock <= (targetMed.minStock || 3)) {
      showToast(
        `⚠️ تنبيه: مخزون دواء ${targetMed.name} قليل (${Math.max(0, targetMed.stock - amount)} متبقي). يُرجى إعادة التعبئة.`,
        'warning'
      );
    }

    const newLog: DoseLog = {
      status: 'taken',
      timestamp: new Date().toISOString(),
      reportedBy: 'patient',
      takenDose: amount,
    };

    const updatedLogs = {
      ...doseLogs,
      [doseKey]: newLog,
    };
    setDoseLogs(updatedLogs);
    Storage.saveDoseLogs(updatedLogs);

    // خصم الجرعة من المخزون
    if (targetMed && targetMed.stock > 0) {
      const updatedMeds = medications.map((m) =>
        m.id === medId
          ? {
              ...m,
              stock: Math.max(0, m.stock - amount),
              updatedAt: new Date().toISOString(),
            }
          : m
      );
      setMedications(updatedMeds);
      Storage.saveMedications(updatedMeds);
    }

    // إرسال تنبيه لحظي في Firestore للمرافق (باستثناء حساب الزائر المحلي)
    if (profile?.pairingCode && profile.uid !== 'guest_local' && targetMed) {
      const parsed = parseDoseKey(doseKey);
      const timeStr = parsed?.time || 'الموعد';
      recordDoseInCloud(
        profile.pairingCode,
        doseKey,
        newLog,
        targetMed.name,
        amount,
        targetMed.form,
        timeStr,
        profile.displayName
      );
    }

    showToast(`تم تسجيل أخذ جرعة ${targetMed?.name || 'الدواء'} بحمد الله.`, 'success');
  };

  const handleSnoozeDose = (medId: string, doseKey: string, minutes: number) => {
    const targetMed = medications.find((m) => m.id === medId);
    const untilDate = new Date(Date.now() + minutes * 60000);
    const until = untilDate.toISOString();
    const newLog: DoseLog = {
      status: 'snoozed',
      timestamp: new Date().toISOString(),
      until,
      reportedBy: 'patient',
    };
    const updatedLogs = {
      ...doseLogs,
      [doseKey]: newLog,
    };
    setDoseLogs(updatedLogs);
    Storage.saveDoseLogs(updatedLogs);

    // جدولة إشعار منبّه دقيق عند وقت انتهاء التأجيل
    if (targetMed) {
      scheduleSnoozeAlarm(targetMed, doseKey, untilDate);
    }

    if (profile?.pairingCode && profile.uid !== 'guest_local' && targetMed) {
      const parsed = parseDoseKey(doseKey);
      const timeStr = parsed?.time || 'الموعد';
      recordDoseInCloud(
        profile.pairingCode,
        doseKey,
        newLog,
        targetMed.name,
        targetMed.dose,
        targetMed.form,
        timeStr,
        profile.displayName
      );
    }

    showToast(`تم تأجيل التنبيه لمدة ${minutes} دقيقة.`);
  };

  const handleSkipDose = (medId: string, doseKey: string) => {
    const targetMed = medications.find((m) => m.id === medId);
    const newLog: DoseLog = {
      status: 'skipped',
      timestamp: new Date().toISOString(),
      reportedBy: 'patient',
    };
    const updatedLogs = {
      ...doseLogs,
      [doseKey]: newLog,
    };
    setDoseLogs(updatedLogs);
    Storage.saveDoseLogs(updatedLogs);

    if (profile?.pairingCode && profile.uid !== 'guest_local' && targetMed) {
      const parsed = parseDoseKey(doseKey);
      const timeStr = parsed?.time || 'الموعد';
      recordDoseInCloud(
        profile.pairingCode,
        doseKey,
        newLog,
        targetMed.name,
        targetMed.dose,
        targetMed.form,
        timeStr,
        profile.displayName
      );
    }

    showToast('تم تخطي هذه الجرعة لليوم.');
  };

  // إدارة أدوية المريض
  const handleAddMedication = (med: Medication) => {
    const updated = [
      ...medications.filter((m) => !m.isExample && !m.id.startsWith('med_sample_')),
      { ...med, updatedAt: new Date().toISOString() },
    ];
    setMedications(updated);
    Storage.saveMedications(updated);
    showToast(`تمت إضافة دواء ${med.name} بنجاح.`);
  };

  const handleUpdateMedication = (med: Medication) => {
    const updated = medications.map((m) =>
      m.id === med.id ? { ...med, updatedAt: new Date().toISOString() } : m
    );
    setMedications(updated);
    Storage.saveMedications(updated);
    showToast(`تم تحديث بيانات ${med.name}.`);
  };

  const handleDeleteMedication = (id: string) => {
    Storage.markDeleted('medications', id);
    const updated = medications.filter((m) => m.id !== id);
    setMedications(updated);
    Storage.saveMedications(updated);
    showToast('تم حذف الدواء.');
  };

  // قياسات المريض
  const handleAddVital = (vital: VitalMeasurement) => {
    const updated = [{ ...vital, updatedAt: new Date().toISOString() }, ...vitals];
    setVitals(updated);
    Storage.saveVitals(updated);
    showToast('تم تسجيل القياس بنجاح.');
  };

  const handleDeleteVital = (id: string) => {
    Storage.markDeleted('vitals', id);
    const updated = vitals.filter((v) => v.id !== id);
    setVitals(updated);
    Storage.saveVitals(updated);
  };

  // ماء المريض
  const handleUpdateWater = (newWater: WaterReminderConfig) => {
    const withUpdate = { ...newWater, updatedAt: new Date().toISOString() };
    setWater(withUpdate);
    Storage.saveWaterConfig(withUpdate);
  };

  // تذكيرات المريض
  const handleToggleReminder = (id: string) => {
    const updated = reminders.map((r) =>
      r.id === id ? { ...r, active: !r.active, updatedAt: new Date().toISOString() } : r
    );
    setReminders(updated);
    Storage.saveReminders(updated);
  };

  // إعدادات ومرافق
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    Storage.saveSettings(newSettings);
  };

  const handleUpdateCaregiver = (newCfg: CaregiverConfig) => {
    setCaregiverConfig(newCfg);
    Storage.saveCaregiverConfig(newCfg);
    showToast('تم حفظ بيانات المرافق بنجاح.');
  };

  // اختبار المنبّه للمريض
  const handleRunTestAlarm = async () => {
    const res = await scheduleTestAlarm();
    showToast(res.message);
  };

  // تسجيل الخروج التام والآمن عبر دالة logout الموحدة
  const handleSignOut = async () => {
    await logout({
      onSuccess: () => {
        loadedUidRef.current = null;
        setProfile(null);
        setMedications(Storage.getMedications());
        setDoseLogs(Storage.getDoseLogs());
        setVitals(Storage.getVitals());
        setReminders(Storage.getReminders());
        setWater(Storage.getWaterConfig());
        setCaregiverConfig(Storage.getCaregiverConfig());
        setCloudHydrated(false);
        showToast('تم تسجيل الخروج بنجاح.');
      },
      onError: (errMsg) => {
        showToast(`خطأ في تسجيل الخروج: ${errMsg}`);
      },
    });
  };

  // في حال نقص مفاتيح إعداد Firebase نعرض شاشة خطأ واضحة بالعربي
  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-3xl flex items-center justify-center text-3xl mb-4 border border-amber-500/30">
          ⚠️
        </div>
        <h1 className="text-xl font-bold mb-2">إعداد Firebase غير مكتمل</h1>
        <p className="text-sm text-slate-300 max-w-md leading-relaxed mb-6">
          لم يتم العثور على مفاتيح إعداد Firebase (VITE_FIREBASE_API_KEY أو VITE_FIREBASE_APP_ID).
          يُرجى تعيين متغيرات البيئة في ملف <code className="bg-slate-800 px-2 py-1 rounded text-teal-400 font-mono text-xs">.env</code> لتفعيل المزامنة وقاعدة البيانات.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-medium text-sm transition-colors shadow-lg cursor-pointer"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {/* مؤشر فشل المزامنة السحابية للمريض */}
      {syncError && profile?.role === 'patient' && (
        <div className="fixed top-3 left-3 z-50 bg-rose-600 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-in fade-in">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
          <span>فشلت المزامنة السحابية {syncErrorDetail ? `(${syncErrorDetail})` : ''}</span>
        </div>
      )}

      {/* إذا لم يسجل المستخدم دخوله بعد، يرى شاشة الدخول وإنشاء الحساب لاختيار دوره */}
      {!profile ? (
        <AuthScreen
          onAuthSuccess={(p, linkingWarning) => {
            setProfile(p);
            showToast(`أهلاً بك يا ${p.displayName}`);
            if (linkingWarning) {
              setTimeout(() => {
                showToast(linkingWarning, 'warning');
              }, 1200);
            }
          }}
          onCancel={() => {
            // كزائر افتراضي كـ مريض
            const guest: UserProfile = {
              uid: 'guest_local',
              email: 'guest@rafeeqi.local',
              displayName: 'مستخدم زائر',
              phone: '',
              countryCode: '+20',
              role: 'patient',
              pairingCode: generatePairingCode(),
              createdAt: new Date().toISOString(),
            };
            Storage.saveUserProfile(guest);
            setProfile(guest);
          }}
        />
      ) : profile.role === 'caregiver' ? (
        /* واجهة المرافق المنفصلة تماماً (CaregiverApp) */
        <CaregiverApp
          profile={profile}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onRefreshProfile={(p) => {
            Storage.saveUserProfile(p);
            setProfile(p);
          }}
          onSignOut={handleSignOut}
          showToast={showToast}
        />
      ) : (
        /* واجهة المريض المنفصلة تماماً (PatientApp) */
        <PatientApp
          profile={profile}
          medications={medications}
          doseLogs={doseLogs}
          vitals={vitals}
          reminders={reminders}
          water={water}
          caregiverConfig={caregiverConfig}
          settings={settings}
          activeAlarm={activeAlarm}
          onTakeDose={handleTakeDose}
          onSnoozeDose={handleSnoozeDose}
          onSkipDose={handleSkipDose}
          onCloseAlarm={() => setActiveAlarm(null)}
          onAddMedication={handleAddMedication}
          onUpdateMedication={handleUpdateMedication}
          onDeleteMedication={handleDeleteMedication}
          onAddVital={handleAddVital}
          onDeleteVital={handleDeleteVital}
          onUpdateWater={handleUpdateWater}
          onToggleReminder={handleToggleReminder}
          onUpdateSettings={handleUpdateSettings}
          onUpdateCaregiver={handleUpdateCaregiver}
          onRunTestAlarm={handleRunTestAlarm}
          onSignOut={handleSignOut}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />
      )}

      {/* نافذة تسجيل الدخول/تبديل الحساب للمريض */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <AuthScreen
            onAuthSuccess={(p, linkingWarning) => {
              setProfile(p);
              setIsAuthModalOpen(false);
              showToast(`أهلاً بك يا ${p.displayName}`);
              if (linkingWarning) {
                setTimeout(() => {
                  showToast(linkingWarning, 'warning');
                }, 1200);
              }
            }}
            onCancel={() => setIsAuthModalOpen(false)}
          />
        </div>
      )}

      {/* إشعارات Toast المؤقتة (تدعم رسائل متعددة وتحذيرات جنباً إلى جنب) */}
      {toasts.length > 0 && (
        <div className="fixed bottom-20 inset-x-4 z-50 max-w-sm mx-auto flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl text-center animate-in fade-in slide-in-from-bottom duration-200 ${
                t.message.includes('⚠️') || t.type === 'warning'
                  ? 'bg-amber-900/95 dark:bg-amber-950/95 text-amber-100 border border-amber-600/60'
                  : 'bg-slate-900/95 dark:bg-slate-800/95 text-white border border-slate-700'
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
    </ErrorBoundary>
  );
}
