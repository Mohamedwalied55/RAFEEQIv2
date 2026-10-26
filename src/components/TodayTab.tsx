/**
 * شاشة «اليوم»: جرعات اليوم مرتبة بالوقت مع أزرار الإجراءات وشريط الالتزام وكارت الماء
 */
import React, { useState } from 'react';
import {
  CheckCircle,
  Clock,
  XCircle,
  Pill,
  Droplets,
  Share2,
  AlertCircle,
  Edit3,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Medication,
  DoseLog,
  DailyReminder,
  WaterReminderConfig,
  CaregiverConfig,
  TodayDoseInstance,
} from '../types';
import { WaterReminderCard } from './WaterReminderCard';
import { openWhatsAppChat, buildDoseTakenMessage, buildDoseDelayedMessage } from '../utils/whatsapp';
import { calculateAdherence, getAdherenceTheme, formatDateYMD } from '../utils/storage';

interface TodayTabProps {
  medications: Medication[];
  doseLogs: Record<string, DoseLog>;
  reminders: DailyReminder[];
  water: WaterReminderConfig;
  caregiverConfig: CaregiverConfig;
  patientName: string;
  onTakeDose: (medId: string, doseKey: string, doseAmount?: number) => void;
  onSnoozeDose: (medId: string, doseKey: string, minutes: number) => void;
  onSkipDose: (medId: string, doseKey: string) => void;
  onUpdateWater: (water: WaterReminderConfig) => void;
  onToggleReminder: (reminderId: string) => void;
}

export const TodayTab: React.FC<TodayTabProps> = ({
  medications,
  doseLogs,
  reminders,
  water,
  caregiverConfig,
  patientName,
  onTakeDose,
  onSnoozeDose,
  onSkipDose,
  onUpdateWater,
  onToggleReminder,
}) => {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [tempDose, setTempDose] = useState<number>(1);

  const now = new Date();
  const todayStr = formatDateYMD(now);
  const dayOfWeek = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // تجميع كل جرعات اليوم المجدولة
  const todayDoses: TodayDoseInstance[] = [];

  medications.forEach((med) => {
    if (!med.active) return;
    if (!med.days.includes(dayOfWeek)) return;
    if (med.startDate && todayStr < med.startDate) return;
    if (med.endDate && todayStr > med.endDate) return;

    med.times.forEach((t) => {
      const key = `${med.id}_${todayStr}_${t}`;
      const log = doseLogs[key];
      const [h, m] = t.split(':').map(Number);
      const scheduledMinutes = h * 60 + m;
      const isPast = currentMinutes > scheduledMinutes;
      const isDelayed = isPast && (!log || log.status === 'snoozed');

      todayDoses.push({
        key,
        medId: med.id,
        medication: med,
        scheduledTime: t,
        date: todayStr,
        log,
        isPast,
        isDelayed,
      });
    });
  });

  // ترتيب الجرعات زمنياً
  todayDoses.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  // حساب الالتزام الحقيقي الموثق وفق القواعد الصارمة
  const todayAdherence = calculateAdherence(
    { medications, doseLogs },
    todayStr,
    todayStr,
    now
  );
  const adherenceTheme = getAdherenceTheme(todayAdherence.percent);

  const handleStartEditDose = (dose: TodayDoseInstance) => {
    setEditingKey(dose.key);
    setTempDose(dose.log?.takenDose || dose.medication.dose);
  };

  const handleSaveCustomDose = (dose: TodayDoseInstance) => {
    onTakeDose(dose.medId, dose.key, tempDose);
    setEditingKey(null);
  };

  const handleSendWhatsAppTaken = (dose: TodayDoseInstance) => {
    if (!caregiverConfig.phone) return;
    const msg = buildDoseTakenMessage(
      patientName,
      dose.medication.name,
      dose.log?.takenDose || dose.medication.dose,
      dose.medication.form,
      dose.scheduledTime
    );
    openWhatsAppChat(
      {
        name: caregiverConfig.name,
        phone: caregiverConfig.phone,
        dialCode: caregiverConfig.countryCode,
      },
      msg
    );
  };

  const handleSendWhatsAppDelayed = (dose: TodayDoseInstance) => {
    if (!caregiverConfig.phone) return;
    const [h, m] = dose.scheduledTime.split(':').map(Number);
    const lateMinutes = Math.max(0, currentMinutes - (h * 60 + m));
    const msg = buildDoseDelayedMessage(patientName, dose.medication.name, dose.scheduledTime, lateMinutes);
    openWhatsAppChat(
      {
        name: caregiverConfig.name,
        phone: caregiverConfig.phone,
        dialCode: caregiverConfig.countryCode,
      },
      msg
    );
  };

  return (
    <div className="space-y-4 pb-20">
      {/* شريط الالتزام بالدواء اليوم */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              التزام اليوم بالدواء
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {todayAdherence.percent === null
                ? 'لا توجد جرعات مستحقة قد مضى وقتها بعد اليوم'
                : `${todayAdherence.taken} من أصل ${todayAdherence.due} جرعات مستحقة`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className={`text-2xl font-black ${adherenceTheme.textColor}`}>
              {adherenceTheme.displayValue}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${adherenceTheme.badgeBg} ${adherenceTheme.badgeText}`}>
              {adherenceTheme.labelText}
            </span>
          </div>
        </div>

        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${adherenceTheme.bgColor}`}
            style={{ width: `${todayAdherence.percent ?? 0}%` }}
          />
        </div>
      </div>

      {/* كارت الماء */}
      <WaterReminderCard water={water} onUpdateWater={onUpdateWater} />

      {/* قائمة جرعات اليوم */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            جدول جرعات اليوم ({todayDoses.length})
          </h3>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            مرتبة حسب موعد الأخذ
          </span>
        </div>

        {todayDoses.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border border-dashed border-slate-300 dark:border-slate-700">
            <div className="w-12 h-12 bg-teal-50 dark:bg-teal-950 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Pill className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              لا توجد جرعات مجدولة لهذا اليوم
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              أضف أدويتك من تبويب «الأدوية» لتظهر مواعيدها هنا تلقائياً.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayDoses.map((dose) => {
              const status = dose.log?.status;
              const isTaken = status === 'taken';
              const isSkipped = status === 'skipped';
              const isSnoozed = status === 'snoozed';
              const isEditing = editingKey === dose.key;

              return (
                <div
                  key={dose.key}
                  className={`rounded-2xl p-4 border transition-all ${
                    isTaken
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                      : isSkipped
                      ? 'bg-slate-100/70 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700 opacity-75'
                      : dose.isDelayed
                      ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* معلومات الدواء والموعد */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                          isTaken
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60'
                            : isSkipped
                            ? 'bg-slate-200 text-slate-500 dark:bg-slate-700'
                            : dose.isDelayed
                            ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/60 animate-pulse'
                            : 'bg-teal-100 text-teal-600 dark:bg-teal-900/60'
                        }`}
                      >
                        <Pill className="w-5 h-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                            {dose.medication.name}
                          </h4>
                          <span
                            className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                            dir="ltr"
                          >
                            {dose.scheduledTime}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                          <span>
                            الجرعة:{' '}
                            <strong className="text-slate-700 dark:text-slate-200">
                              {dose.log?.takenDose || dose.medication.dose} {dose.medication.form}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>{dose.medication.foodTiming}</span>
                          {dose.medication.stock <= 5 && (
                            <>
                              <span>•</span>
                              <span className="text-rose-500 font-semibold">
                                متبقي {dose.medication.stock} فقط
                              </span>
                            </>
                          )}
                        </div>

                        {/* حالة الجرعة بالرمز والنص */}
                        <div className="mt-2 flex items-center gap-2">
                          {isTaken && (
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> تم الأخذ (
                              {new Date(dose.log!.timestamp).toLocaleTimeString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              )
                            </span>
                          )}
                          {isSkipped && (
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> تم التخطي
                            </span>
                          )}
                          {isSnoozed && (
                            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> مؤجلة
                            </span>
                          )}
                          {!isTaken && !isSkipped && dose.isDelayed && (
                            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> متأخرة
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* أزرار الإجراءات السريعة */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {!isTaken && (
                        <button
                          onClick={() => onTakeDose(dose.medId, dose.key)}
                          className="h-10 px-3.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1"
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                          أخذتها
                        </button>
                      )}

                      {!isTaken && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onSnoozeDose(dose.medId, dose.key, 10)}
                            title="تأجيل 10 دقائق"
                            className="h-8 px-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[11px] font-semibold rounded-lg transition"
                          >
                            تأجيل
                          </button>
                          <button
                            onClick={() => onSkipDose(dose.medId, dose.key)}
                            title="تخطي الجرعة"
                            className="h-8 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold rounded-lg transition"
                          >
                            تخطي
                          </button>
                        </div>
                      )}

                      {/* زر تعديل الجرعة لموعد محدد */}
                      <button
                        onClick={() => handleStartEditDose(dose)}
                        className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline flex items-center justify-end gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        تعديل الجرعة
                      </button>
                    </div>
                  </div>

                  {/* مود التعديل الفردي للجرعة */}
                  {isEditing && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 bg-teal-50/50 dark:bg-slate-900/50 p-2.5 rounded-xl">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        جرعة هذا الموعد فقط:
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={tempDose}
                          onChange={(e) => setTempDose(Number(e.target.value))}
                          className="w-16 h-8 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-center font-bold text-xs"
                        />
                        <button
                          onClick={() => handleSaveCustomDose(dose)}
                          className="h-8 px-3 bg-teal-600 text-white rounded-lg text-xs font-bold"
                        >
                          تأكيد وأخذت
                        </button>
                        <button
                          onClick={() => setEditingKey(null)}
                          className="h-8 px-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-xs"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}

                  {/* إشعار واتساب للمرافق */}
                  {caregiverConfig.enabled && caregiverConfig.phone && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        طمأنة المرافق ({caregiverConfig.name || 'المرافق'})
                      </span>
                      {isTaken ? (
                        <button
                          onClick={() => handleSendWhatsAppTaken(dose)}
                          className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <Share2 className="w-3 h-3" /> أرسل واتساب: تم أخذ الجرعة
                        </button>
                      ) : dose.isDelayed ? (
                        <button
                          onClick={() => handleSendWhatsAppDelayed(dose)}
                          className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                        >
                          <Share2 className="w-3 h-3" /> أرسل واتساب: تنبيه تأخر
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* التذكيرات اليومية */}
      {reminders.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
            التذكيرات والأنشطة الصحية اليومية
          </h3>
          <div className="space-y-2">
            {reminders.map((rem) => (
              <div
                key={rem.id}
                onClick={() => onToggleReminder(rem.id)}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                  rem.active
                    ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'
                    : 'bg-slate-100/50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={rem.active}
                    onChange={() => {}}
                    className="w-4 h-4 text-teal-600 rounded-md focus:ring-teal-500 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {rem.title}
                    </div>
                    {rem.notes && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {rem.notes}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400" dir="ltr">
                  {rem.times.join('، ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
