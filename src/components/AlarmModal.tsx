/**
 * شاشة المنبّه الكبيرة التفاعلية عند رنين الموعد والتطبيق مفتوح
 * صوت مستمر ونطق بالعربية وزرارين كبار (أخذتها / تأجيل)
 */
import React, { useEffect, useState } from 'react';
import { Check, Clock, X, Pill, Volume2, AlertCircle } from 'lucide-react';
import { Medication, DoseLog } from '../types';
import { playAlarmSound, stopAlarmSound, speakArabicText, stopAllSpeech } from '../utils/audio';

interface AlarmModalProps {
  medication: Medication;
  scheduledTime: string;
  doseKey: string;
  onTakeDose: (medId: string, doseKey: string, doseAmount?: number) => void;
  onSnoozeDose: (medId: string, doseKey: string, minutes: number) => void;
  onSkipDose: (medId: string, doseKey: string) => void;
  onClose: () => void;
}

export const AlarmModal: React.FC<AlarmModalProps> = ({
  medication,
  scheduledTime,
  doseKey,
  onTakeDose,
  onSnoozeDose,
  onSkipDose,
  onClose,
}) => {
  const [customDose, setCustomDose] = useState<number>(medication.dose);
  const [snoozeMinutes, setSnoozeMinutes] = useState(10);
  const [isSpeakingState, setIsSpeakingState] = useState(false);

  useEffect(() => {
    // تشغيل نغمة المنبّه المهدئة
    playAlarmSound(0.9);

    // نطق التنبيه باللغة العربية
    const spokenMessage = `حان موعد دواء ${medication.name}. الجرعة: ${medication.dose} ${medication.form}. ${medication.foodTiming}.`;
    speakArabicText(spokenMessage).then(() => {
      setIsSpeakingState(false);
    });

    return () => {
      stopAlarmSound();
      stopAllSpeech();
    };
  }, [medication]);

  const handleTake = () => {
    stopAlarmSound();
    stopAllSpeech();
    onTakeDose(medication.id, doseKey, customDose);
    onClose();
  };

  const handleSnooze = () => {
    stopAlarmSound();
    stopAllSpeech();
    onSnoozeDose(medication.id, doseKey, snoozeMinutes);
    onClose();
  };

  const handleSkip = () => {
    stopAlarmSound();
    stopAllSpeech();
    onSkipDose(medication.id, doseKey);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border-2 border-teal-500 animate-in fade-in zoom-in-95 duration-200">
        {/* شارة المنبّه الحركية */}
        <div className="text-center mb-6">
          <div className="relative inline-block">
            <div className="w-20 h-20 bg-teal-100 dark:bg-teal-950 text-teal-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner animate-pulse">
              <Pill className="w-10 h-10" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-white text-[10px] font-bold">
              !
            </div>
          </div>
          <span className="inline-block mt-3 px-3 py-1 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 rounded-full text-xs font-bold">
            ⏰ حان موعد الجرعة الآن ({scheduledTime})
          </span>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {medication.name}
          </h2>
          {medication.activeIngredient && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {medication.activeIngredient} • {medication.strength}
            </p>
          )}
        </div>

        {/* تفاصيل الجرعة وتوقيت الطعام */}
        <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">الجرعة المقررة:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCustomDose((prev) => Math.max(0.5, prev - 0.5))}
                className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center text-sm active:scale-95"
              >
                -
              </button>
              <span className="font-bold text-base text-teal-600 dark:text-teal-400 min-w-16 text-center">
                {customDose} {medication.form}
              </span>
              <button
                type="button"
                onClick={() => setCustomDose((prev) => prev + 0.5)}
                className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center text-sm active:scale-95"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">توقيت الأكل:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-md">
              {medication.foodTiming}
            </span>
          </div>

          {medication.notes && (
            <div className="text-xs text-slate-600 dark:text-slate-300 bg-teal-50/50 dark:bg-teal-950/20 p-2.5 rounded-xl border border-teal-100 dark:border-teal-900">
              💡 {medication.notes}
            </div>
          )}
        </div>

        {/* الأزرار الكبيرة التفاعلية */}
        <div className="space-y-3">
          {/* زر أخذتها */}
          <button
            onClick={handleTake}
            className="w-full h-14 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-teal-600/30 transition"
          >
            <Check className="w-6 h-6 stroke-[3]" />
            أخذت الجرعة الآن
          </button>

          {/* زر التأجيل */}
          <div className="flex gap-2">
            <button
              onClick={handleSnooze}
              className="flex-1 h-12 bg-amber-500 hover:bg-amber-600 active:scale-98 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition"
            >
              <Clock className="w-4 h-4" />
              تأجيل ({snoozeMinutes} دقائق)
            </button>
            <select
              value={snoozeMinutes}
              onChange={(e) => setSnoozeMinutes(Number(e.target.value))}
              className="w-24 h-12 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 text-center outline-none"
            >
              <option value={5}>5 دقائق</option>
              <option value={10}>10 دقائق</option>
              <option value={15}>15 دقيقة</option>
              <option value={30}>30 دقيقة</option>
              <option value={60}>ساعة</option>
            </select>
          </div>

          {/* زر تخطي الجرعة */}
          <button
            onClick={handleSkip}
            className="w-full h-10 text-xs text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 font-semibold transition text-center"
          >
            تخطي هذه الجرعة لليوم
          </button>
        </div>
      </div>
    </div>
  );
};
