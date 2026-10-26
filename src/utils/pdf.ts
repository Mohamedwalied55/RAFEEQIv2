/**
 * توليد التقارير الصحية، العرض الداخلي بملء الشاشة، وتصدير الـ PDF عبر Canvas و jsPDF
 */
import { jsPDF } from 'jspdf';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Medication, DoseLog, VitalMeasurement } from '../types';

import { calculateAdherence, formatDateYMD } from './storage';

export interface ReportStats {
  periodDays: number;
  totalScheduled: number;
  taken: number;
  skipped: number;
  missed: number;
  adherenceRate: number | null;
  avgSystolic: number | null;
  avgDiastolic: number | null;
  avgSugar: number | null;
  avgPulse: number | null;
}

export function calculateReportStats(
  periodDays: number,
  medications: Medication[],
  doseLogs: Record<string, DoseLog>,
  vitals: VitalMeasurement[]
): ReportStats {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - (periodDays - 1));
  const startStr = formatDateYMD(startDate);
  const endStr = formatDateYMD(now);

  const adherence = calculateAdherence(
    { medications, doseLogs },
    startStr,
    endStr,
    now
  );

  // حساب متوسط القياسات في الفترة
  const periodVitals = vitals.filter((v) => {
    const vDate = v.dateTime.split('T')[0];
    return vDate >= startStr && vDate <= endStr;
  });

  const bpReadings = periodVitals.filter((v) => v.type === 'bp' && v.systolic && v.diastolic);
  const avgSystolic = bpReadings.length
    ? Math.round(bpReadings.reduce((acc, curr) => acc + (curr.systolic || 0), 0) / bpReadings.length)
    : null;
  const avgDiastolic = bpReadings.length
    ? Math.round(bpReadings.reduce((acc, curr) => acc + (curr.diastolic || 0), 0) / bpReadings.length)
    : null;

  const sugarReadings = periodVitals.filter((v) => v.type === 'sugar' && v.value);
  const avgSugar = sugarReadings.length
    ? Math.round(sugarReadings.reduce((acc, curr) => acc + (curr.value || 0), 0) / sugarReadings.length)
    : null;

  const pulseReadings = periodVitals.filter((v) => v.type === 'pulse' && v.value);
  const avgPulse = pulseReadings.length
    ? Math.round(pulseReadings.reduce((acc, curr) => acc + (curr.value || 0), 0) / pulseReadings.length)
    : null;

  return {
    periodDays,
    totalScheduled: adherence.due,
    taken: adherence.taken,
    skipped: adherence.skipped,
    missed: adherence.missed,
    adherenceRate: adherence.percent,
    avgSystolic,
    avgDiastolic,
    avgSugar,
    avgPulse,
  };
}

export function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * بناء كود HTML نظيف ومتجاوب لعرض التقرير داخل iframe مع حماية كاملة من XSS
 */
export function generateReportHtml(params: {
  patientName: string;
  stats: ReportStats;
  medications: Medication[];
  vitals: VitalMeasurement[];
}): string {
  const { patientName, stats, medications, vitals } = params;
  const todayStr = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const safePatientName = escapeHtml(patientName || 'المستخدم');

  const medRows = medications
    .map(
      (m) => `
    <tr style="border-bottom: 1px solid #E2E8F0;">
      <td style="padding: 10px; font-weight: bold; color: #0F172A;">${escapeHtml(m.name)}</td>
      <td style="padding: 10px; color: #475569;">${Number(m.dose)} ${escapeHtml(m.form)}</td>
      <td style="padding: 10px; color: #475569;">${escapeHtml(m.times.join('، '))}</td>
      <td style="padding: 10px; color: #475569;">${escapeHtml(m.foodTiming)}</td>
      <td style="padding: 10px; color: #0F9D8A; font-weight: bold;">${Number(m.stock)} متبقي</td>
    </tr>
  `
    )
    .join('');

  const recentVitals = vitals
    .slice(0, 8)
    .map((v) => {
      const typeLabel =
        v.type === 'bp'
          ? `ضغط دم: ${Number(v.systolic)}/${Number(v.diastolic)} ملم زئبق`
          : v.type === 'sugar'
          ? `سكر: ${Number(v.value)} مجم/دل (${v.sugarContext === 'fasting' ? 'صائم' : 'بعد الأكل'})`
          : v.type === 'pulse'
          ? `نبض: ${Number(v.value)} نبضة/د`
          : `حرارة: ${Number(v.value)}°م`;
      const dateStr = new Date(v.dateTime).toLocaleDateString('ar-EG', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      return `<li style="padding: 6px 0; border-bottom: 1px dashed #E2E8F0; color: #334155;"><strong>${escapeHtml(dateStr)}:</strong> ${escapeHtml(typeLabel)}</li>`;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 24px;
      background-color: #FFFFFF;
      color: #0F172A;
      line-height: 1.6;
    }
    .header {
      border-bottom: 2px solid #0F9D8A;
      padding-bottom: 16px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo {
      font-size: 24px;
      font-weight: 700;
      color: #0F9D8A;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .card {
      background: #F8FAF9;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 12px;
      text-align: center;
    }
    .card-val {
      font-size: 22px;
      font-weight: 700;
      color: #0F9D8A;
    }
    .card-lbl {
      font-size: 12px;
      color: #64748B;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 13px;
    }
    th {
      background-color: #F1F5F9;
      padding: 10px;
      text-align: start;
      color: #475569;
    }
    .disclaimer {
      margin-top: 30px;
      padding: 14px;
      background: #FEF3C7;
      border-radius: 8px;
      font-size: 12px;
      color: #92400E;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">💊 رفيقي | تقرير المتابعة الصحية</div>
      <div style="font-size: 13px; color: #64748B;">المريض: <strong>${safePatientName}</strong> | التاريخ: ${todayStr}</div>
    </div>
    <div style="text-align: end; font-size: 13px; color: #64748B;">
      الفترة: آخر <strong>${stats.periodDays}</strong> يوماً
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-val">${stats.adherenceRate !== null ? `${stats.adherenceRate}%` : '<span style="font-size: 13px; color: #94A3B8;">لا توجد بيانات كافية</span>'}</div>
      <div class="card-lbl">نسبة الالتزام</div>
    </div>
    <div class="card">
      <div class="card-val" style="color: #10B981;">${stats.taken}</div>
      <div class="card-lbl">جرعات مأخوذة</div>
    </div>
    <div class="card">
      <div class="card-val" style="color: #EF4444;">${stats.missed}</div>
      <div class="card-lbl">جرعات فائتة</div>
    </div>
    <div class="card">
      <div class="card-val" style="color: #F59E0B;">${stats.skipped}</div>
      <div class="card-lbl">جرعات متخطاة</div>
    </div>
  </div>

  <h3 style="color: #0F172A; border-bottom: 1px solid #CBD5E1; padding-bottom: 6px; font-size: 15px;">📊 متوسط المؤشرات الحيوية</h3>
  <div class="grid">
    <div class="card">
      <div class="card-val">${stats.avgSystolic && stats.avgDiastolic ? `${stats.avgSystolic}/${stats.avgDiastolic}` : '—'}</div>
      <div class="card-lbl">متوسط الضغط (ملم زئبق)</div>
    </div>
    <div class="card">
      <div class="card-val">${stats.avgSugar ? `${stats.avgSugar}` : '—'}</div>
      <div class="card-lbl">متوسط السكر (مجم/دل)</div>
    </div>
    <div class="card">
      <div class="card-val">${stats.avgPulse ? `${stats.avgPulse}` : '—'}</div>
      <div class="card-lbl">متوسط النبض (نبضة/د)</div>
    </div>
  </div>

  <h3 style="color: #0F172A; border-bottom: 1px solid #CBD5E1; padding-bottom: 6px; font-size: 15px;">💊 جدول الأدوية الحالية</h3>
  <table>
    <thead>
      <tr>
        <th>الدواء</th>
        <th>الجرعة</th>
        <th>المواعيد</th>
        <th>التوقيت</th>
        <th>المخزون</th>
      </tr>
    </thead>
    <tbody>
      ${medRows || '<tr><td colspan="5" style="text-align: center; padding: 12px; color: #94A3B8;">لا توجد أدوية مسجلة</td></tr>'}
    </tbody>
  </table>
  ${medications.length > 10 ? '<div style="font-size: 12px; color: #64748B; margin-top: -12px; margin-bottom: 16px;">* تم إدراج جميع الأدوية المسجلة.</div>' : ''}

  ${
    recentVitals
      ? `<h3 style="color: #0F172A; border-bottom: 1px solid #CBD5E1; padding-bottom: 6px; font-size: 15px;">🩺 آخر القياسات المسجلة</h3>
         <ul style="list-style: none; padding: 0; font-size: 13px;">${recentVitals}</ul>`
      : ''
  }

  <div class="disclaimer">
    ⚠️ <strong>تنبيه طبي:</strong> هذا التقرير للإرشاد والمتابعة المنزلية ولا يغني عن مراجعة الطبيب المعالج أو استشارة الصيدلي. لا تقم بتعديل جرعاتك الطبية دون مشورة طبية مباشرة.
  </div>
</body>
</html>
  `;
}

/**
 * رسم الصفحة على Canvas بدعم الخطوط العربية وتوليد PDF عبر jsPDF
 */
async function renderReportToCanvas(
  patientName: string,
  stats: ReportStats,
  medications: Medication[]
): Promise<HTMLCanvasElement> {
  // انتظار تحميل الخط العربي Cairo بدقة
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.load('bold 36px Cairo');
      await document.fonts.ready;
    } catch {
      // ignore
    }
  }

  const canvas = document.createElement('canvas');
  // أبعاد A4 بدقة 2x للطباعة الواضحة (1190 x 1684)
  canvas.width = 1190;
  canvas.height = 1684;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('فشل إنشاء سياق Canvas للتقرير');

  // خلفية بيضاء
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';

  // شريط علوي أخضر زمردي
  ctx.fillStyle = '#0F9D8A';
  ctx.fillRect(0, 0, canvas.width, 140);

  // عنوان التقرير
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px Cairo, sans-serif';
  ctx.fillText('تطبيق رفيقي (RAFEEQI) — تقرير المتابعة الصحية', canvas.width - 60, 70);

  ctx.font = '20px Cairo, sans-serif';
  const todayStr = formatDateYMD();
  ctx.fillText(`المريض: ${patientName || 'المستخدم'}  |  التاريخ: ${todayStr}  |  الفترة: آخر ${stats.periodDays} يوماً`, canvas.width - 60, 110);

  let y = 200;

  // بطاقات الإحصائيات
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 26px Cairo, sans-serif';
  ctx.fillText('ملخص الالتزام بالدواء:', canvas.width - 60, y);
  y += 50;

  // رسم صندوق ملخص
  ctx.fillStyle = '#F8FAF9';
  ctx.strokeStyle = '#0F9D8A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(60, y, canvas.width - 120, 130, [16]);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0F9D8A';
  ctx.font = 'bold 30px Cairo, sans-serif';
  const adherenceLabel = stats.adherenceRate !== null ? `نسبة الالتزام: ${stats.adherenceRate}%` : 'نسبة الالتزام: لا توجد بيانات كافية بعد';
  ctx.fillText(adherenceLabel, canvas.width - 100, y + 60);

  ctx.fillStyle = '#334155';
  ctx.font = '22px Cairo, sans-serif';
  ctx.fillText(`المأخوذة: ${stats.taken}   |   المتخطاة: ${stats.skipped}   |   الفائتة: ${stats.missed}`, canvas.width - 100, y + 105);

  y += 180;

  // جدول الأدوية
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 26px Cairo, sans-serif';
  ctx.fillText('قائمة الأدوية المجدولة:', canvas.width - 60, y);
  y += 40;

  // رأس الجدول
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(60, y, canvas.width - 120, 50);

  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 20px Cairo, sans-serif';
  ctx.fillText('اسم الدواء', canvas.width - 80, y + 34);
  ctx.fillText('الجرعة والشكل', canvas.width - 380, y + 34);
  ctx.fillText('المواعيد', canvas.width - 650, y + 34);
  ctx.fillText('المخزون', canvas.width - 920, y + 34);
  y += 55;

  ctx.font = '19px Cairo, sans-serif';
  const displayMeds = medications.slice(0, 10);
  displayMeds.forEach((med, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    ctx.fillRect(60, y, canvas.width - 120, 48);

    ctx.fillStyle = '#0F172A';
    ctx.fillText(med.name, canvas.width - 80, y + 32);
    ctx.fillStyle = '#475569';
    ctx.fillText(`${med.dose} ${med.form}`, canvas.width - 380, y + 32);
    ctx.fillText(med.times.join('، '), canvas.width - 650, y + 32);
    ctx.fillText(`${med.stock} متبقي`, canvas.width - 920, y + 32);
    y += 50;
  });

  if (medications.length > 10) {
    ctx.fillStyle = '#64748B';
    ctx.font = 'italic 16px Cairo, sans-serif';
    ctx.fillText('* يعرض أول 10 أدوية فقط في هذا التقرير الموجز', canvas.width - 80, y + 30);
  }

  // تنبيه طبي في أسفل الصفحة
  const footerY = canvas.height - 130;
  ctx.fillStyle = '#FEF3C7';
  ctx.fillRect(60, footerY, canvas.width - 120, 80);

  ctx.fillStyle = '#92400E';
  ctx.font = '17px Cairo, sans-serif';
  ctx.fillText('⚠️ تنبيه طبي: هذا التقرير للإرشاد المنزلي فقط ولا يغني عن استشارة الطبيب أو الصيدلي.', canvas.width - 90, footerY + 36);
  ctx.fillText('تم التوليد بواسطة تطبيق رفيقي (RAFEEQI) — رفيقك لصحة أفضل.', canvas.width - 90, footerY + 62);

  return canvas;
}

/**
 * تصدير التقرير ومشاركته:
 * على أندرويد: حفظ في Cache وفتح Share sheet
 * على المتصفح: تنزيل عادي
 */
export async function exportReportPdf(params: {
  patientName: string;
  stats: ReportStats;
  medications: Medication[];
}): Promise<{ success: boolean; message: string }> {
  try {
    const canvas = await renderReportToCanvas(params.patientName, params.stats, params.medications);
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

    const dateStr = formatDateYMD();
    const asciiFileName = `Rafeeqi_Report_${dateStr}.pdf`;

    if (Capacitor.isNativePlatform()) {
      // تحويل الـ PDF إلى base64
      const pdfBase64 = pdf.output('datauristring').split(',')[1];

      // كتابة الملف في كاش التطبيق
      const writtenFile = await Filesystem.writeFile({
        path: asciiFileName,
        data: pdfBase64,
        directory: Directory.Cache,
      });

      // فتح نافذة المشاركة للنظام (لحفظ في الملفات / درايف / إرسال)
      await Share.share({
        title: 'تقرير رفيقي الصحي',
        text: `تقرير المتابعة الصحية للمريض ${params.patientName || ''}`,
        url: writtenFile.uri,
        dialogTitle: 'مشاركة أو حفظ التقرير الصحي',
      });

      return {
        success: true,
        message: 'اختر من القائمة: حفظ في الملفات أو Drive أو إرسال.',
      };
    } else {
      // متصفح الويب العادي
      pdf.save(asciiFileName);
      return {
        success: true,
        message: 'تم التنزيل في مجلد التنزيلات بنجاح.',
      };
    }
  } catch (err) {
    console.error('PDF generation or sharing failed:', err);
    return {
      success: false,
      message: (err as Error)?.message || 'فشل توليد التقرير أو مشاركته.',
    };
  }
}
