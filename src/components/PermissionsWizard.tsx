/**
 * معالج الأذونات والمنبّهات (Permissions Wizard)
 * يرشد المستخدم خطوة بخطوة لتفعيل الإشعارات وتجاوز قيود توفير الطاقة في أندرويد
 */
import React, { useState, useEffect } from 'react';
import {
  Bell,
  Clock,
  BatteryCharging,
  Volume2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronLeft,
  ShieldCheck,
} from 'lucide-react';
import {
  checkAlarmPermissions,
  requestDisplayPermission,
  openExactAlarmSettings,
} from '../utils/nativeAlarms';
import { Capacitor } from '@capacitor/core';

interface PermissionsWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PermissionsWizard: React.FC<PermissionsWizardProps> = ({ isOpen, onClose }) => {
  const [displayPerm, setDisplayPerm] = useState(false);
  const [exactPerm, setExactPerm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(1);

  const refreshPerms = async () => {
    const res = await checkAlarmPermissions();
    setDisplayPerm(res.display);
    setExactPerm(res.exact);
  };

  useEffect(() => {
    if (isOpen) {
      refreshPerms();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestDisplay = async () => {
    setLoading(true);
    await requestDisplayPermission();
    await refreshPerms();
    setLoading(false);
  };

  const handleOpenExactSettings = async () => {
    await openExactAlarmSettings();
    setTimeout(refreshPerms, 2000);
  };

  const isNative = Capacitor.isNativePlatform();

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-teal-100 dark:border-teal-950 my-auto">
        {/* رأس المعالج */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-teal-50 dark:bg-teal-950/50 text-teal-600 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                معالج دقة المنبّه والتنبيهات
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                لضمان رنين المنبّه في موعده بدقة حتى والتطبيق مقفل
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* الخطوات الـ 4 */}
        <div className="mt-5 space-y-4">
          {/* الخطوة 1: إذن الإشعارات */}
          <div
            className={`p-4 rounded-2xl border transition ${
              displayPerm
                ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    displayPerm
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60'
                      : 'bg-teal-100 text-teal-700 dark:bg-teal-900/60'
                  }`}
                >
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      1. إذن عرض الإشعارات
                    </h3>
                    {displayPerm ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> مفعّل
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 rounded-full">
                        <XCircle className="w-3.5 h-3.5" /> غير مفعّل
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    يسمح للتطبيق بإظهار لافتة موعد الدواء وتكرار التنبيه الصوتي على الشاشة.
                  </p>
                </div>
              </div>
              {!displayPerm && (
                <button
                  onClick={handleRequestDisplay}
                  disabled={loading}
                  className="shrink-0 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  منح الإذن
                </button>
              )}
            </div>
          </div>

          {/* الخطوة 2: إذن المنبّهات الدقيقة Exact Alarm */}
          <div
            className={`p-4 rounded-2xl border transition ${
              exactPerm
                ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    exactPerm
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60'
                      : 'bg-teal-100 text-teal-700 dark:bg-teal-900/60'
                  }`}
                >
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      2. إذن المنبّهات الدقيقة (Exact Alarm)
                    </h3>
                    {exactPerm ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> مفعّل
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                        <XCircle className="w-3.5 h-3.5" /> مطلوب
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    ضروري في أندرويد 12 فأحدث لجدولة الموعد بالثانية دون تأخير نظام توفير الطاقة.
                  </p>
                </div>
              </div>
              {!exactPerm && isNative && (
                <button
                  onClick={handleOpenExactSettings}
                  className="shrink-0 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1"
                >
                  فتح الإعدادات <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* الخطوة 3: حماية البطارية والتشغيل التلقائي */}
          <div className="p-4 rounded-2xl border bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 flex items-center justify-center shrink-0">
                <BatteryCharging className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  3. ضبط البطارية (بدون قيود Unrestricted)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  أنظمة أندرويد الحديثة تغلق التطبيقات لتوفير الطاقة. يرجى الدخول لإعدادات تطبيق رفيقي على الهاتف واختيار:
                </p>
                <div className="mt-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl text-[11px] space-y-1.5 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                  <div>
                    📱 <strong>شاومي (Xiaomi/POCO):</strong> فعّل «التشغيل التلقائي Autostart» + موفر البطارية: «بلا قيود».
                  </div>
                  <div>
                    📱 <strong>سامسونج (Samsung):</strong> البطارية ← غير مقيّد (Unrestricted).
                  </div>
                  <div>
                    📱 <strong>أوبو وريلمي (Oppo/Realme):</strong> السماح بالنشاط في الخلفية وتشغيل التطبيق.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* الخطوة 4: وضع عدم الإزعاج */}
          <div className="p-4 rounded-2xl border bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-900/60 flex items-center justify-center shrink-0">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  4. استثناء المنبّه من «عدم الإزعاج»
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  إذا كنت تفعّل وضع النوم أو عدم الإزعاج ليلاً، أضف «منبّه الأدوية» لتطبيق رفيقي ضمن الاستثناءات المسموح لها بإصدار صوت ورنين.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* زر الإغلاق والإنهاء */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="w-full h-12 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition"
          >
            فهمت ذلك، تم ضبط الإعدادات
          </button>
        </div>
      </div>
    </div>
  );
};
