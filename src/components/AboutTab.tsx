/**
 * شاشة «من نحن»: نبذة عن المؤسس محمد وليد أبو عجور ورسالة تطبيق رفيقي
 */
import React, { useState } from 'react';
import { Heart, Award, GraduationCap, ShieldCheck, Mail, Sparkles, User } from 'lucide-react';

export const AboutTab: React.FC = () => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="space-y-4 pb-20">
      {/* بطاقة الترحيب والرؤية */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700 shadow-xs text-center">
        <div className="w-16 h-16 rounded-3xl bg-linear-to-br from-teal-500 to-teal-700 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-teal-500/20">
          <Heart className="w-8 h-8 fill-current" />
        </div>
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">
          رفيقي (RAFEEQI)
        </h2>
        <p className="text-xs text-teal-600 dark:text-teal-400 font-bold mt-0.5">
          رفيقك الذكي لإدارة الأدوية والرعاية الصحية اليومية
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-3 leading-relaxed max-w-md mx-auto">
          تم تصميم وبناء تطبيق رفيقي خصيصاً للمرضى وكبار السن وأسرهم في العالم العربي، لتسهيل الالتزام بمواعيد الدواء بدقة، وتفادي النسيان، وطمأنة المرافقين والأسرة لحظة بلحظة.
        </p>
      </div>

      {/* بطاقة المؤسس */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-start">
          {/* صورة المؤسس أو الـ Placeholder الجذاب */}
          <div className="relative shrink-0">
            {!imgError ? (
              <img
                src="/src/assets/founder.jpg"
                alt="محمد وليد أبو عجور"
                onError={() => setImgError(true)}
                className="w-24 h-24 rounded-3xl object-cover border-2 border-teal-500 shadow-md"
              />
            ) : (
              <div className="w-24 h-24 rounded-3xl bg-teal-50 dark:bg-teal-950/60 border-2 border-teal-500 flex flex-col items-center justify-center text-teal-600 shadow-md">
                <User className="w-10 h-10" />
                <span className="text-[10px] font-bold mt-1">المؤسس</span>
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-teal-600 text-white rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800">
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
              محمد وليد أبو عجور
            </h3>
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-teal-600 dark:text-teal-400 font-bold mt-0.5">
              <GraduationCap className="w-4 h-4" />
              <span>طالب بكلية التمريض — جامعة المنصورة</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed">
              «انطلقت فكرة رفيقي من واقع الممارسة السريرية والتعامل اليومي مع المرضى وكبار السن في المستشفيات والبيوت، حيث يشكل نسيان الأدوية وتداخلاتها تحدياً حقيقياً لسلامة المرضى. نسعى لأن يكون رفيقي هو اليد الحانية والسند الطبي الآمن لكل بيت عربي.»
            </p>
          </div>
        </div>
      </div>

      {/* المبادئ والضوابط */}
      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-3xl p-5 border border-slate-200 dark:border-slate-700 text-xs space-y-3">
        <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          قيم وضمانات رفيقي:
        </h4>
        <ul className="space-y-2 text-slate-600 dark:text-slate-300 list-disc list-inside">
          <li>
            <strong>الخصوصية التامة:</strong> بياناتك الصحية ملكك وحدك ولا تتم مشاركتها مع أي جهة إعلانية.
          </li>
          <li>
            <strong>العمل دون إنترنت:</strong> المنبّهات الأساسية وسجل الأدوية تعمل محلياً على جهازك دائماً.
          </li>
          <li>
            <strong>المصداقية الطبية:</strong> جميع النصائح التوجيهية مبنية على مراجع صيدلانية موثوقة.
          </li>
        </ul>
      </div>

      <div className="text-center text-[11px] text-slate-400">
        تطبيق رفيقي — الإصدار 1.0.0 (Capacitor Android Native)
      </div>
    </div>
  );
};
