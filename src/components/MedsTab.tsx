/**
 * شاشة الأدوية: إضافة وتعديل وحذف الأدوية، فحص التداخلات، والبحث الذكي
 */
import React, { useState } from 'react';
import {
  Pill,
  Plus,
  Trash2,
  Edit2,
  Search,
  Sparkles,
  AlertTriangle,
  Camera,
  Check,
  X,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { Medication, MedicationForm, FoodTiming } from '../types';
import { lookupDrug, checkInteractions, DrugInfoResponse } from '../utils/api';
import { compressImageFile } from '../utils/files';
import { formatDateYMD } from '../utils/storage';

interface MedsTabProps {
  medications: Medication[];
  onAddMedication: (med: Medication) => void;
  onUpdateMedication: (med: Medication) => void;
  onDeleteMedication: (id: string) => void;
}

const MED_FORMS: MedicationForm[] = [
  'أقراص',
  'كبسولات',
  'شراب',
  'حقن',
  'قطرة',
  'بخاخ',
  'كريم أو مرهم',
  'أخرى',
];

const FOOD_TIMINGS: FoodTiming[] = [
  'قبل الأكل',
  'بعد الأكل',
  'مع الأكل',
  'على معدة فارغة',
  'قبل النوم',
  'غير مرتبط بالطعام',
];

const DAYS_NAMES = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export const MedsTab: React.FC<MedsTabProps> = ({
  medications,
  onAddMedication,
  onUpdateMedication,
  onDeleteMedication,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);

  // حقول النموذج
  const [name, setName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [strength, setStrength] = useState('');
  const [form, setForm] = useState<MedicationForm>('أقراص');
  const [dose, setDose] = useState<number>(1);
  const [times, setTimes] = useState<string[]>(['08:00', '20:00']);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [startDate, setStartDate] = useState(formatDateYMD());
  const [endDate, setEndDate] = useState('');
  const [foodTiming, setFoodTiming] = useState<FoodTiming>('بعد الأكل');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [stock, setStock] = useState<number>(20);
  const [unitsPerStrip, setUnitsPerStrip] = useState<number>(10);
  const [stripsPerBox, setStripsPerBox] = useState<number>(2);
  const [boxPrice, setBoxPrice] = useState<number>(30);

  // حالات البحث الذكي وفحص التفاعلات
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<DrugInfoResponse | null>(null);
  const [lookupError, setLookupError] = useState('');

  const [interactionsModalOpen, setInteractionsModalOpen] = useState(false);
  const [selectedMedsForCheck, setSelectedMedsForCheck] = useState<string[]>([]);
  const [interactionsLoading, setInteractionsLoading] = useState(false);
  const [interactionsResult, setInteractionsResult] = useState<string | null>(null);
  const [interactionsError, setInteractionsError] = useState('');

  const openAddForm = () => {
    setEditingMed(null);
    setName('');
    setActiveIngredient('');
    setStrength('');
    setForm('أقراص');
    setDose(1);
    setTimes(['08:00']);
    setDays([0, 1, 2, 3, 4, 5, 6]);
    setStartDate(formatDateYMD());
    setEndDate('');
    setFoodTiming('بعد الأكل');
    setNotes('');
    setPhotoUrl('');
    setStock(20);
    setUnitsPerStrip(10);
    setStripsPerBox(2);
    setBoxPrice(30);
    setLookupResult(null);
    setLookupError('');
    setIsFormOpen(true);
  };

  const openEditForm = (med: Medication) => {
    setEditingMed(med);
    setName(med.name);
    setActiveIngredient(med.activeIngredient || '');
    setStrength(med.strength);
    setForm(med.form);
    setDose(med.dose);
    setTimes(med.times.length > 0 ? med.times : ['08:00']);
    setDays(med.days);
    setStartDate(med.startDate);
    setEndDate(med.endDate || '');
    setFoodTiming(med.foodTiming);
    setNotes(med.notes || '');
    setPhotoUrl(med.photoUrl || '');
    setStock(med.stock);
    setUnitsPerStrip(med.unitsPerStrip || 10);
    setStripsPerBox(med.stripsPerBox || 2);
    setBoxPrice(med.boxPrice || 0);
    setLookupResult(null);
    setLookupError('');
    setIsFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const medData: Medication = {
      id: editingMed ? editingMed.id : `med_${Date.now()}`,
      name: name.trim(),
      activeIngredient: activeIngredient.trim() || undefined,
      strength: strength.trim() || '—',
      form,
      dose: Number(dose) || 1,
      times: times.filter(Boolean),
      days,
      startDate,
      endDate: endDate || undefined,
      foodTiming,
      notes: notes.trim() || undefined,
      photoUrl: photoUrl || undefined,
      stock: Number(stock) || 0,
      unitsPerStrip: Number(unitsPerStrip) || undefined,
      stripsPerBox: Number(stripsPerBox) || undefined,
      boxPrice: Number(boxPrice) || undefined,
      active: true,
    };

    if (editingMed) {
      onUpdateMedication(medData);
    } else {
      onAddMedication(medData);
    }
    setIsFormOpen(false);
  };

  const handleLookupDrug = async () => {
    if (!name.trim()) {
      setLookupError('يرجى كتابة اسم الدواء أولاً للبحث عنه.');
      return;
    }
    setLookupLoading(true);
    setLookupError('');
    setLookupResult(null);

    try {
      const res = await lookupDrug(name.trim());
      setLookupResult(res);
      if (res.activeIngredients && res.activeIngredients.length > 0 && !activeIngredient) {
        setActiveIngredient(res.activeIngredients.join(', '));
      }
    } catch (err: any) {
      setLookupError(err?.message || 'تعذر جلب معلومات الدواء.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 800, 800, 0.7);
      setPhotoUrl(`data:${compressed.mimeType};base64,${compressed.base64}`);
    } catch (err) {
      console.warn('Photo compression failed:', err);
    }
  };

  const handleToggleDay = (dayIndex: number) => {
    if (days.includes(dayIndex)) {
      if (days.length > 1) {
        setDays(days.filter((d) => d !== dayIndex));
      }
    } else {
      setDays([...days, dayIndex].sort());
    }
  };

  const handleAddTime = () => {
    setTimes([...times, '12:00']);
  };

  const handleRemoveTime = (index: number) => {
    if (times.length > 1) {
      setTimes(times.filter((_, i) => i !== index));
    }
  };

  const handleTimeChange = (index: number, val: string) => {
    const newTimes = [...times];
    newTimes[index] = val;
    setTimes(newTimes);
  };

  // فحص التداخلات
  const handleRunInteractionsCheck = async () => {
    if (selectedMedsForCheck.length < 2) {
      setInteractionsError('يرجى تحديد دوائين على الأقل للتحقق من التداخلات.');
      return;
    }
    setInteractionsLoading(true);
    setInteractionsError('');
    setInteractionsResult(null);

    try {
      const payload = medications
        .filter((m) => selectedMedsForCheck.includes(m.id))
        .map((m) => ({
          name: m.name,
          strength: m.strength,
          form: m.form,
        }));

      const res = await checkInteractions(payload);
      setInteractionsResult(res.analysis);
    } catch (err: any) {
      setInteractionsError(err?.message || 'فشل فحص التفاعلات.');
    } finally {
      setInteractionsLoading(false);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* رأس التبويب والإجراءات */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            صيدليتي وأدويتي ({medications.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            إدارة الجرعات، التنبيهات، والمخزون
          </p>
        </div>
        <div className="flex items-center gap-2">
          {medications.length >= 2 && (
            <button
              onClick={() => {
                setSelectedMedsForCheck(medications.slice(0, 3).map((m) => m.id));
                setInteractionsModalOpen(true);
              }}
              className="h-10 px-3 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            >
              <ShieldAlert className="w-4 h-4" />
              فحص التفاعلات
            </button>
          )}
          <button
            onClick={openAddForm}
            className="h-10 px-3.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            إضافة دواء
          </button>
        </div>
      </div>

      {/* قائمة الأدوية */}
      {medications.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 text-center border border-dashed border-slate-300 dark:border-slate-700">
          <div className="w-16 h-16 bg-teal-50 dark:bg-teal-950 text-teal-600 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Pill className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            لم تسجل أي دواء حتى الآن
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
            أضف أدويتك اليومية مع المواعيد المناسبة لتنظيم جدولك والحفاظ على صحتك.
          </p>
          <button
            onClick={openAddForm}
            className="mt-4 px-4 py-2.5 bg-teal-600 text-white text-xs font-bold rounded-xl shadow-xs"
          >
            إضافة أول دواء الآن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {medications.map((med) => {
            const isLowStock = med.stock <= 5;
            return (
              <div
                key={med.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {med.photoUrl ? (
                        <img
                          src={med.photoUrl}
                          alt={med.name}
                          className="w-11 h-11 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                          <Pill className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                          {med.name}
                        </h4>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                          <span>{med.strength}</span>
                          <span>•</span>
                          <span>{med.form}</span>
                          {med.activeIngredient && (
                            <>
                              <span>•</span>
                              <span className="truncate">{med.activeIngredient}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditForm(med)}
                        className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف دواء ${med.name}؟`)) {
                            onDeleteMedication(med.id);
                          }
                        }}
                        className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center hover:bg-rose-100 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* مواعيد الجرعات وتوقيت الأكل */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs flex-wrap gap-2">
                    <div className="flex items-center gap-1 font-mono text-teal-600 dark:text-teal-400 font-bold" dir="ltr">
                      {med.times.join(' • ')}
                    </div>
                    <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md text-[11px] font-medium">
                      {med.foodTiming}
                    </span>
                  </div>

                  {med.notes && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-lg">
                      {med.notes}
                    </p>
                  )}
                </div>

                {/* المخزون والتكلفة */}
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                  <span
                    className={`font-semibold flex items-center gap-1 ${
                      isLowStock ? 'text-rose-600 font-bold' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {isLowStock && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                    المخزون: {med.stock} {med.form}
                  </span>
                  {med.boxPrice ? (
                    <span className="text-[11px] text-slate-400">
                      سعر العلبة: {med.boxPrice} ج.م / ر.س
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* نافذة إضافة / تعديل دواء */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {editingMed ? 'تعديل بيانات الدواء' : 'إضافة دواء جديد'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* اسم الدواء مع زر البحث الذكي */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم الدواء (تجاري أو علمي) *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: كونكور، بانادول، ميتفورمين..."
                    className="flex-1 h-11 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={handleLookupDrug}
                    disabled={lookupLoading}
                    className="h-11 px-3 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 transition"
                  >
                    <Sparkles className="w-4 h-4" />
                    {lookupLoading ? 'جاري البحث...' : 'بحث ذكي'}
                  </button>
                </div>
              </div>

              {/* نتائج البحث الذكي إن وجدت */}
              {lookupError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs rounded-xl border border-rose-200">
                  {lookupError}
                </div>
              )}
              {lookupResult && (
                <div className="p-3 bg-teal-50/70 dark:bg-teal-950/30 rounded-xl border border-teal-200 dark:border-teal-800 text-xs text-slate-700 dark:text-slate-200 space-y-1">
                  <div className="font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" /> معلومات من الذكاء الاصطناعي:
                  </div>
                  <div>{lookupResult.info}</div>
                  {lookupResult.usage && <div><strong>دواعي الاستعمال:</strong> {lookupResult.usage}</div>}
                  {lookupResult.warnings && <div className="text-amber-700 dark:text-amber-400"><strong>تحذيرات:</strong> {lookupResult.warnings}</div>}
                </div>
              )}

              {/* المادة الفعالة والتركيز */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    المادة الفعالة
                  </label>
                  <input
                    type="text"
                    value={activeIngredient}
                    onChange={(e) => setActiveIngredient(e.target.value)}
                    placeholder="Paracetamol"
                    className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    التركيز
                  </label>
                  <input
                    type="text"
                    value={strength}
                    onChange={(e) => setStrength(e.target.value)}
                    placeholder="مثال: 500 مجم"
                    className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
              </div>

              {/* شكل الدواء والجرعة */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    شكل الدواء
                  </label>
                  <select
                    value={form}
                    onChange={(e) => setForm(e.target.value as MedicationForm)}
                    className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none"
                  >
                    {MED_FORMS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الجرعة لكل موعد
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={dose}
                    onChange={(e) => setDose(Number(e.target.value))}
                    className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
              </div>

              {/* مواعيد أخذ الدواء */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    مواعيد الجرعات اليومية
                  </label>
                  <button
                    type="button"
                    onClick={handleAddTime}
                    className="text-xs text-teal-600 dark:text-teal-400 font-bold hover:underline"
                  >
                    + إضافة موعد
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {times.map((time, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-300 dark:border-slate-700">
                      <input
                        type="time"
                        value={time}
                        dir="ltr"
                        onChange={(e) => handleTimeChange(idx, e.target.value)}
                        className="flex-1 bg-transparent text-xs font-bold text-center outline-none"
                      />
                      {times.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTime(idx)}
                          className="w-6 h-6 rounded-md text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40 flex items-center justify-center"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* أيام الأسبوع */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  أيام التكرار
                </label>
                <div className="flex gap-1 justify-between">
                  {DAYS_NAMES.map((name, idx) => {
                    const isSelected = days.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleToggleDay(idx)}
                        className={`flex-1 h-9 rounded-xl text-xs font-bold transition ${
                          isSelected
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* توقيت الأكل وملاحظات */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    توقيت الأكل
                  </label>
                  <select
                    value={foodTiming}
                    onChange={(e) => setFoodTiming(e.target.value as FoodTiming)}
                    className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none"
                  >
                    {FOOD_TIMINGS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    المخزون الحالي ({form})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
              </div>

              {/* التكلفة والشرائط */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    سعر العلبة
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={boxPrice}
                    onChange={(e) => setBoxPrice(Number(e.target.value))}
                    placeholder="35"
                    className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-sm font-medium outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    صورة العلبة (اختياري)
                  </label>
                  <label className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center gap-1.5 text-xs text-slate-500 cursor-pointer hover:bg-slate-100">
                    <Camera className="w-4 h-4 text-teal-600" />
                    <span>{photoUrl ? 'تم اختيار صورة ✓' : 'التقاط/رفع'}</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* أزرار الحفظ والإلغاء */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 h-12 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white rounded-xl font-bold text-sm shadow-md transition"
                >
                  حفظ الدواء
                </button>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 h-12 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة فحص التداخلات الدوائية */}
      {interactionsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  فحص التفاعلات والتداخلات الدوائية
                </h3>
              </div>
              <button
                onClick={() => setInteractionsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              حدد الأدوية التي ترغب في فحص تعارضها مع بعضها (من 2 إلى 20 دواء):
            </p>

            <div className="space-y-2 max-h-48 overflow-y-auto mb-4 border border-slate-200 dark:border-slate-700 rounded-2xl p-2">
              {medications.map((m) => {
                const isSelected = selectedMedsForCheck.includes(m.id);
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedMedsForCheck(selectedMedsForCheck.filter((id) => id !== m.id));
                      } else {
                        setSelectedMedsForCheck([...selectedMedsForCheck, m.id]);
                      }
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition ${
                      isSelected
                        ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 font-bold border border-teal-300 dark:border-teal-700'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{m.name} ({m.strength})</span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 text-teal-600 rounded-md"
                    />
                  </div>
                );
              })}
            </div>

            {interactionsError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs rounded-xl mb-3 border border-rose-200">
                {interactionsError}
              </div>
            )}

            {interactionsResult && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed mb-4 max-h-60 overflow-y-auto">
                <div className="font-bold text-teal-700 dark:text-teal-300 mb-1 flex items-center gap-1">
                  📋 نتيجة التحليل:
                </div>
                {interactionsResult}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleRunInteractionsCheck}
                disabled={interactionsLoading || selectedMedsForCheck.length < 2}
                className="flex-1 h-12 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white rounded-xl font-bold text-xs shadow-md transition disabled:opacity-50"
              >
                {interactionsLoading ? 'جاري فحص التداخلات...' : 'بدء الفحص بالذكاء الاصطناعي'}
              </button>
              <button
                onClick={() => setInteractionsModalOpen(false)}
                className="px-4 h-12 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
