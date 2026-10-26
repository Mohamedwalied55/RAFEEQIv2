/**
 * كارت تتبع شرب الماء اليومي
 */
import React from 'react';
import { Droplets, Plus, Minus, CheckCircle } from 'lucide-react';
import { WaterReminderConfig } from '../types';

interface WaterReminderCardProps {
  water: WaterReminderConfig;
  onUpdateWater: (newConfig: WaterReminderConfig) => void;
}

export const WaterReminderCard: React.FC<WaterReminderCardProps> = ({ water, onUpdateWater }) => {
  const percentage = Math.min(100, Math.round((water.drunkTodayMl / water.dailyGoalMl) * 100));
  const isCompleted = percentage >= 100;

  const handleAddGlass = () => {
    const updated = {
      ...water,
      drunkTodayMl: water.drunkTodayMl + water.glassSizeMl,
    };
    onUpdateWater(updated);
  };

  const handleRemoveGlass = () => {
    const updated = {
      ...water,
      drunkTodayMl: Math.max(0, water.drunkTodayMl - water.glassSizeMl),
    };
    onUpdateWater(updated);
  };

  return (
    <div className="bg-linear-to-r from-sky-50 to-blue-50/80 dark:from-slate-800 dark:to-slate-800/90 rounded-2xl p-4 border border-sky-100 dark:border-slate-700 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-xs">
            <Droplets className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              شرب الماء والترطيب
              {isCompleted && (
                <span className="text-[11px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> تم الهدف
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {water.drunkTodayMl} مل من {water.dailyGoalMl} مل ({percentage}%)
            </p>
          </div>
        </div>

        {/* أزرار التحكم السريعة */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRemoveGlass}
            disabled={water.drunkTodayMl <= 0}
            title="تقليل كوب"
            className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 transition active:scale-95"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={handleAddGlass}
            title={`شرب كوب (+${water.glassSizeMl} مل)`}
            className="h-8 px-3 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            كوب ({water.glassSizeMl} مل)
          </button>
        </div>
      </div>

      {/* شريط التقدم */}
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            isCompleted ? 'bg-emerald-500' : 'bg-sky-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
