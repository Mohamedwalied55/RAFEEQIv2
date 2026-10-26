/**
 * مكوّن إدخال الهاتف مع اختيار مفتاح الدولة العربية الـ 22
 * مصمم بدقة: w-[7.25rem]، ارتفاع 48px، LTR، ومحاذاة تامة
 */
import React from 'react';
import { ARAB_COUNTRIES, formatFullInternationalPhone } from '../utils/countryCodes';

interface PhoneWithCountryPickerProps {
  countryCode: string;
  phone: string;
  onCountryCodeChange: (code: string) => void;
  onPhoneChange: (phone: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export const PhoneWithCountryPicker: React.FC<PhoneWithCountryPickerProps> = ({
  countryCode,
  phone,
  onCountryCodeChange,
  onPhoneChange,
  label,
  required = false,
  disabled = false,
  placeholder = '10XXXXXXXX',
}) => {
  const currentCountry =
    ARAB_COUNTRIES.find((c) => c.dialCode === countryCode) || ARAB_COUNTRIES[0];

  const fullInternational = formatFullInternationalPhone(currentCountry.dialCode, phone);

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* الحاوية بنظام LTR ومحاذاة تامة */}
      <div className="flex gap-2 items-center" dir="ltr">
        {/* القائمة المنسدلة للدولة */}
        <div className="relative w-[7.25rem] shrink-0">
          <select
            value={countryCode}
            onChange={(e) => onCountryCodeChange(e.target.value)}
            disabled={disabled}
            title={`${currentCountry.name} (${currentCountry.dialCode})`}
            className="w-full h-12 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition disabled:opacity-60 appearance-none cursor-pointer"
          >
            {ARAB_COUNTRIES.map((c) => (
              <option key={c.code} value={c.dialCode}>
                {c.flag} {c.dialCode}
              </option>
            ))}
          </select>
          {/* سهم القائمة */}
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>

        {/* حقل إدخال رقم الهاتف */}
        <input
          type="tel"
          inputMode="numeric"
          dir="ltr"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value.replace(/[^\d\s-]/g, ''))}
          disabled={disabled}
          placeholder={placeholder}
          required={required}
          className="flex-1 min-w-0 h-12 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-sm font-medium text-slate-800 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition disabled:opacity-60 text-start"
        />
      </div>

      {/* التفاصيل أسفل الحقل */}
      <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 px-1">
        <span>{currentCountry.name}</span>
        {phone && (
          <span className="font-mono text-teal-600 dark:text-teal-400" dir="ltr">
            WhatsApp: {fullInternational}
          </span>
        )}
      </div>
    </div>
  );
};
