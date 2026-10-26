/**
 * الشريط السفلي للتنقل الخاص بالمريض (Patient Navigation)
 * 5 عناصر متساوية العرض + قائمة «المزيد» للحاسبة والإعدادات ومن نحن
 */
import React, { useState } from 'react';
import {
  CalendarCheck,
  Pill,
  Activity,
  FileText,
  Sparkles,
  Menu,
  Calculator,
  Settings,
  Info,
  X,
} from 'lucide-react';

export type MainTabType =
  | 'today'
  | 'meds'
  | 'measures'
  | 'reports'
  | 'assistant'
  | 'calculator'
  | 'settings'
  | 'about';

interface NavigationProps {
  currentTab: MainTabType;
  onSelectTab: (tab: MainTabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onSelectTab }) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const mainTabs = [
    { id: 'today', label: 'اليوم', icon: CalendarCheck },
    { id: 'meds', label: 'الأدوية', icon: Pill },
    { id: 'measures', label: 'القياسات', icon: Activity },
    { id: 'reports', label: 'التقارير', icon: FileText },
    { id: 'assistant', label: 'المساعد', icon: Sparkles },
  ] as const;

  const handleTabClick = (tabId: MainTabType) => {
    onSelectTab(tabId);
    setIsMoreMenuOpen(false);
  };

  const isMoreActive = ['calculator', 'settings', 'about'].includes(currentTab);

  return (
    <>
      {/* نافذة «المزيد» للمريض */}
      {isMoreMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs flex items-end justify-center animate-in fade-in duration-150"
          onClick={() => setIsMoreMenuOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl p-5 border-t border-slate-200 dark:border-slate-800 shadow-2xl pb-[max(env(safe-area-inset-bottom,0px)+80px,96px)] animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                المزيد من الخدمات
              </h3>
              <button
                onClick={() => setIsMoreMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* الحاسبة */}
              <button
                onClick={() => handleTabClick('calculator')}
                className={`p-3.5 rounded-2xl border text-start flex items-center gap-3 transition ${
                  currentTab === 'calculator'
                    ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-700 dark:text-teal-300'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-300'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold">الحاسبة الذكية</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">المخزون والتكلفة</div>
                </div>
              </button>

              {/* الإعدادات */}
              <button
                onClick={() => handleTabClick('settings')}
                className={`p-3.5 rounded-2xl border text-start flex items-center gap-3 transition ${
                  currentTab === 'settings'
                    ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-700 dark:text-teal-300'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-300'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold">الإعدادات</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">المنبه، الصوت، الحساب</div>
                </div>
              </button>

              {/* من نحن */}
              <button
                onClick={() => handleTabClick('about')}
                className={`p-3.5 rounded-2xl border text-start flex items-center gap-3 transition ${
                  currentTab === 'about'
                    ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-700 dark:text-teal-300'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-300'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold">من نحن</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">المؤسس والرؤية</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* الشريط السفلي الثابت */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 pb-[max(env(safe-area-inset-bottom,0px),8px)] pt-1.5 transition-colors">
        <div className="max-w-md mx-auto grid grid-cols-6 px-1">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id as MainTabType)}
                className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all active:scale-95 ${
                  isActive
                    ? 'text-teal-600 dark:text-teal-400 font-bold'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <Icon className={`w-6 h-6 transition-transform ${isActive ? 'scale-110' : ''}`} />
                <span className="text-[11px] mt-1 leading-none">{tab.label}</span>
              </button>
            );
          })}

          {/* زر المزيد */}
          <button
            onClick={() => setIsMoreMenuOpen((prev) => !prev)}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all active:scale-95 ${
              isMoreActive || isMoreMenuOpen
                ? 'text-teal-600 dark:text-teal-400 font-bold'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Menu className="w-6 h-6" />
            <span className="text-[11px] mt-1 leading-none">المزيد</span>
          </button>
        </div>
      </nav>
    </>
  );
};
