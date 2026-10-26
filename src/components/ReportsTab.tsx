/**
 * شاشة التقارير الصحية: عرض التقرير بملء الشاشة، وتنزيل PDF ومشاركته بأمان، وملخص واتساب
 */
import React, { useState } from 'react';
import {
  FileText,
  Download,
  Eye,
  Share2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  X,
  FileCheck,
} from 'lucide-react';
import { Medication, DoseLog, VitalMeasurement, CaregiverConfig } from '../types';
import {
  calculateReportStats,
  generateReportHtml,
  exportReportPdf,
} from '../utils/pdf';
import { getAdherenceTheme } from '../utils/storage';
import { openWhatsAppChat, buildReportSummaryMessage } from '../utils/whatsapp';

interface ReportsTabProps {
  patientName: string;
  medications: Medication[];
  doseLogs: Record<string, DoseLog>;
  vitals: VitalMeasurement[];
  caregiverConfig: CaregiverConfig;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({
  patientName,
  medications,
  doseLogs,
  vitals,
  caregiverConfig,
}) => {
  const [periodDays, setPeriodDays] = useState<number>(7);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; isError?: boolean } | null>(
    null
  );

  const stats = calculateReportStats(periodDays, medications, doseLogs, vitals);
  const reportHtml = generateReportHtml({
    patientName,
    stats,
    medications,
    vitals,
  });

  const handleExportPdf = async () => {
    setDownloading(true);
    setFeedbackMessage(null);
    try {
      const res = await exportReportPdf({
        patientName,
        stats,
        medications,
      });
      setFeedbackMessage({ text: res.message, isError: !res.success });
    } catch (err: any) {
      setFeedbackMessage({ text: err?.message || 'فشل توليد التقرير', isError: true });
    } finally {
      setDownloading(false);
    }
  };

  const handleShareWhatsAppSummary = () => {
    const summaryMsg = buildReportSummaryMessage(
      patientName,
      stats.adherenceRate,
      periodDays,
      stats.totalScheduled,
      stats.taken
    );

    // إذا وُجد رقم مرافق، يُفتح معه، أو فتح واتساب عام
    openWhatsAppChat(
      {
        name: caregiverConfig.name || 'المرافق',
        phone: caregiverConfig.phone || '',
        dialCode: caregiverConfig.countryCode || '+20',
      },
      summaryMsg
    );
  };

  return (
    <div className="space-y-4 pb-20">
      {/* رأس التقرير */}
      <div>
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
          التقارير الصحية والالتزام
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          ملخص دوري شامل لمشاركته مع طبيبك المعالج أو أسرتك
        </p>
      </div>

      {/* اختيار الفترة الزمنية */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
          الفترة الزمنية للتقرير
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              onClick={() => {
                setPeriodDays(days);
                setFeedbackMessage(null);
              }}
              className={`h-11 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                periodDays === days
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              آخر {days} يوماً
            </button>
          ))}
        </div>
      </div>

      {/* بطاقة ملخص النتائج السريعة */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">المريض:</span>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {patientName || 'المستخدم'}
            </div>
          </div>
          <div className="text-end">
            <span className="text-xs text-slate-500 dark:text-slate-400">نسبة الالتزام:</span>
            {(() => {
              const theme = getAdherenceTheme(stats.adherenceRate);
              return (
                <div className="flex flex-col items-end">
                  <div className={`text-xl font-black ${theme.textColor}`}>
                    {theme.displayValue}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${theme.badgeBg} ${theme.badgeText}`}>
                    {theme.labelText}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="text-lg font-black text-emerald-600">{stats.taken}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">جرعة مأخوذة</div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="text-lg font-black text-rose-500">{stats.missed}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">جرعة فائتة</div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="text-lg font-black text-amber-500">{stats.skipped}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">جرعة متخطاة</div>
          </div>
        </div>

        {/* مؤشرات حيوية متوسطة */}
        {(stats.avgSystolic || stats.avgSugar || stats.avgPulse) && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700 text-xs flex justify-around text-slate-600 dark:text-slate-300">
            {stats.avgSystolic && (
              <div>
                متوسط الضغط: <strong>{stats.avgSystolic}/{stats.avgDiastolic}</strong>
              </div>
            )}
            {stats.avgSugar && (
              <div>
                متوسط السكر: <strong>{stats.avgSugar}</strong>
              </div>
            )}
            {stats.avgPulse && (
              <div>
                متوسط النبض: <strong>{stats.avgPulse}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* رسالة النتيجة للمستخدم (صادقة وشفافة) */}
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 border ${
            feedbackMessage.isError
              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
          }`}
        >
          {feedbackMessage.isError ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <FileCheck className="w-4 h-4 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* أزرار الإجراءات */}
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          {/* زر عرض التقرير بملء الشاشة */}
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="h-12 bg-white dark:bg-slate-800 border-2 border-teal-600 hover:bg-teal-50 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98 shadow-xs"
          >
            <Eye className="w-4 h-4" />
            عرض التقرير (كامل)
          </button>

          {/* زر تنزيل PDF */}
          <button
            onClick={handleExportPdf}
            disabled={downloading}
            className="h-12 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloading ? 'جاري التوليد...' : 'تنزيل PDF'}
          </button>
        </div>

        {/* زر مشاركة ملخص واتساب */}
        <button
          onClick={handleShareWhatsAppSummary}
          className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition"
        >
          <Share2 className="w-4 h-4" />
          مشاركة ملخص التقرير عبر واتساب
        </button>
      </div>

      {/* شاشة العرض الكاملة داخل التطبيق (Full-screen overlay) */}
      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/90 flex flex-col pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
          style={{ position: 'fixed', inset: 0, zIndex: 99999 }}
        >
          {/* شريط الإغلاق الثابت بالأعلى */}
          <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-400" />
              <span className="text-sm font-bold">معاينة تقرير رفيقي الطبي</span>
            </div>
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              إغلاق
            </button>
          </div>

          {/* محتوى الـ iframe داخل خلفية بيضاء وخط عربي */}
          <div className="flex-1 bg-white overflow-hidden p-2 sm:p-4">
            <iframe
              title="معاينة التقرير الطبي"
              srcDoc={reportHtml}
              sandbox=""
              className="w-full h-full border-0 rounded-xl bg-white shadow-inner"
              style={{ overflow: 'auto' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
