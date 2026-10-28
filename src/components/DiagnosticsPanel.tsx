/**
 * شاشة تشخيص مبسّطة: تعرض حالة الأذونات والمنبّهات المجدولة وتسجيل الدخول والمزامنة
 * لمعرفة سبب أي مشكلة (منبّه لا يعمل، مزامنة متوقفة...) من داخل التطبيق نفسه.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Activity, RefreshCw } from 'lucide-react';
import { auth } from '../lib/firebase';
import { Storage } from '../utils/storage';
import { checkAlarmPermissions } from '../utils/nativeAlarms';
import { syncStatus } from '../utils/syncStatus';

interface Info {
  native: boolean;
  email: string;
  display: boolean;
  exact: boolean;
  pending: number;
  nextAlarm: string;
  realMeds: number;
  lastSync: string;
  syncError: string;
}

const fmt = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
};

const Row: React.FC<{ label: string; value: React.ReactNode; ok?: boolean | null }> = ({ label, value, ok }) => (
  <div className="flex items-start justify-between gap-3 text-xs py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
    <span className="text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
    <span
      className={`font-semibold text-end break-words min-w-0 ${
        ok === true ? 'text-emerald-600' : ok === false ? 'text-rose-600' : 'text-slate-800 dark:text-slate-100'
      }`}
    >
      {value}
    </span>
  </div>
);

export const DiagnosticsPanel: React.FC = () => {
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const native = Capacitor.isNativePlatform();
    let pending = 0;
    let nextAlarm = '—';
    if (native) {
      try {
        const res = await LocalNotifications.getPending();
        pending = res.notifications.length;
        const times = res.notifications
          .map((n) => {
            const at = (n as { schedule?: { at?: Date | string } }).schedule?.at;
            return at ? new Date(at).getTime() : NaN;
          })
          .filter((t) => !isNaN(t) && t > Date.now())
          .sort((a, b) => a - b);
        if (times.length) nextAlarm = fmt(new Date(times[0]).toISOString());
      } catch {
        // ignore
      }
    }
    const perms = await checkAlarmPermissions();
    setInfo({
      native,
      email: auth.currentUser?.email || 'غير مسجّل دخول في Firebase',
      display: perms.display,
      exact: perms.exact,
      pending,
      nextAlarm,
      realMeds: Storage.getMedications().filter((m) => m.active && !m.isExample && !m.id.startsWith('med_sample_')).length,
      lastSync: fmt(Storage.getLastSyncTimestamp() || syncStatus.lastSuccessAt),
      syncError: syncStatus.lastError || '',
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Activity className="w-4 h-4 text-teal-600" />
          حالة النظام (تشخيص)
        </h3>
        <button
          onClick={refresh}
          disabled={loading}
          className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {info ? (
        <div>
          <Row label="النسخة" value={info.native ? 'تطبيق أندرويد' : 'متصفح'} />
          <Row label="الحساب" value={info.email} ok={auth.currentUser ? true : false} />
          <Row label="أدوية حقيقية نشطة" value={info.realMeds} ok={info.realMeds > 0 ? true : null} />
          <Row label="إذن الإشعارات" value={info.display ? 'مسموح' : 'غير مسموح'} ok={info.display} />
          <Row label="إذن المنبّه الدقيق" value={info.exact ? 'مسموح' : 'غير مسموح'} ok={info.exact} />
          <Row label="منبّهات مجدولة" value={info.native ? info.pending : 'غير متاح في المتصفح'} ok={info.native ? info.pending > 0 : null} />
          <Row label="أقرب منبّه" value={info.nextAlarm} />
          <Row label="آخر مزامنة ناجحة" value={info.lastSync} />
          <Row label="خطأ المزامنة" value={info.syncError || 'لا يوجد'} ok={info.syncError ? false : null} />
          {info.native && info.realMeds === 0 && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 pt-2">
              لا توجد أدوية حقيقية: المنبّه والالتزام والمزامنة تعمل على الأدوية التي تضيفها أنت فقط.
            </p>
          )}
          {info.native && info.realMeds > 0 && info.pending === 0 && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 pt-2">
              لا توجد منبّهات مجدولة: تأكد من إذن الإشعارات والمنبّه الدقيق، وأن أيام وأوقات الدواء مضبوطة.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500">جاري الفحص...</p>
      )}
    </div>
  );
};
