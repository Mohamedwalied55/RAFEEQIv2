/**
 * شاشة الحاسبة الذكية: حاسبة كفاية المخزون وتكلفة العلاج الشهرية
 */
import React, { useState } from 'react';
import { Calculator, Calendar, DollarSign, Pill, TrendingDown } from 'lucide-react';
import { Medication } from '../types';

interface CalculatorTabProps {
  medications: Medication[];
}

export const CalculatorTab: React.FC<CalculatorTabProps> = ({ medications }) => {
  // مدخلات المحاكي المخصص
  const [boxUnits, setBoxUnits] = useState<number>(30);
  const [dailyDose, setDailyDose] = useState<number>(2);
  const [pricePerBox, setPricePerBox] = useState<number>(50);

  // حسابات المحاكي الفردي
  const daysBoxLasts = dailyDose > 0 ? Math.floor(boxUnits / dailyDose) : 0;
  const boxesPerMonth = daysBoxLasts > 0 ? (30 / daysBoxLasts).toFixed(1) : '0';
  const monthlyCostCustom = daysBoxLasts > 0 ? Math.round((30 / daysBoxLasts) * pricePerBox) : 0;
  const costPerDay = dailyDose > 0 && boxUnits > 0 ? (pricePerBox / (boxUnits / dailyDose)).toFixed(2) : '0';

  // حسابات إجمالي ميزانية الأدوية الحالية للمريض
  let totalMonthlyCost = 0;
  const medBreakdown = medications.map((med) => {
    const dosesPerDay = med.times.length * med.dose;
    const daysFromStock = dosesPerDay > 0 ? Math.floor(med.stock / dosesPerDay) : 0;
    const unitsInBox = (med.stripsPerBox || 2) * (med.unitsPerStrip || 10);
    const boxPrice = med.boxPrice || 0;
    const boxesNeededPerMonth = dosesPerDay > 0 && unitsInBox > 0 ? (dosesPerDay * 30) / unitsInBox : 1;
    const estimatedCost = Math.round(boxesNeededPerMonth * boxPrice);

    totalMonthlyCost += estimatedCost;

    return {
      med,
      dosesPerDay,
      daysFromStock,
      estimatedCost,
    };
  });

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
          حاسبة المخزون والتكلفة الدوائية
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          تخطيط ميزانية العلاج ومعرفة متى تحتاج لشراء عبوات جديدة
        </p>
      </div>

      {/* بطاقة إجمالي ميزانية الصيدلية الشهرية */}
      <div className="bg-linear-to-br from-teal-600 to-teal-800 text-white rounded-3xl p-5 shadow-lg shadow-teal-700/20">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-teal-100 font-medium">
              تقدير التكلفة الشهرية الإجمالية لأدويتك:
            </span>
            <div className="text-3xl font-black mt-1">
              {totalMonthlyCost}{' '}
              <span className="text-sm font-semibold text-teal-200">ج.م / ر.س</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-xs">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-teal-500/40 text-xs text-teal-100 flex items-center justify-between">
          <span>عدد الأدوية المعتمدة: {medications.length}</span>
          <span>محسوبة على استهلاك 30 يوماً</span>
        </div>
      </div>

      {/* تفصيل كفاية المخزون الحالي لكل دواء */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs">
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
          <Pill className="w-4 h-4 text-teal-600" />
          كم يوماً يكفي مخزونك الحالي؟
        </h3>

        {medBreakdown.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-4">
            لا توجد أدوية مسجلة لعرض مخزونها.
          </div>
        ) : (
          <div className="space-y-2">
            {medBreakdown.map(({ med, dosesPerDay, daysFromStock, estimatedCost }) => (
              <div
                key={med.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">{med.name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    استهلاك: {dosesPerDay} {med.form}/يومياً • متبقي: {med.stock}
                  </div>
                </div>

                <div className="text-end">
                  <div
                    className={`font-black ${
                      daysFromStock <= 5 ? 'text-rose-600 font-bold' : 'text-teal-600 dark:text-teal-400'
                    }`}
                  >
                    يكفي لـ {daysFromStock} يوماً
                  </div>
                  {estimatedCost > 0 && (
                    <div className="text-[10px] text-slate-400">~{estimatedCost} شهرياً</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* محاكي دواء مخصص */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-1.5">
          <Calculator className="w-4 h-4 text-teal-600" />
          محاكي حساب علبة دواء جديدة
        </h3>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              عدد الوحدات بالعلبة
            </label>
            <input
              type="number"
              min="1"
              value={boxUnits}
              onChange={(e) => setBoxUnits(Number(e.target.value))}
              className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2 text-center text-xs font-bold"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              الجرعة باليوم
            </label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={dailyDose}
              onChange={(e) => setDailyDose(Number(e.target.value))}
              className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2 text-center text-xs font-bold"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              سعر العلبة
            </label>
            <input
              type="number"
              min="0"
              value={pricePerBox}
              onChange={(e) => setPricePerBox(Number(e.target.value))}
              className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2 text-center text-xs font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-3 bg-teal-50 dark:bg-teal-950/40 rounded-2xl border border-teal-200 dark:border-teal-800">
            <span className="text-[11px] text-teal-800 dark:text-teal-300 font-semibold block">
              العلبة تكفي:
            </span>
            <span className="text-xl font-black text-teal-600 dark:text-teal-400">
              {daysBoxLasts} يوماً
            </span>
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800">
            <span className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold block">
              التكلفة الشهرية المقدرة:
            </span>
            <span className="text-xl font-black text-amber-600 dark:text-amber-400">
              {monthlyCostCustom} ج.م / ر.س
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
