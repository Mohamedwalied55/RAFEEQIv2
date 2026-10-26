/**
 * أدوات إنشاء وفتح روابط الواتساب لمراسلة المرافق
 * تنبيه: واتساب لا يدعم الإرسال الصامت الآلي؛ يجب أن يضغط المستخدم زر الإرسال بنفسه.
 */
import { getWhatsAppCleanNumber } from './countryCodes';

export interface WhatsAppCaregiverTarget {
  name: string;
  phone: string;
  dialCode: string;
}

export function createWhatsAppUrl(target: WhatsAppCaregiverTarget, message: string): string {
  const cleanNumber = getWhatsAppCleanNumber(target.dialCode, target.phone);
  if (!cleanNumber) return '';
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${cleanNumber}?text=${encoded}`;
}

export function openWhatsAppChat(target: WhatsAppCaregiverTarget, message: string): boolean {
  const url = createWhatsAppUrl(target, message);
  if (!url) return false;

  // فتح الرابط بشكل آمن
  try {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (e) {
    console.error('Failed to open WhatsApp URL:', e);
    return false;
  }
}

/**
 * رسالة تم أخذ الجرعة
 */
export function buildDoseTakenMessage(patientName: string, medName: string, dose: number, form: string, time: string): string {
  const greeting = patientName ? `السلام عليكم، أنا ${patientName}.` : 'السلام عليكم.';
  return `${greeting}\nأحب أن أطمئنك أنني أخذت دواء (${medName}) جرعة ${dose} ${form} في موعده (${time}) بحمد الله.\n\n— عبر تطبيق رفيقي 💊`;
}

/**
 * رسالة تأخر الجرعة
 */
export function buildDoseDelayedMessage(patientName: string, medName: string, time: string, minutesLate: number): string {
  const greeting = patientName ? `تنبيه رعاية للمريض: ${patientName}` : 'تنبيه رعاية دواء:';
  return `⚠️ ${greeting}\nتأخر موعد جرعة دواء (${medName}) المقررة في تمام الساعة (${time}) بحوالي ${minutesLate} دقيقة.\nيرجى الاطمئنان والتذكير.\n\n— عبر تطبيق رفيقي 💊`;
}

/**
 * رسالة ملخص التقرير الصحي
 */
export function buildReportSummaryMessage(
  patientName: string,
  adherenceRate: number | null,
  periodDays: number,
  totalDoses: number,
  takenDoses: number
): string {
  const name = patientName || 'المريض';
  const adhLabel = adherenceRate !== null ? `${adherenceRate}%` : 'لا توجد بيانات كافية بعد';
  return `📋 *تقرير الالتزام بالدواء — تطبيق رفيقي*\n` +
    `👤 المريض: ${name}\n` +
    `📅 الفترة: آخر ${periodDays} يوماً\n` +
    `✅ نسبة الالتزام: ${adhLabel}\n` +
    `💊 الجرعات المأخوذة: ${takenDoses} من إجمالي ${totalDoses}\n\n` +
    `نسأل الله لكم دوام الصحة والعافية. 🌿`;
}
