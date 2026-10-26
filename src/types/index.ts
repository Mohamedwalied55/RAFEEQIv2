/**
 * نموذج بيانات تطبيق «رفيقي» (RAFEEQI)
 */

export type UserRole = 'patient' | 'caregiver';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phone: string;
  countryCode: string;
  role: UserRole;
  pairingCode?: string; // RAF-XXXXXXXXXX للمريض
  linkedPatientCodes?: string[]; // للمرافق
  activePatientCode?: string;
  createdAt: string;
}

export type MedicationForm =
  | 'أقراص'
  | 'كبسولات'
  | 'شراب'
  | 'حقن'
  | 'قطرة'
  | 'بخاخ'
  | 'كريم أو مرهم'
  | 'أخرى';

export type FoodTiming =
  | 'قبل الأكل'
  | 'بعد الأكل'
  | 'مع الأكل'
  | 'على معدة فارغة'
  | 'قبل النوم'
  | 'غير مرتبط بالطعام';

export interface Medication {
  id: string;
  name: string;
  activeIngredient?: string;
  strength: string;
  form: MedicationForm;
  dose: number;
  times: string[]; // مثل ["08:00", "20:00"]
  days: number[]; // 0=الأحد، 1=الإثنين ... 6=السبت
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  foodTiming: FoodTiming;
  notes?: string;
  photoUrl?: string;
  stock: number;
  minStock?: number;
  unitsPerStrip?: number;
  stripsPerBox?: number;
  boxPrice?: number;
  active: boolean;
  isExample?: boolean;
  updatedAt?: string;
}

export interface AdherenceResult {
  taken: number;
  skipped: number;
  missed: number;
  due: number;
  percent: number | null;
}

export type ReminderType =
  | 'water'
  | 'walk'
  | 'bp'
  | 'sugar'
  | 'temp'
  | 'pulse'
  | 'doctor'
  | 'lab'
  | 'custom';

export interface DailyReminder {
  id: string;
  type: ReminderType;
  title: string;
  times: string[];
  days: number[];
  date?: string;
  notes?: string;
  active: boolean;
  updatedAt?: string;
}

export type DoseStatus = 'taken' | 'skipped' | 'snoozed';

export interface DoseLog {
  status: DoseStatus;
  timestamp: string; // ISO string
  until?: string; // في حالة التأجيل
  notes?: string;
  reportedBy: 'patient' | 'caregiver';
  takenDose?: number; // الجرعة الفعلية القابلة للتعديل لكل موعد
}

export type VitalType = 'bp' | 'sugar' | 'temp' | 'pulse';
export type SugarContext = 'fasting' | 'post_prandial' | 'random';

export interface VitalMeasurement {
  id: string;
  type: VitalType;
  systolic?: number;
  diastolic?: number;
  value?: number;
  sugarContext?: SugarContext;
  dateTime: string;
  notes?: string;
  updatedAt?: string;
}

export interface CaregiverConfig {
  enabled: boolean;
  name: string;
  phone: string;
  countryCode: string;
  secondaryName?: string;
  secondaryPhone?: string;
  secondaryCountryCode?: string;
  relationship: string;
  unconfirmedThresholdMinutes: number; // افتراضي 30
  allowViewVitals: boolean;
  allowViewMeds: boolean;
  allowEditMeds: boolean;
  patientName: string;
  patientPairingCode: string;
}

export interface WaterReminderConfig {
  enabled: boolean;
  dailyGoalMl: number;
  glassSizeMl: number;
  drunkTodayMl: number;
  lastLogDate: string; // YYYY-MM-DD
  intervalMinutes: number;
  startTime: string;
  endTime: string;
  updatedAt?: string;
}

export type FontSizeLevel = 'normal' | 'large' | 'huge';

export interface AppSettings {
  fontSize: FontSizeLevel;
  highContrast: boolean;
  darkMode: boolean;
  soundEnabled: boolean;
  soundVolume: number; // 0..1
  repeatAlarmMinutes: number; // دقائق التكرار
  repeatAlarmCount: number; // 1 إلى 5
  snoozeMinutes: number; // دقائق التأجيل
  lowStockThresholdDays: number; // حد المخزون المنخفض بالأيام
}

export interface PatientAlert {
  id: string;
  type: 'taken' | 'delayed' | 'skipped' | 'vital_alert';
  title: string;
  body: string;
  timestamp: string;
  medId?: string;
}

/**
 * سجل الحذف (Tombstones): معرّف العنصر المحذوف ← وقت الحذف،
 * حتى لا يعود عنصر محذوف عند الدمج مع نسخة السحابة
 */
export interface DeletedTombstones {
  medications: Record<string, string>;
  vitals: Record<string, string>;
}

export interface PatientDocument {
  patientUid: string;
  patientName: string;
  caregiverUids: string[]; // إلزامي مصفوفة [] عند الإنشاء
  state: {
    medications: Medication[];
    doseLogs: Record<string, DoseLog>;
    vitals: VitalMeasurement[];
    reminders: DailyReminder[];
    water: WaterReminderConfig;
    deleted?: DeletedTombstones;
    lastUpdated: string;
  };
  alerts: PatientAlert[];
  stockEdits?: Record<string, number>;
  allowEditMeds?: boolean;
}

export interface TodayDoseInstance {
  key: string; // "{medId}_{date}_{time}"
  medId: string;
  medication: Medication;
  scheduledTime: string;
  date: string;
  log?: DoseLog;
  isPast: boolean;
  isDelayed: boolean;
}
