/**
 * قائمة الدول العربية الـ 22 ومفاتيح الاتصال الدولية
 */

export interface CountryInfo {
  code: string; // ISO 2-letter
  dialCode: string; // e.g. "+20"
  name: string; // Arabic name
  flag: string; // Emoji flag
  sampleLength: number; // typical phone number length without leading zero
}

export const ARAB_COUNTRIES: CountryInfo[] = [
  { code: 'EG', dialCode: '+20', name: 'مصر', flag: '🇪🇬', sampleLength: 10 },
  { code: 'SA', dialCode: '+966', name: 'السعودية', flag: '🇸🇦', sampleLength: 9 },
  { code: 'AE', dialCode: '+971', name: 'الإمارات', flag: '🇦🇪', sampleLength: 9 },
  { code: 'KW', dialCode: '+965', name: 'الكويت', flag: '🇰🇼', sampleLength: 8 },
  { code: 'QA', dialCode: '+974', name: 'قطر', flag: '🇶🇦', sampleLength: 8 },
  { code: 'BH', dialCode: '+973', name: 'البحرين', flag: '🇧🇭', sampleLength: 8 },
  { code: 'OM', dialCode: '+968', name: 'عُمان', flag: '🇴🇲', sampleLength: 8 },
  { code: 'JO', dialCode: '+962', name: 'الأردن', flag: '🇯🇴', sampleLength: 9 },
  { code: 'PS', dialCode: '+970', name: 'فلسطين', flag: '🇵🇸', sampleLength: 9 },
  { code: 'LB', dialCode: '+961', name: 'لبنان', flag: '🇱🇧', sampleLength: 8 },
  { code: 'SY', dialCode: '+963', name: 'سوريا', flag: '🇸🇾', sampleLength: 9 },
  { code: 'IQ', dialCode: '+964', name: 'العراق', flag: '🇮🇶', sampleLength: 10 },
  { code: 'YE', dialCode: '+967', name: 'اليمن', flag: '🇾🇪', sampleLength: 9 },
  { code: 'SD', dialCode: '+249', name: 'السودان', flag: '🇸🇩', sampleLength: 9 },
  { code: 'LY', dialCode: '+218', name: 'ليبيا', flag: '🇱🇾', sampleLength: 9 },
  { code: 'TN', dialCode: '+216', name: 'تونس', flag: '🇹🇳', sampleLength: 8 },
  { code: 'DZ', dialCode: '+213', name: 'الجزائر', flag: '🇩🇿', sampleLength: 9 },
  { code: 'MA', dialCode: '+212', name: 'المغرب', flag: '🇲🇦', sampleLength: 9 },
  { code: 'MR', dialCode: '+222', name: 'موريتانيا', flag: '🇲🇷', sampleLength: 8 },
  { code: 'SO', dialCode: '+252', name: 'الصومال', flag: '🇸🇴', sampleLength: 8 },
  { code: 'DJ', dialCode: '+253', name: 'جيبوتي', flag: '🇩🇯', sampleLength: 8 },
  { code: 'KM', dialCode: '+269', name: 'جزر القمر', flag: '🇰🇲', sampleLength: 7 },
];

/**
 * تنظيف وتنسيق الرقم الدولي لإرسال الواتساب والاتصال
 * يزيل الأصفار البادئة والرموز ويضيف المفتاح الدولي
 */
export function formatFullInternationalPhone(dialCode: string, rawPhone: string): string {
  if (!rawPhone) return '';
  // استخراج الأرقام فقط
  let clean = rawPhone.replace(/\D/g, '');
  // إزالة الصفر في بداية الرقم المحلي إن وُجد (مثل 010 -> 10)
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }
  const cleanDial = dialCode.replace(/\D/g, '');
  // إذا كان المستخدم كتب الرقم بالمفتاح بالفعل
  if (clean.startsWith(cleanDial)) {
    return `+${clean}`;
  }
  return `+${cleanDial}${clean}`;
}

/**
 * استخراج الأرقام فقط لصيغة wa.me (بدون علامة +)
 */
export function getWhatsAppCleanNumber(dialCode: string, rawPhone: string): string {
  const full = formatFullInternationalPhone(dialCode, rawPhone);
  return full.replace(/\D/g, '');
}
