/**
 * الشريط العلوي للتطبيق مع دعم Safe-Area وشارة الدور والتاريخ العربي
 */
import React from 'react';
import { Pill, Bell, Shield, User, Copy, Check } from 'lucide-react';
import { UserProfile } from '../types';

interface HeaderProps {
  profile: UserProfile | null;
  onOpenPermissions: () => void;
  onTestAlarm: () => void;
  onOpenRoleModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  onOpenPermissions,
  onTestAlarm,
}) => {
  const [copied, setCopied] = React.useState(false);

  const todayArabic = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  const handleCopyCode = () => {
    if (profile?.pairingCode) {
      navigator.clipboard.writeText(profile.pairingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 pt-[env(safe-area-inset-top,0px)] px-4 py-3 transition-colors">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
        {/* الشعار والاسم */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-teal-500 to-teal-700 text-white flex items-center justify-center shadow-md shadow-teal-500/20 shrink-0">
            <Pill className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight truncate">
                رفيقي
              </h1>
              {profile?.role && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    profile.role === 'caregiver'
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                  }`}
                >
                  {profile.role === 'caregiver' ? 'مرافق' : 'مريض'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
              {todayArabic}
            </p>
          </div>
        </div>

        {/* الأزرار العلوية السريعة */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* كود المريض إن وجد */}
          {profile?.role === 'patient' && profile.pairingCode && (
            <button
              onClick={handleCopyCode}
              title="نسخ كود الربط للمرافق"
              className="flex items-center gap-1 h-9 px-2.5 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 rounded-xl text-xs font-mono font-bold transition active:scale-95"
            >
              <span>{profile.pairingCode}</span>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-teal-600" />}
            </button>
          )}

          {/* زر اختبار المنبّه */}
          <button
            onClick={onTestAlarm}
            title="اختبار المنبّه (10 ثوانٍ)"
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition active:scale-95"
          >
            <Bell className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </button>

          {/* زر معالج الأذونات */}
          <button
            onClick={onOpenPermissions}
            title="معالج دقة المنبّه والأذونات"
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition active:scale-95"
          >
            <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </button>
        </div>
      </div>
    </header>
  );
};
