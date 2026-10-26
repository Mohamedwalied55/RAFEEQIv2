/**
 * شاشة القياسات الحيوية: الضغط، السكر، النبض، والحرارة مع رسوم بيانية وتلوين القراءات الخطرة
 */
import React, { useState } from 'react';
import {
  Activity,
  Plus,
  Trash2,
  Heart,
  Thermometer,
  Droplet,
  AlertTriangle,
  CheckCircle,
  X,
} from 'lucide-react';
import { VitalMeasurement, VitalType, SugarContext } from '../types';

interface MeasuresTabProps {
  vitals: VitalMeasurement[];
  onAddVital: (vital: VitalMeasurement) => void;
  onDeleteVital: (id: string) => void;
}

function getLocalDateTimeInput(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export const MeasuresTab: React.FC<MeasuresTabProps> = ({ vitals, onAddVital, onDeleteVital }) => {
  const [selectedType, setSelectedType] = useState<VitalType>('bp');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // حقول الإدخال
  const [formType, setFormType] = useState<VitalType>('bp');
  const [systolic, setSystolic] = useState<number>(120);
  const [diastolic, setDiastolic] = useState<number>(80);
  const [val, setVal] = useState<number>(100);
  const [sugarContext, setSugarContext] = useState<SugarContext>('fasting');
  const [dateTime, setDateTime] = useState(() => getLocalDateTimeInput());
  const [notes, setNotes] = useState('');

  const filteredVitals = vitals.filter((v) => v.type === selectedType);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const newMeasurement: VitalMeasurement = {
      id: `vital_${Date.now()}`,
      type: formType,
      systolic: formType === 'bp' ? Number(systolic) : undefined,
      diastolic: formType === 'bp' ? Number(diastolic) : undefined,
      value: formType !== 'bp' ? Number(val) : undefined,
      sugarContext: formType === 'sugar' ? sugarContext : undefined,
      dateTime: new Date(dateTime).toISOString(),
      notes: notes.trim() || undefined,
    };
    onAddVital(newMeasurement);
    setIsModalOpen(false);
    setNotes('');
  };

  // فحص المستويات الخطرة وتلوينها
  const getVitalStatus = (v: VitalMeasurement): { text: string; isDanger: boolean; isWarning: boolean } => {
    if (v.type === 'bp') {
      const sys = v.systolic || 0;
      const dia = v.diastolic || 0;
      if (sys >= 160 || dia >= 100) return { text: 'مرتفع جداً (خطر)', isDanger: true, isWarning: false };
      if (sys >= 140 || dia >= 90) return { text: 'مرتفع (مرحلة 1)', isDanger: false, isWarning: true };
      if (sys < 90 || dia < 60) return { text: 'منخفض', isDanger: false, isWarning: true };
      return { text: 'مثالي وطبيعي', isDanger: false, isWarning: false };
    }
    if (v.type === 'sugar') {
      const sVal = v.value || 0;
      if (v.sugarContext === 'fasting') {
        if (sVal >= 126) return { text: 'مرتفع (صائم)', isDanger: true, isWarning: false };
        if (sVal < 70) return { text: 'هبوط حاد', isDanger: true, isWarning: false };
        if (sVal >= 100) return { text: 'ما قبل السكري', isDanger: false, isWarning: true };
        return { text: 'طبيعي', isDanger: false, isWarning: false };
      } else {
        if (sVal >= 200) return { text: 'مرتفع جداً', isDanger: true, isWarning: false };
        if (sVal >= 140) return { text: 'مرتفع نسبياً', isDanger: false, isWarning: true };
        return { text: 'طبيعي', isDanger: false, isWarning: false };
      }
    }
    if (v.type === 'pulse') {
      const p = v.value || 0;
      if (p > 100) return { text: 'تسارع نبض', isDanger: false, isWarning: true };
      if (p < 50) return { text: 'تباطؤ نبض', isDanger: false, isWarning: true };
      return { text: 'طبيعي', isDanger: false, isWarning: false };
    }
    if (v.type === 'temp') {
      const t = v.value || 0;
      if (t >= 38.5) return { text: 'حمى عالية', isDanger: true, isWarning: false };
      if (t >= 37.5) return { text: 'حرارة مرتفعة', isDanger: false, isWarning: true };
      return { text: 'طبيعي', isDanger: false, isWarning: false };
    }
    return { text: 'طبيعي', isDanger: false, isWarning: false };
  };

  return (
    <div className="space-y-4 pb-20">
      {/* رأس الشاشة وزر الإضافة */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            القياسات والمؤشرات الحيوية
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            متابعة الضغط، السكر، النبض، ودرجة الحرارة
          </p>
        </div>
        <button
          onClick={() => {
            setFormType(selectedType);
            setDateTime(getLocalDateTimeInput());
            setIsModalOpen(true);
          }}
          className="h-10 px-3.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          تسجيل قياس
        </button>
      </div>

      {/* شريط اختيار نوع القياس */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => setSelectedType('bp')}
          className={`p-2.5 rounded-2xl border text-center transition ${
            selectedType === 'bp'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-700 dark:text-rose-300 font-bold'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          <Activity className="w-5 h-5 mx-auto mb-1 text-rose-500" />
          <span className="text-xs">ضغط الدم</span>
        </button>

        <button
          onClick={() => setSelectedType('sugar')}
          className={`p-2.5 rounded-2xl border text-center transition ${
            selectedType === 'sugar'
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 text-blue-700 dark:text-blue-300 font-bold'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          <Droplet className="w-5 h-5 mx-auto mb-1 text-blue-500" />
          <span className="text-xs">السكر</span>
        </button>

        <button
          onClick={() => setSelectedType('pulse')}
          className={`p-2.5 rounded-2xl border text-center transition ${
            selectedType === 'pulse'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-700 dark:text-emerald-300 font-bold'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          <Heart className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
          <span className="text-xs">النبض</span>
        </button>

        <button
          onClick={() => setSelectedType('temp')}
          className={`p-2.5 rounded-2xl border text-center transition ${
            selectedType === 'temp'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-700 dark:text-amber-300 font-bold'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          <Thermometer className="w-5 h-5 mx-auto mb-1 text-amber-500" />
          <span className="text-xs">الحرارة</span>
        </button>
      </div>

      {/* رسم بياني بصري بسيط للقراءات الأخيرة */}
      {filteredVitals.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">
            المخطط البصري لآخر القراءات ({selectedType === 'bp' ? 'ملم زئبق' : selectedType === 'sugar' ? 'مجم/دل' : selectedType === 'pulse' ? 'نبضة/د' : '°م'})
          </h3>
          <div className="flex items-end gap-2 h-28 pt-4 px-2 border-b border-slate-200 dark:border-slate-700">
            {filteredVitals.slice(-7).map((item, idx) => {
              const valNum = selectedType === 'bp' ? item.systolic || 120 : item.value || 100;
              const maxScale = selectedType === 'bp' ? 200 : selectedType === 'sugar' ? 300 : selectedType === 'pulse' ? 160 : 42;
              const heightPct = Math.min(100, Math.max(15, Math.round((valNum / maxScale) * 100)));
              const status = getVitalStatus(item);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                    {selectedType === 'bp' ? `${item.systolic}/${item.diastolic}` : item.value}
                  </span>
                  <div
                    className={`w-full max-w-[28px] rounded-t-lg transition-all ${
                      status.isDanger
                        ? 'bg-rose-500'
                        : status.isWarning
                        ? 'bg-amber-500'
                        : 'bg-teal-500'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[9px] text-slate-400 truncate w-full text-center">
                    {new Date(item.dateTime).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* قائمة القياسات السابقة */}
      <div className="space-y-2.5">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 px-1">
          سجل القراءات المسجلة ({filteredVitals.length})
        </h3>

        {filteredVitals.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 text-center border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500">
            لا توجد قياسات مسجلة لهذا النوع بعد. اضغط «تسجيل قياس» لإضافة قراءتك.
          </div>
        ) : (
          filteredVitals.map((v) => {
            const status = getVitalStatus(v);
            return (
              <div
                key={v.id}
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition ${
                  status.isDanger
                    ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'
                    : status.isWarning
                    ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      status.isDanger
                        ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/60'
                        : status.isWarning
                        ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/60'
                        : 'bg-teal-100 text-teal-600 dark:bg-teal-900/60'
                    }`}
                  >
                    {status.isDanger ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-800 dark:text-slate-100" dir="ltr">
                        {v.type === 'bp' ? `${v.systolic}/${v.diastolic} mmHg` : v.type === 'sugar' ? `${v.value} mg/dL` : v.type === 'pulse' ? `${v.value} bpm` : `${v.value} °C`}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          status.isDanger
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60'
                            : status.isWarning
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60'
                            : 'bg-teal-100 text-teal-700 dark:bg-teal-900/60'
                        }`}
                      >
                        {status.text}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>
                        {new Date(v.dateTime).toLocaleDateString('ar-EG', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {v.sugarContext && (
                        <span>
                          • {v.sugarContext === 'fasting' ? 'صائم' : v.sugarContext === 'post_prandial' ? 'بعد الأكل' : 'عشوائي'}
                        </span>
                      )}
                      {v.notes && <span>• {v.notes}</span>}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onDeleteVital(v.id)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* نافذة تسجيل قياس جديد */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                تسجيل قياس جديد
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نوع القياس
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as VitalType)}
                  className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-xs font-bold outline-none"
                >
                  <option value="bp">ضغط الدم (Blood Pressure)</option>
                  <option value="sugar">نسبة السكر (Blood Glucose)</option>
                  <option value="pulse">نبضات القلب (Pulse / BPM)</option>
                  <option value="temp">درجة الحرارة (Body Temp)</option>
                </select>
              </div>

              {formType === 'bp' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      الانقباضي (العالي)
                    </label>
                    <input
                      type="number"
                      dir="ltr"
                      value={systolic}
                      onChange={(e) => setSystolic(Number(e.target.value))}
                      placeholder="120"
                      className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-center text-base font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      الانبساطي (الواطي)
                    </label>
                    <input
                      type="number"
                      dir="ltr"
                      value={diastolic}
                      onChange={(e) => setDiastolic(Number(e.target.value))}
                      placeholder="80"
                      className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-center text-base font-bold outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    القيمة الرقمية ({formType === 'sugar' ? 'مجم/دل' : formType === 'pulse' ? 'نبضة/د' : 'درجة مئوية'})
                  </label>
                  <input
                    type="number"
                    step={formType === 'temp' ? '0.1' : '1'}
                    dir="ltr"
                    value={val}
                    onChange={(e) => setVal(Number(e.target.value))}
                    className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-center text-base font-bold outline-none"
                  />
                </div>
              )}

              {formType === 'sugar' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    سياق قياس السكر
                  </label>
                  <select
                    value={sugarContext}
                    onChange={(e) => setSugarContext(e.target.value as SugarContext)}
                    className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-xs font-bold outline-none"
                  >
                    <option value="fasting">صائم (8 ساعات نوم)</option>
                    <option value="post_prandial">بعد الأكل بساعتين</option>
                    <option value="random">عشوائي خلال اليوم</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الوقت والتاريخ
                </label>
                <input
                  type="datetime-local"
                  dir="ltr"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-xs font-semibold outline-none text-center"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظة إضافية (اختياري)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: بعد مجهود، صباحاً، مع دوار..."
                  className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-xs outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 h-12 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white rounded-xl font-bold text-xs shadow-md transition"
                >
                  حفظ القياس
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 h-12 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
