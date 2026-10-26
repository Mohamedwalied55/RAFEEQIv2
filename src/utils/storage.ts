/**
 * إدارة التخزين المحلي الآمن وترحيل الإصدارات
 */
import {
  Medication,
  DoseLog,
  VitalMeasurement,
  DailyReminder,
  CaregiverConfig,
  WaterReminderConfig,
  AppSettings,
  UserProfile,
  AdherenceResult,
  DeletedTombstones,
} from '../types';

const STORAGE_KEYS = {
  VERSION: 'rafeeqi_storage_v1',
  MEDS: 'rafeeqi_meds',
  LOGS: 'rafeeqi_dose_logs',
  VITALS: 'rafeeqi_vitals',
  REMINDERS: 'rafeeqi_reminders',
  CAREGIVER: 'rafeeqi_caregiver',
  WATER: 'rafeeqi_water',
  SETTINGS: 'rafeeqi_settings',
  PROFILE: 'rafeeqi_user_profile',
  PERMISSIONS: 'rafeeqi_perms_dismissed',
  LAST_SYNC: 'rafeeqi_last_sync',
  DELETED: 'rafeeqi_deleted',
};

// ===== عزل بيانات كل مستخدم بمعرّفه (UID) حتى لا تختلط بيانات حسابين على نفس الجهاز =====
const ACTIVE_UID_KEY = 'rafeeqi_active_uid';
const USER_DATA_KEYS: string[] = [
  STORAGE_KEYS.PROFILE,
  STORAGE_KEYS.MEDS,
  STORAGE_KEYS.LOGS,
  STORAGE_KEYS.VITALS,
  STORAGE_KEYS.REMINDERS,
  STORAGE_KEYS.CAREGIVER,
  STORAGE_KEYS.WATER,
  STORAGE_KEYS.LAST_SYNC,
  STORAGE_KEYS.DELETED,
];

let activeUid: string | null = (() => {
  try {
    return localStorage.getItem(ACTIVE_UID_KEY);
  } catch {
    return null;
  }
})();

function scopedKey(key: string): string {
  return activeUid && USER_DATA_KEYS.includes(key) ? `${key}:${activeUid}` : key;
}

/**
 * تحليل مفتاح الجرعة بدقة من اليمين لتفادي مشاكل احتواء معرّف الدواء على شرطات سفلية (_)
 * مثال: med_1792856660798_2026-10-24_08:00
 */
export function parseDoseKey(key: string): { medId: string; date: string; time: string } | null {
  const match = key.match(/^(.*)_(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2})$/);
  if (!match) return null;
  return {
    medId: match[1],
    date: match[2],
    time: match[3],
  };
}

export function formatDateYMD(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateYMD(dateOrStr: Date | string): Date {
  if (dateOrStr instanceof Date) {
    return new Date(dateOrStr.getFullYear(), dateOrStr.getMonth(), dateOrStr.getDate(), 0, 0, 0, 0);
  }
  const parts = dateOrStr.split('T')[0].split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  const parsed = new Date(dateOrStr);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
}


export const defaultSettings: AppSettings = {
  fontSize: 'normal',
  highContrast: false,
  darkMode: false,
  soundEnabled: true,
  soundVolume: 0.9,
  repeatAlarmMinutes: 5,
  repeatAlarmCount: 3,
  snoozeMinutes: 10,
  lowStockThresholdDays: 5,
};

export const defaultCaregiverConfig: CaregiverConfig = {
  enabled: false,
  name: '',
  phone: '',
  countryCode: '+20',
  secondaryName: '',
  secondaryPhone: '',
  secondaryCountryCode: '+20',
  relationship: 'ابن/ابنة',
  unconfirmedThresholdMinutes: 30,
  allowViewVitals: true,
  allowViewMeds: true,
  allowEditMeds: true,
  patientName: '',
  patientPairingCode: '',
};

export const defaultWaterConfig: WaterReminderConfig = {
  enabled: true,
  dailyGoalMl: 2000,
  glassSizeMl: 250,
  drunkTodayMl: 500,
  lastLogDate: formatDateYMD(),
  intervalMinutes: 60,
  startTime: '08:00',
  endTime: '22:00',
};

const initialSampleMeds: Medication[] = [
  {
    id: 'med_sample_1',
    name: 'بانادول Panadol',
    activeIngredient: 'Paracetamol',
    strength: '500 مجم',
    form: 'أقراص',
    dose: 1,
    times: ['08:00', '20:00'],
    days: [0, 1, 2, 3, 4, 5, 6],
    startDate: formatDateYMD(),
    foodTiming: 'بعد الأكل',
    notes: 'حبة واحدة عند اللزوم أو كل 12 ساعة',
    stock: 20,
    unitsPerStrip: 10,
    stripsPerBox: 2,
    boxPrice: 35,
    active: true,
    isExample: true,
  },
  {
    id: 'med_sample_2',
    name: 'أوميجا 3 Omega-3',
    activeIngredient: 'Fish Oil',
    strength: '1000 مجم',
    form: 'كبسولات',
    dose: 1,
    times: ['13:00'],
    days: [0, 1, 2, 3, 4, 5, 6],
    startDate: formatDateYMD(),
    foodTiming: 'مع الأكل',
    notes: 'مع وجبة الغداء',
    stock: 28,
    unitsPerStrip: 15,
    stripsPerBox: 2,
    boxPrice: 85,
    active: true,
    isExample: true,
  },
];

const initialSampleReminders: DailyReminder[] = [
  {
    id: 'rem_walk',
    type: 'walk',
    title: 'المشي الخفيف وتنشيط الدورة الدموية',
    times: ['17:00'],
    days: [0, 1, 2, 3, 4, 5, 6],
    notes: '20 دقيقة مشي خفيف',
    active: true,
  },
  {
    id: 'rem_bp',
    type: 'bp',
    title: 'قياس ضغط الدم الصباحي',
    times: ['09:00'],
    days: [0, 1, 2, 3, 4, 5, 6],
    notes: 'في وضع الجلوس والراحة',
    active: true,
  },
];

// Helper safe storage
function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(scopedKey(key));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`Error reading key ${key} from localStorage:`, e);
    return fallback;
  }
}

function safeSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(scopedKey(key), JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving key ${key} to localStorage:`, e);
  }
}

const TOMBSTONE_TTL_DAYS = 90;

/**
 * حذف سجلات الحذف الأقدم من 90 يوماً حتى لا يكبر المستند
 */
export function pruneTombstones(d: DeletedTombstones): DeletedTombstones {
  const cutoff = new Date(Date.now() - TOMBSTONE_TTL_DAYS * 86400000).toISOString();
  const prune = (m: Record<string, string>): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [id, ts] of Object.entries(m || {})) {
      if (typeof ts === 'string' && ts >= cutoff) out[id] = ts;
    }
    return out;
  };
  return { medications: prune(d.medications), vitals: prune(d.vitals) };
}

/**
 * دمج سجلين للحذف (الأحدث وقتاً يكسب)
 */
export function mergeTombstones(
  a: DeletedTombstones,
  b: Partial<DeletedTombstones> | undefined | null
): DeletedTombstones {
  const mergeMap = (x: Record<string, string>, y: Record<string, string> | undefined) => {
    const out: Record<string, string> = { ...x };
    for (const [id, ts] of Object.entries(y || {})) {
      if (!out[id] || ts > out[id]) out[id] = ts;
    }
    return out;
  };
  return pruneTombstones({
    medications: mergeMap(a.medications, b?.medications),
    vitals: mergeMap(a.vitals, b?.vitals),
  });
}

export const Storage = {
  getMedications(): Medication[] {
    return safeGet<Medication[]>(STORAGE_KEYS.MEDS, initialSampleMeds);
  },
  saveMedications(meds: Medication[]): void {
    safeSet(STORAGE_KEYS.MEDS, meds);
  },

  getDoseLogs(): Record<string, DoseLog> {
    return safeGet<Record<string, DoseLog>>(STORAGE_KEYS.LOGS, {});
  },
  saveDoseLogs(logs: Record<string, DoseLog>): void {
    safeSet(STORAGE_KEYS.LOGS, logs);
  },

  getVitals(): VitalMeasurement[] {
    return safeGet<VitalMeasurement[]>(STORAGE_KEYS.VITALS, [
      {
        id: 'vit_sample_1',
        type: 'bp',
        systolic: 120,
        diastolic: 80,
        dateTime: new Date(Date.now() - 3600000 * 24).toISOString(),
        notes: 'ضغط مثالي صباحاً',
      },
      {
        id: 'vit_sample_2',
        type: 'sugar',
        value: 105,
        sugarContext: 'fasting',
        dateTime: new Date(Date.now() - 3600000 * 12).toISOString(),
        notes: 'سكر صائم طبيعي',
      },
    ]);
  },
  saveVitals(vitals: VitalMeasurement[]): void {
    safeSet(STORAGE_KEYS.VITALS, vitals);
  },

  getReminders(): DailyReminder[] {
    return safeGet<DailyReminder[]>(STORAGE_KEYS.REMINDERS, initialSampleReminders);
  },
  saveReminders(reminders: DailyReminder[]): void {
    safeSet(STORAGE_KEYS.REMINDERS, reminders);
  },

  getCaregiverConfig(): CaregiverConfig {
    return safeGet<CaregiverConfig>(STORAGE_KEYS.CAREGIVER, defaultCaregiverConfig);
  },
  saveCaregiverConfig(cfg: CaregiverConfig): void {
    safeSet(STORAGE_KEYS.CAREGIVER, cfg);
  },

  getWaterConfig(): WaterReminderConfig {
    const cfg = safeGet<WaterReminderConfig>(STORAGE_KEYS.WATER, defaultWaterConfig);
    const today = formatDateYMD();
    if (cfg.lastLogDate !== today) {
      cfg.drunkTodayMl = 0;
      cfg.lastLogDate = today;
      cfg.updatedAt = new Date().toISOString();
      safeSet(STORAGE_KEYS.WATER, cfg);
    }
    return cfg;
  },
  saveWaterConfig(cfg: WaterReminderConfig): void {
    safeSet(STORAGE_KEYS.WATER, cfg);
  },

  getSettings(): AppSettings {
    return safeGet<AppSettings>(STORAGE_KEYS.SETTINGS, defaultSettings);
  },
  saveSettings(settings: AppSettings): void {
    safeSet(STORAGE_KEYS.SETTINGS, settings);
  },

  getUserProfile(): UserProfile | null {
    return safeGet<UserProfile | null>(STORAGE_KEYS.PROFILE, null);
  },
  saveUserProfile(profile: UserProfile | null): void {
    // أي حفظ لملف مستخدم جديد يحوّل التخزين المحلي إلى مساحة هذا المستخدم أولاً
    if (profile && profile.uid !== activeUid) {
      Storage.setActiveUser(profile.uid);
    }
    safeSet(STORAGE_KEYS.PROFILE, profile);
  },

  /** معرّف المستخدم الذي تخزَّن باسمه البيانات المحلية حالياً */
  getActiveUser(): string | null {
    return activeUid;
  },

  /**
   * تحويل التخزين المحلي إلى مساحة مستخدم معيّن (أو إلى لا أحد عند تسجيل الخروج).
   * البيانات القديمة غير المعزولة تُنقل فقط إذا كانت تخص نفس المستخدم، وإلا تُحذف.
   */
  setActiveUser(uid: string | null): void {
    if (uid === activeUid) return;
    if (uid) {
      try {
        const rawProfile = localStorage.getItem(STORAGE_KEYS.PROFILE);
        let legacyOwner: string | null = null;
        if (rawProfile) {
          try {
            legacyOwner = (JSON.parse(rawProfile) as { uid?: string } | null)?.uid ?? null;
          } catch {
            legacyOwner = null;
          }
        }
        for (const k of USER_DATA_KEYS) {
          const raw = localStorage.getItem(k);
          if (raw === null) continue;
          if (legacyOwner === uid && localStorage.getItem(`${k}:${uid}`) === null) {
            localStorage.setItem(`${k}:${uid}`, raw);
          }
          localStorage.removeItem(k);
        }
      } catch (e) {
        console.warn('Legacy storage migration skipped:', e);
      }
    }
    activeUid = uid;
    try {
      if (uid) localStorage.setItem(ACTIVE_UID_KEY, uid);
      else localStorage.removeItem(ACTIVE_UID_KEY);
    } catch {
      // ignore
    }
  },

  isPermissionsWizardDismissed(): boolean {
    return safeGet<boolean>(STORAGE_KEYS.PERMISSIONS, false);
  },
  setPermissionsWizardDismissed(val: boolean): void {
    safeSet(STORAGE_KEYS.PERMISSIONS, val);
  },

  getDeleted(): DeletedTombstones {
    const raw = safeGet<Partial<DeletedTombstones>>(STORAGE_KEYS.DELETED, {});
    return pruneTombstones({
      medications: raw?.medications || {},
      vitals: raw?.vitals || {},
    });
  },
  saveDeleted(deleted: DeletedTombstones): void {
    safeSet(STORAGE_KEYS.DELETED, pruneTombstones(deleted));
  },
  markDeleted(kind: keyof DeletedTombstones, id: string): void {
    const current = Storage.getDeleted();
    current[kind][id] = new Date().toISOString();
    Storage.saveDeleted(current);
  },

  getLastSyncTimestamp(): string | null {
    return safeGet<string | null>(STORAGE_KEYS.LAST_SYNC, null);
  },
  saveLastSyncTimestamp(timestamp: string): void {
    safeSet(STORAGE_KEYS.LAST_SYNC, timestamp);
  },

  /**
   * مسح بيانات المستخدم الحالي عند تسجيل الخروج
   * حتى لا تتسرب بيانات مريض لحساب مرافق على نفس الموبايل
   */
  clearUserData(): void {
    try {
      for (const k of USER_DATA_KEYS) {
        localStorage.removeItem(k);
        if (activeUid) localStorage.removeItem(`${k}:${activeUid}`);
      }
    } catch (e) {
      console.warn('Error clearing user data from localStorage:', e);
    }
    Storage.setActiveUser(null);
  },
};

/**
 * دالة نقية واحدة وموحدة لحساب نسبة الالتزام الدوائي الحقيقية
 * - المقام (due): كل جرعة مجدولة حان وقتها الفعلي ومضى (scheduledDateTime <= now)
 *   والجرعات المستقبلية لا تُحسب أبداً.
 * - البسط (taken): الجرعات بحالة taken فقط.
 * - المتخطاة skipped والفائتة والمؤجلة المنتهية تعد غير ملتزم بها.
 * - الجرعة المؤجلة snoozed التي ما زالت في المستقبل (until > now) تُستثنى من المقام لحين حلول وقتها.
 * - استبعاد بيانات المثال (isExample: true أو id.startsWith('med_sample_')) تماماً.
 * - إذا أضيف الدواء مؤخراً، يُحسب من تاريخ بدايته (startDate) فقط ولا يُحسب ما قبله.
 * - النتيجة: { taken, skipped, missed, due, percent }
 *   حيث percent = due === 0 ? null : Math.round((taken / due) * 100).
 */
export function calculateAdherence(
  state: {
    medications: Medication[];
    doseLogs: Record<string, DoseLog>;
  },
  fromDate: Date | string,
  toDate: Date | string,
  now: Date = new Date()
): AdherenceResult {
  const start = parseDateYMD(fromDate);
  const end = parseDateYMD(toDate);
  end.setHours(23, 59, 59, 999);

  let taken = 0;
  let skipped = 0;
  let missed = 0;
  let due = 0;

  // استبعاد أدوية الأمثلة التجريبية تماماً
  const realMeds = (state.medications || []).filter(
    (m) => m.active && !m.isExample && !m.id.startsWith('med_sample_')
  );

  const cur = new Date(start);
  while (cur <= end && cur <= now) {
    const curDateStr = formatDateYMD(cur);
    const dayOfWeek = cur.getDay();

    for (const med of realMeds) {
      if (!med.days.includes(dayOfWeek)) continue;
      // لا يُحسب قبل تاريخ بدء الدواء الفعلي
      if (med.startDate && curDateStr < med.startDate) continue;
      if (med.endDate && curDateStr > med.endDate) continue;

      for (const timeStr of med.times) {
        const [h, m] = timeStr.split(':').map(Number);
        const doseDateTime = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), h, m, 0, 0);

        // الجرعات المستقبلية (أكبر من الوقت الحالي now) لا تُحسب أبداً في المقام
        if (doseDateTime.getTime() > now.getTime()) {
          continue;
        }

        const doseKey = `${med.id}_${curDateStr}_${timeStr}`;
        const log = state.doseLogs?.[doseKey];

        // الجرعة المؤجلة التي ما زالت في المستقبل (until > now) تُستثنى من المقام لحين حلول وقتها
        if (log?.status === 'snoozed' && log.until) {
          const snoozeUntil = new Date(log.until);
          if (snoozeUntil.getTime() > now.getTime()) {
            continue;
          }
        }

        // الجرعة مضى وقتها وأصبحت مستحقة فعلاً
        due++;

        if (log?.status === 'taken') {
          taken++;
        } else if (log?.status === 'skipped') {
          skipped++;
        } else {
          // فائتة (بدون سجل أو مؤجلة فات وقتها الجديد ولم تؤخذ)
          missed++;
        }
      }
    }

    cur.setDate(cur.getDate() + 1);
  }

  const percent = due === 0 ? null : Math.round((taken / due) * 100);

  return {
    taken,
    skipped,
    missed,
    due,
    percent,
  };
}

/**
 * الألوان الموحدة لنسبة الالتزام:
 * >= 80% أخضر | 50–79% برتقالي | < 50% أحمر | null رمادي
 */
export function getAdherenceTheme(percent: number | null): {
  textColor: string;
  bgColor: string;
  badgeBg: string;
  badgeText: string;
  labelText: string;
  displayValue: string;
  borderColor: string;
  cardBg: string;
} {
  if (percent === null) {
    return {
      textColor: 'text-slate-400 dark:text-slate-500',
      bgColor: 'bg-slate-300 dark:bg-slate-700',
      badgeBg: 'bg-slate-100 dark:bg-slate-800',
      badgeText: 'text-slate-500 dark:text-slate-400',
      labelText: 'لا توجد بيانات كافية بعد',
      displayValue: '—',
      borderColor: 'border-slate-200 dark:border-slate-700',
      cardBg: 'bg-slate-50 dark:bg-slate-900/50',
    };
  }
  if (percent >= 80) {
    return {
      textColor: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      badgeText: 'text-emerald-700 dark:text-emerald-300',
      labelText: 'التزام ممتاز',
      displayValue: `${percent}%`,
      borderColor: 'border-emerald-200 dark:border-emerald-900',
      cardBg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
    };
  }
  if (percent >= 50) {
    return {
      textColor: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
      badgeText: 'text-amber-700 dark:text-amber-300',
      labelText: 'التزام متوسط',
      displayValue: `${percent}%`,
      borderColor: 'border-amber-200 dark:border-amber-900',
      cardBg: 'bg-amber-50/50 dark:bg-amber-950/20',
    };
  }
  return {
    textColor: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-500',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/40',
    badgeText: 'text-rose-700 dark:text-rose-300',
    labelText: 'التزام منخفض',
    displayValue: `${percent}%`,
    borderColor: 'border-rose-200 dark:border-rose-900',
    cardBg: 'bg-rose-50/50 dark:bg-rose-950/20',
  };
}
