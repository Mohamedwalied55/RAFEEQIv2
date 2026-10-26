/**
 * واجهة المرافق المنفصلة بالكامل (CaregiverApp)
 * تبويبات خاصة: مرضاي، التنبيهات الحية، إضافة مريض بالكود، الإعدادات، من نحن
 * لا توجد أدوية أو قياسات أو منبّهات خاصة بالمرافق
 */
import React, { useState, useEffect } from 'react';
import {
  Users,
  Bell,
  UserPlus,
  Settings,
  Info,
  LogOut,
  Pill,
  Activity,
  HeartHandshake,
  CheckCircle2,
  Clock,
  AlertCircle,
  Unlink,
  Share2,
  RefreshCw,
  Edit2,
  Moon,
  Sun,
  Type,
  Eye,
  Check,
} from 'lucide-react';
import {
  UserProfile,
  PatientDocument,
  PatientAlert,
  AppSettings,
  FontSizeLevel,
} from '../types';
import {
  linkCaregiverToPatient,
  unlinkCaregiverFromPatient,
  subscribeToPatientDocument,
  updateMedicationStockByCaregiver,
} from '../utils/sync';
import { calculateAdherence, getAdherenceTheme, formatDateYMD } from '../utils/storage';
import { registerSessionCleanup } from '../lib/session';
import { openWhatsAppChat } from '../utils/whatsapp';
import { AboutTab } from './AboutTab';

export type CaregiverTabType = 'patients' | 'alerts' | 'add_patient' | 'settings' | 'about';

interface CaregiverAppProps {
  profile: UserProfile;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onRefreshProfile: (profile: UserProfile) => void;
  onSignOut: () => void;
  showToast: (msg: string) => void;
}

export const CaregiverApp: React.FC<CaregiverAppProps> = ({
  profile,
  settings,
  onUpdateSettings,
  onRefreshProfile,
  onSignOut,
  showToast,
}) => {
  const [currentTab, setCurrentTab] = useState<CaregiverTabType>('patients');
  const [activeCode, setActiveCode] = useState<string>(
    profile.activePatientCode || profile.linkedPatientCodes?.[0] || ''
  );

  // مستند المريض الحالي وحالة المزامنة
  const [patientDoc, setPatientDoc] = useState<PatientDocument | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  // حقل إضافة مريض
  const [codeToLink, setCodeToLink] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');

  // تعديل المخزون
  const [editingStockMedId, setEditingStockMedId] = useState<string | null>(null);
  const [newStockVal, setNewStockVal] = useState<number>(0);

  const todayArabic = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  // مزامنة حية لمستند المريض النشط
  useEffect(() => {
    if (!activeCode) {
      setPatientDoc(null);
      return;
    }

    setSyncLoading(true);
    const unsub = subscribeToPatientDocument(
       activeCode,
       (docData) => {
         setPatientDoc(docData);
         setSyncLoading(false);
       },
       (err) => {
         console.warn('Caregiver live sync error:', err);
         setSyncLoading(false);
       }
     );

    const unregister = registerSessionCleanup(unsub);
    return () => {
      unsub();
      unregister();
    };
  }, [activeCode]);

  // ربط مريض بالكود (updateDoc مباشر دون getDoc مسبق)
  const handleLinkPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = codeToLink.trim().toUpperCase();
    if (!clean.startsWith('RAF-')) {
      setLinkError('يجب أن يبدأ كود المريض بـ RAF-');
      return;
    }

    setLinking(true);
    setLinkError('');

    try {
      const res = await linkCaregiverToPatient(clean, profile.uid);
      if (res.success) {
        showToast(res.message);
        const updatedCodes = Array.from(new Set([...(profile.linkedPatientCodes || []), clean]));
        const updatedProfile: UserProfile = {
          ...profile,
          linkedPatientCodes: updatedCodes,
          activePatientCode: clean,
        };
        onRefreshProfile(updatedProfile);
        setActiveCode(clean);
        setCodeToLink('');
        setCurrentTab('patients');
      } else {
        setLinkError(res.message);
      }
    } catch (err: any) {
      setLinkError(err?.message || 'فشل الربط بالمريض');
    } finally {
      setLinking(false);
    }
  };

  // فك الارتباط
  const handleUnlinkPatient = async (codeToUnlink: string) => {
    if (!confirm(`هل أنت متأكد من فك الارتباط بالمريض (${codeToUnlink})؟`)) return;

    try {
      await unlinkCaregiverFromPatient(codeToUnlink, profile.uid);
      const remainingCodes = (profile.linkedPatientCodes || []).filter((c) => c !== codeToUnlink);
      const updatedProfile: UserProfile = {
        ...profile,
        linkedPatientCodes: remainingCodes,
        activePatientCode: remainingCodes[0] || '',
      };
      onRefreshProfile(updatedProfile);
      setActiveCode(remainingCodes[0] || '');
      showToast('تم فك الارتباط بنجاح.');
    } catch (err) {
      showToast('تعذر فك الارتباط.');
    }
  };

  // حفظ تعديل المخزون
  const handleSaveStock = async (medId: string) => {
    if (!activeCode) return;
    try {
      await updateMedicationStockByCaregiver(activeCode, medId, newStockVal);
      setEditingStockMedId(null);
      showToast('تم تحديث المخزون لدى المريض.');
    } catch (err) {
      showToast('تعذر تحديث المخزون.');
    }
  };

  const now = new Date();
  const todayStr = formatDateYMD(now);
  const past7 = new Date();
  past7.setDate(now.getDate() - 6);
  const past7Str = formatDateYMD(past7);

  const adherence7Days = patientDoc
    ? calculateAdherence(patientDoc.state, past7Str, todayStr, now)
    : null;
  const adherenceToday = patientDoc
    ? calculateAdherence(patientDoc.state, todayStr, todayStr, now)
    : null;

  const todayDoses = (patientDoc?.state.medications || []).flatMap((med) => {
    return med.times.map((t) => {
      const key = `${med.id}_${todayStr}_${t}`;
      const log = patientDoc?.state.doseLogs[key];
      return { med, time: t, log, key };
    });
  });

  const alertsList: PatientAlert[] = [...(patientDoc?.alerts || [])].reverse();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1518] text-slate-800 dark:text-slate-100 flex flex-col antialiased transition-colors duration-200">
      {/* شريط علوي مميز للمرافق (Cyan Theme) */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-cyan-100 dark:border-cyan-950/80 pt-[env(safe-area-inset-top,0px)] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-cyan-600 to-teal-800 text-white flex items-center justify-center shadow-md shadow-cyan-600/20 shrink-0">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  رفيقي — لوحة المرافق
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                  مرافق
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {todayArabic}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentTab('add_patient')}
              className="h-9 px-3 bg-cyan-50 dark:bg-cyan-950/50 hover:bg-cyan-100 text-cyan-700 dark:text-cyan-300 rounded-xl text-xs font-bold transition flex items-center gap-1 border border-cyan-200 dark:border-cyan-800"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>إضافة مريض</span>
            </button>
          </div>
        </div>
      </header>

      {/* المحتوى الرئيسي للمرافق */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-4 pb-[max(env(safe-area-inset-bottom,0px)+80px,96px)]">
        {/* تبويب: مرضاي */}
        {currentTab === 'patients' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  المرضى المرتبطين بك
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  متابعة الجرعات والقياسات والمخزون في الوقت الحقيقي
                </p>
              </div>
            </div>

            {/* محدد المرضى إذا وجد أكثر من مريض */}
            {profile.linkedPatientCodes && profile.linkedPatientCodes.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {profile.linkedPatientCodes.map((code) => (
                  <button
                    key={code}
                    onClick={() => setActiveCode(code)}
                    className={`px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition flex items-center gap-2 border ${
                      activeCode === code
                        ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>{code}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {/* حالة عدم وجود مرضى */}
            {(!profile.linkedPatientCodes || profile.linkedPatientCodes.length === 0) ? (
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 text-center border border-dashed border-slate-300 dark:border-slate-700">
                <div className="w-16 h-16 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 rounded-3xl flex items-center justify-center mx-auto mb-3">
                  <Users className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  لم تقم بربط أي مريض حتى الآن
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  اطلب من المريض كود الربط الخاص به (مثال: RAF-A1B2C3D4) واضغط الزر أدناه لإضافته.
                </p>
                <button
                  onClick={() => setCurrentTab('add_patient')}
                  className="mt-4 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  إضافة مريض الآن بالكود
                </button>
              </div>
            ) : syncLoading && !patientDoc ? (
              <div className="p-12 text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-cyan-600 mx-auto mb-3" />
                <span className="text-xs text-slate-500">جاري تحميل سجل المريض ({activeCode})...</span>
              </div>
            ) : patientDoc ? (
              <div className="space-y-4">
                {/* كارت ملخص المريض المختار */}
                <div className="bg-cyan-50/70 dark:bg-cyan-950/40 rounded-3xl p-4 border border-cyan-200 dark:border-cyan-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-cyan-600 text-white flex items-center justify-center font-bold text-base">
                      {patientDoc.patientName ? patientDoc.patientName.charAt(0) : 'م'}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {patientDoc.patientName || 'المريض'}
                      </h3>
                      <div className="text-[11px] font-mono text-cyan-700 dark:text-cyan-300">
                        كود المريض: {activeCode}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      متصل لحظياً
                    </span>
                    <button
                      onClick={() => handleUnlinkPatient(activeCode)}
                      title="فك الارتباط بهذا المريض"
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* نسبة الالتزام الحقيقية للمريض (محسوبة بدقة من السجلات الفعلية) */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-600" />
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        التزام المريض بالجرعات (حقيقي)
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-500">حسب السجلات المستحقة</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    {(() => {
                      const theme7 = getAdherenceTheme(adherence7Days?.percent ?? null);
                      return (
                        <div className={`p-3 rounded-2xl border ${theme7.cardBg} ${theme7.borderColor}`}>
                          <div className={`text-xl font-black ${theme7.textColor}`}>
                            {theme7.displayValue}
                          </div>
                          <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                            {adherence7Days?.percent !== null && adherence7Days?.percent !== undefined
                              ? `آخر 7 أيام (${adherence7Days.taken}/${adherence7Days.due})`
                              : theme7.labelText}
                          </div>
                        </div>
                      );
                    })()}

                    {(() => {
                      const themeToday = getAdherenceTheme(adherenceToday?.percent ?? null);
                      return (
                        <div className={`p-3 rounded-2xl border ${themeToday.cardBg} ${themeToday.borderColor}`}>
                          <div className={`text-xl font-black ${themeToday.textColor}`}>
                            {themeToday.displayValue}
                          </div>
                          <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                            {adherenceToday?.percent !== null && adherenceToday?.percent !== undefined
                              ? `اليوم (${adherenceToday.taken}/${adherenceToday.due})`
                              : themeToday.labelText}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* جرعات اليوم للمريض */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                    <Pill className="w-4 h-4 text-cyan-600" />
                    جدول جرعات اليوم ({todayDoses.length})
                  </h4>

                  {todayDoses.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-4">
                      لا توجد جرعات مجدولة للمريض لهذا اليوم.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {todayDoses.map(({ med, time, log, key }) => {
                        const isTaken = log?.status === 'taken';
                        const isSkipped = log?.status === 'skipped';
                        const isSnoozed = log?.status === 'snoozed';

                        return (
                          <div
                            key={key}
                            className={`flex items-center justify-between p-3.5 rounded-2xl border transition ${
                              isTaken
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                                : isSkipped
                                ? 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
                                {med.name} ({med.dose} {med.form})
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold" dir="ltr">
                                  {time}
                                </span>
                                <span>•</span>
                                <span>{med.foodTiming}</span>
                              </div>
                            </div>

                            <div>
                              {isTaken ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 rounded-full">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> أخذ الجرعة
                                </span>
                              ) : isSkipped ? (
                                <span className="text-[11px] font-bold text-slate-400 bg-slate-200 dark:bg-slate-700 px-2.5 py-1 rounded-full">
                                  تم التخطي
                                </span>
                              ) : isSnoozed ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-950 px-2.5 py-1 rounded-full">
                                  <Clock className="w-3.5 h-3.5" /> مؤجلة
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-600 bg-cyan-100 dark:bg-cyan-950 px-2.5 py-1 rounded-full">
                                  <Clock className="w-3.5 h-3.5" /> في الانتظار
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* مخزون الأدوية مع إمكانية التعديل للمرافق */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                    <Pill className="w-4 h-4 text-cyan-600" />
                    مخزون الأدوية للمريض
                  </h4>

                  <div className="space-y-2">
                    {(patientDoc.state.medications || []).map((med) => {
                      const isEditing = editingStockMedId === med.id;
                      const isLow = med.stock <= 5;
                      return (
                        <div
                          key={med.id}
                          className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-100">{med.name}</div>
                            <div className={`text-[11px] ${isLow ? 'text-rose-500 font-bold' : 'text-slate-500'}`}>
                              المخزون المسجل: {med.stock} {med.form} {isLow && '⚠️ قرب النفاد'}
                            </div>
                          </div>

                          <div>
                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  value={newStockVal}
                                  onChange={(e) => setNewStockVal(Number(e.target.value))}
                                  className="w-16 h-8 bg-white dark:bg-slate-800 border border-slate-300 rounded-lg text-center font-bold text-xs"
                                />
                                <button
                                  onClick={() => handleSaveStock(med.id)}
                                  className="h-8 px-2.5 bg-cyan-600 text-white rounded-lg text-xs font-bold"
                                >
                                  حفظ
                                </button>
                                <button
                                  onClick={() => setEditingStockMedId(null)}
                                  className="h-8 px-2 bg-slate-200 text-slate-600 rounded-lg text-xs"
                                >
                                  إلغاء
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingStockMedId(med.id);
                                  setNewStockVal(med.stock);
                                }}
                                className="text-xs text-cyan-600 dark:text-cyan-400 font-bold hover:underline flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" />
                                تعديل المخزون
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* آخر القياسات الحيوية للمريض */}
                {(patientDoc.state.vitals || []).length > 0 && (
                  <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-cyan-600" />
                      آخر القياسات الحيوية للمريض
                    </h4>

                    <div className="space-y-2">
                      {patientDoc.state.vitals.slice(0, 5).map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                              {v.type === 'bp'
                                ? `ضغط دم: ${v.systolic}/${v.diastolic} mmHg`
                                : v.type === 'sugar'
                                ? `سكر: ${v.value} mg/dL (${v.sugarContext === 'fasting' ? 'صائم' : 'بعد الأكل'})`
                                : v.type === 'pulse'
                                ? `نبض: ${v.value} bpm`
                                : `حرارة: ${v.value} °C`}
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(v.dateTime).toLocaleDateString('ar-EG', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* تبويب: التنبيهات الحية */}
        {currentTab === 'alerts' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                سجل التنبيهات الحية
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                إشعارات فورية عند قيام المريض بأخذ الجرعة أو تأجيلها أو تخطيها
              </p>
            </div>

            {alertsList.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 text-center border border-dashed border-slate-300 dark:border-slate-700">
                <Bell className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  لا توجد تنبيهات مسجلة بعد
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  عندما يقوم المريض بتأكيد جرعاته في تطبيقه ستظهر التنبيهات هنا مباشرة.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {alertsList.map((alert) => {
                  const isTaken = alert.type === 'taken';
                  const isSkipped = alert.type === 'skipped';

                  return (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-2xl border flex items-start gap-3 transition ${
                        isTaken
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                          : isSkipped
                          ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                          : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isTaken
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60'
                            : isSkipped
                            ? 'bg-slate-200 text-slate-500 dark:bg-slate-700'
                            : 'bg-amber-100 text-amber-600 dark:bg-amber-900/60'
                        }`}
                      >
                        {isTaken ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : isSkipped ? (
                          <AlertCircle className="w-5 h-5" />
                        ) : (
                          <Clock className="w-5 h-5" />
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            {alert.title}
                          </h4>
                          <span className="text-[10px] text-slate-400">
                            {new Date(alert.timestamp).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          {alert.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* تبويب: إضافة مريض بالكود */}
        {currentTab === 'add_patient' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                إضافة مريض جديد بكود الربط
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                اربط حسابك بهاتف المريض لتتمكن من متابعة جرعاته وتلقي تنبيهاته
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700 shadow-xs">
              <form onSubmit={handleLinkPatient} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    كود ربط المريض (RAF-XXXXXXXXXX) *
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    required
                    value={codeToLink}
                    onChange={(e) => setCodeToLink(e.target.value.toUpperCase())}
                    placeholder="RAF-XXXXXXXX"
                    className="w-full h-12 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 font-mono text-base font-black uppercase text-center outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                    يمكن للمريض العثور على هذا الكود في شاشة الإعدادات أو أعلى تطبيقه ونسخه لك.
                  </p>
                </div>

                {linkError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-semibold">
                    {linkError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={linking || !codeToLink.trim()}
                  className="w-full h-12 bg-cyan-600 hover:bg-cyan-700 active:scale-98 text-white rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50"
                >
                  {linking ? 'جاري ربط المريض بالخادم...' : 'ربط المريض الآن'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* تبويب: الإعدادات الخاصة بالمرافق */}
        {currentTab === 'settings' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                إعدادات حساب المرافق
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                إدارة ملفك الشخصي وتخصيص المظهر وحجم الخط
              </p>
            </div>

            {/* بطاقة الحساب (مرافق دائم) */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-100 dark:bg-cyan-900/60 text-cyan-600 flex items-center justify-center font-bold">
                    <HeartHandshake className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {profile.displayName}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300">
                        دور مرافق
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {profile.email} • {profile.phone ? `${profile.countryCode}${profile.phone}` : 'بدون هاتف'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onSignOut}
                  className="relative z-10 min-h-[48px] px-4 py-2 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-900 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs select-none pointer-events-auto"
                  style={{ touchAction: 'manipulation' }}
                >
                  <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            </div>

            {/* تخصيص المظهر وحجم الخط */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-600" />
                المظهر وسهولة القراءة
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  حجم الخط
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'normal', label: 'عادي (16px)' },
                    { id: 'large', label: 'كبير (18px)' },
                    { id: 'huge', label: 'كبير جداً (21px)' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => onUpdateSettings({ ...settings, fontSize: f.id as FontSizeLevel })}
                      className={`h-11 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                        settings.fontSize === f.id
                          ? 'bg-cyan-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => onUpdateSettings({ ...settings, darkMode: !settings.darkMode })}
                  className={`h-12 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition ${
                    settings.darkMode
                      ? 'bg-slate-900 text-white border-slate-700'
                      : 'bg-slate-50 text-slate-700 border-slate-300'
                  }`}
                >
                  {settings.darkMode ? <Moon className="w-4 h-4 text-amber-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                  <span>{settings.darkMode ? 'الوضع الداكن' : 'الوضع الفاتح'}</span>
                </button>

                <button
                  onClick={() => onUpdateSettings({ ...settings, highContrast: !settings.highContrast })}
                  className={`h-12 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition ${
                    settings.highContrast
                      ? 'bg-black text-yellow-300 border-yellow-400'
                      : 'bg-slate-50 text-slate-700 border-slate-300'
                  }`}
                >
                  <Type className="w-4 h-4" />
                  <span>تباين عالي</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* تبويب: من نحن */}
        {currentTab === 'about' && <AboutTab />}
      </main>

      {/* الشريط السفلي الخاص بالمرافق فقط (5 عناصر مخصصة) */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-cyan-100 dark:border-cyan-950/80 pb-[max(env(safe-area-inset-bottom,0px),8px)] pt-1.5 transition-colors">
        <div className="max-w-md mx-auto grid grid-cols-5 px-1">
          {[
            { id: 'patients', label: 'مرضاي', icon: Users },
            { id: 'alerts', label: 'التنبيهات', icon: Bell },
            { id: 'add_patient', label: 'إضافة مريض', icon: UserPlus },
            { id: 'settings', label: 'الإعدادات', icon: Settings },
            { id: 'about', label: 'من نحن', icon: Info },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id as CaregiverTabType)}
                className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all active:scale-95 ${
                  isActive
                    ? 'text-cyan-600 dark:text-cyan-400 font-bold'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <Icon className={`w-6 h-6 transition-transform ${isActive ? 'scale-110' : ''}`} />
                <span className="text-[11px] mt-1 leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
