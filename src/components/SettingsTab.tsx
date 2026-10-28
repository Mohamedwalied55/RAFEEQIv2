/**
 * شاشة الإعدادات الخاصة بالمريض:
 * - كود الربط RAF-XXXXXXXXXX مع زر النسخ والمشاركة عبر واتساب
 * - المنبّه والأذونات والصوت والخط والوضع الداكن
 * - الدور ثابت ولا يمكن تبديله
 */
import React, { useEffect, useState } from 'react';
import {
  Settings,
  Bell,
  Volume2,
  Type,
  Moon,
  Sun,
  Shield,
  LogOut,
  User,
  HeartHandshake,
  Check,
  Eye,
  Clock,
  Copy,
  Share2,
} from 'lucide-react';
import { AppSettings, CaregiverConfig, UserProfile, FontSizeLevel } from '../types';
import { PhoneWithCountryPicker } from './PhoneWithCountryPicker';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { speakArabicText, playAlarmSound, stopAlarmSound } from '../utils/audio';
import { openWhatsAppChat } from '../utils/whatsapp';

interface SettingsTabProps {
  settings: AppSettings;
  caregiverConfig: CaregiverConfig;
  profile: UserProfile | null;
  onUpdateSettings: (settings: AppSettings) => void;
  onUpdateCaregiver: (cfg: CaregiverConfig) => void;
  onOpenPermissions: () => void;
  onTestAlarm: () => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  caregiverConfig,
  profile,
  onUpdateSettings,
  onUpdateCaregiver,
  onOpenPermissions,
  onTestAlarm,
  onOpenAuth,
  onSignOut,
}) => {
  const [testingVoice, setTestingVoice] = useState(false);
  const [testingChime, setTestingChime] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // مسودة بيانات المرافقين: لا تُحفظ إلا عند الضغط على زر «حفظ»
  const [cgDraft, setCgDraft] = useState<CaregiverConfig>(caregiverConfig);
  useEffect(() => {
    setCgDraft(caregiverConfig);
  }, [caregiverConfig]);
  const cgDirty = JSON.stringify(cgDraft) !== JSON.stringify(caregiverConfig);
  const digits = (v?: string) => (v || '').replace(/\D/g, '');
  const cgPhoneInvalid =
    (cgDraft.enabled && digits(cgDraft.phone).length > 0 && digits(cgDraft.phone).length < 7) ||
    (cgDraft.enabled && digits(cgDraft.secondaryPhone).length > 0 && digits(cgDraft.secondaryPhone).length < 7);

  const pairingCode = profile?.pairingCode || 'RAF-DEMO1234';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleShareCodeWhatsApp = () => {
    const text = `السلام عليكم، هذا كود ربطي في تطبيق رفيقي لمتابعة جرعاتي ورعايتي الصحية اليومية:\n\n*${pairingCode}*\n\nيرجى إدخاله في خانة «ربط مريض» في تطبيق رفيقي.`;
    openWhatsAppChat(
      {
        name: caregiverConfig.name || 'المرافق',
        phone: caregiverConfig.phone || '',
        dialCode: caregiverConfig.countryCode || '+20',
      },
      text
    );
  };

  const handleTestVoice = async () => {
    setTestingVoice(true);
    await speakArabicText('مرحباً بك، هذا اختبار للصوت العربي في تطبيق رفيقي لمساعدتك في مواعيد أدويتك.');
    setTestingVoice(false);
  };

  const handleToggleChimeTest = () => {
    if (testingChime) {
      stopAlarmSound();
      setTestingChime(false);
    } else {
      playAlarmSound(settings.soundVolume);
      setTestingChime(true);
      setTimeout(() => {
        stopAlarmSound();
        setTestingChime(false);
      }, 6000);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
          إعدادات المريض والتخصيص
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          تخصيص المنبّه، كود ربط المرافق، الصوت، وحجم الخط
        </p>
      </div>

      {/* كارت كود الربط البارز للمريض مع زر النسخ والمشاركة عبر واتساب */}
      <div className="bg-linear-to-br from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-950/30 rounded-3xl p-5 border-2 border-teal-500/40 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold">
              RAF
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                كود الربط الخاص بك
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                شاركه مع أسرتك أو المرافق ليتابع مواعيدك من جهازه
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200">
            حساب مريض
          </span>
        </div>

        {/* عرض الكود */}
        <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-teal-200 dark:border-teal-800 flex items-center justify-between">
          <span className="font-mono text-xl font-black text-teal-600 dark:text-teal-400 tracking-wider" dir="ltr">
            {pairingCode}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyCode}
              className="h-9 px-3 bg-teal-50 dark:bg-teal-950 hover:bg-teal-100 text-teal-700 dark:text-teal-300 rounded-xl text-xs font-bold transition flex items-center gap-1 border border-teal-200 dark:border-teal-800"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'تم النسخ!' : 'نسخ الكود'}</span>
            </button>
          </div>
        </div>

        {/* زر المشاركة عبر واتساب */}
        <button
          onClick={handleShareCodeWhatsApp}
          className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition"
        >
          <Share2 className="w-4 h-4" />
          مشاركة الكود مع المرافق عبر واتساب
        </button>
      </div>

      {/* بطاقة الحساب (الدور ثابت ولا يمكن تغييره) */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center font-bold">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {profile ? profile.displayName : 'مستخدم مريض (محلي)'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300">
                  دور مريض
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {profile?.email || 'بياناتك محفوظة محلياً على هذا الجهاز'}
              </p>
            </div>
          </div>

          {profile ? (
            <button
              type="button"
              onClick={onSignOut}
              className="relative z-10 min-h-[48px] px-4 py-2 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-900 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs select-none pointer-events-auto"
              style={{ touchAction: 'manipulation' }}
            >
              <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>تسجيل الخروج</span>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="min-h-[48px] px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 active:scale-95 transition flex items-center gap-1.5 cursor-pointer shadow-xs select-none"
            >
              <User className="w-4 h-4" />
              <span>دخول / حساب</span>
            </button>
          )}
        </div>

        {/* تنبيه الحساب الزائر المحلي */}
        {profile?.uid === 'guest_local' && (
          <div className="mt-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between gap-2">
            <div>
              <span className="font-bold">حساب زائر محلي:</span> بياناتك محفوظة على هذا الجهاز فقط ولا تتم مزامنتها سحابياً.
            </div>
            <button
              onClick={onOpenAuth}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-bold shrink-0 transition"
            >
              تسجيل حساب سحابي
            </button>
          </div>
        )}
      </div>

      {/* إعدادات المنبّه والأذونات */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Bell className="w-4 h-4 text-teal-600" />
            منبّه الأدوية ونظام التشغيل
          </h3>
          <button
            onClick={onOpenPermissions}
            className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
          >
            <Shield className="w-3.5 h-3.5" />
            معالج الأذونات
          </button>
        </div>

        {/* زر اختبار المنبّه المباشر */}
        <div className="p-3.5 bg-teal-50 dark:bg-teal-950/40 rounded-2xl border border-teal-200 dark:border-teal-800 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-teal-800 dark:text-teal-200">
              اختبار المنبّه (10 ثوانٍ)
            </div>
            <p className="text-[11px] text-teal-600 dark:text-teal-400 mt-0.5">
              يجدول إشعاراً بعد 10 ثوانٍ لتجربة رنين المنبّه والتطبيق مقفل.
            </p>
          </div>
          <button
            onClick={onTestAlarm}
            className="shrink-0 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            بدء الاختبار
          </button>
        </div>

        {/* تكرار المنبّه والدقائق */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              عدد تكرارات المنبّه (1-5)
            </label>
            <select
              value={settings.repeatAlarmCount}
              onChange={(e) =>
                onUpdateSettings({ ...settings, repeatAlarmCount: Number(e.target.value) })
              }
              className="w-full h-11 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 font-bold"
            >
              {[1, 2, 3, 4, 5].map((c) => (
                <option key={c} value={c}>
                  {c} مرات
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              فترة التكرار بالدقائق
            </label>
            <select
              value={settings.repeatAlarmMinutes}
              onChange={(e) =>
                onUpdateSettings({ ...settings, repeatAlarmMinutes: Number(e.target.value) })
              }
              className="w-full h-11 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 font-bold"
            >
              <option value={3}>كل 3 دقائق</option>
              <option value={5}>كل 5 دقائق</option>
              <option value={10}>كل 10 دقائق</option>
              <option value={15}>كل 15 دقيقة</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100 dark:border-slate-700">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              دقائق التأجيل (Snooze)
            </label>
            <select
              value={settings.snoozeMinutes}
              onChange={(e) =>
                onUpdateSettings({ ...settings, snoozeMinutes: Number(e.target.value) })
              }
              className="w-full h-11 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 font-bold"
            >
              <option value={5}>5 دقائق</option>
              <option value={10}>10 دقائق</option>
              <option value={15}>15 دقيقة</option>
              <option value={30}>30 دقيقة</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              تنبيه قرب نفاد المخزون
            </label>
            <select
              value={settings.lowStockThresholdDays}
              onChange={(e) =>
                onUpdateSettings({ ...settings, lowStockThresholdDays: Number(e.target.value) })
              }
              className="w-full h-11 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 font-bold"
            >
              <option value={3}>قبل 3 أيام</option>
              <option value={5}>قبل 5 أيام</option>
              <option value={7}>قبل أسبوع</option>
            </select>
          </div>
        </div>
      </div>

      {/* إعدادات الصوت والنطق العربي */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-teal-600" />
          الصوت والنطق العربي (TTS)
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
              تفعيل الصوت والنطق
            </div>
            <div className="text-[11px] text-slate-500">
              قراءة اسم الدواء بصوت عربي عند رنين المنبّه
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.soundEnabled}
            onChange={(e) => onUpdateSettings({ ...settings, soundEnabled: e.target.checked })}
            className="w-5 h-5 text-teal-600 rounded-md focus:ring-teal-500 cursor-pointer"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleTestVoice}
            disabled={testingVoice}
            className="flex-1 h-11 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <Volume2 className="w-4 h-4 text-teal-600" />
            {testingVoice ? 'جاري نطق الصوت...' : 'اختبار الصوت العربي'}
          </button>
          <button
            onClick={handleToggleChimeTest}
            className="flex-1 h-11 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <Bell className="w-4 h-4 text-amber-500" />
            {testingChime ? 'إيقاف النغمة' : 'اختبار نغمة المنبّه'}
          </button>
        </div>
      </div>

      {/* إعدادات المرافقين (رقمين مع PhoneWithCountryPicker) */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-teal-600" />
            بيانات المرافقين للطمأنة عبر واتساب
          </h3>
          <input
            type="checkbox"
            checked={cgDraft.enabled}
            onChange={(e) => setCgDraft({ ...cgDraft, enabled: e.target.checked })}
            className="w-5 h-5 text-teal-600 rounded-md"
          />
        </div>

        {cgDraft.enabled && (
          <div className="space-y-4 pt-1">
            {/* المرافق الأساسي */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                المرافق الأساسي (الأول):
              </span>
              <input
                type="text"
                value={cgDraft.name}
                onChange={(e) => setCgDraft({ ...cgDraft, name: e.target.value })}
                placeholder="اسم المرافق (مثال: ابني محمد)"
                className="w-full h-11 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-xs outline-none"
              />
              <PhoneWithCountryPicker
                label="رقم واتساب المرافق الأساسي"
                countryCode={cgDraft.countryCode}
                phone={cgDraft.phone}
                onCountryCodeChange={(code) => setCgDraft({ ...cgDraft, countryCode: code })}
                onPhoneChange={(p) => setCgDraft({ ...cgDraft, phone: p })}
              />
            </div>

            {/* المرافق الثانوي */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                المرافق الثانوي (اختياري):
              </span>
              <input
                type="text"
                value={cgDraft.secondaryName || ''}
                onChange={(e) => setCgDraft({ ...cgDraft, secondaryName: e.target.value })}
                placeholder="اسم المرافق الثانوي (مثال: الطبيب أو الابنة)"
                className="w-full h-11 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-xs outline-none"
              />
              <PhoneWithCountryPicker
                label="رقم واتساب المرافق الثانوي"
                countryCode={cgDraft.secondaryCountryCode || '+20'}
                phone={cgDraft.secondaryPhone || ''}
                onCountryCodeChange={(code) => setCgDraft({ ...cgDraft, secondaryCountryCode: code })}
                onPhoneChange={(p) => setCgDraft({ ...cgDraft, secondaryPhone: p })}
              />
            </div>
          </div>
        )}
        <div className="pt-1">
          {cgPhoneInvalid && (
            <p className="text-[11px] text-rose-600 mb-2">رقم الهاتف قصير جداً. تأكد من كتابة الرقم كاملاً.</p>
          )}
          <button
            onClick={() => onUpdateCaregiver(cgDraft)}
            disabled={!cgDirty || cgPhoneInvalid}
            className="w-full h-12 rounded-xl bg-teal-600 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {cgDirty ? 'حفظ بيانات المرافقين' : 'لا توجد تغييرات للحفظ'}
          </button>
        </div>
      </div>

      {/* حالة النظام */}
      <DiagnosticsPanel />

      {/* حجم الخط والوضع الداكن والتباين العالي */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Eye className="w-4 h-4 text-teal-600" />
          الرؤية وسهولة القراءة لكبار السن
        </h3>

        {/* 3 مستويات لحجم الخط */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            حجم الخط (تكبير النصوص لسهولة القراءة)
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
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* الوضع الداكن والتباين العالي */}
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
  );
};
