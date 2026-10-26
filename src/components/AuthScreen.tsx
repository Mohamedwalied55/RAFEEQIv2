/**
 * شاشة تسجيل الدخول وإنشاء الحساب
 * يحدد المستخدم دوره لمرة واحدة عند التسجيل (مريض أو مرافق) دون إمكانية التبديل لاحقاً
 */
import React, { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { PhoneWithCountryPicker } from './PhoneWithCountryPicker';
import {
  saveUserProfileToCloud,
  initializePatientCloudDocument,
  generatePairingCode,
  linkCaregiverToPatient,
  getUserProfileFromCloud,
  findPatientCodeByUid,
} from '../utils/sync';
import { Storage } from '../utils/storage';
import {
  Pill,
  Lock,
  Mail,
  User,
  HeartHandshake,
  CheckCircle,
  Users,
  Check,
  ShieldCheck,
  Clock,
  RotateCcw,
} from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (profile: UserProfile, linkingWarning?: string) => void;
  onCancel?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess, onCancel }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [role, setRole] = useState<UserRole>('patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+20');
  const [patientCodeToLink, setPatientCodeToLink] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resendTimer, setResendTimer] = useState<number>(0);
  const [pendingRoleUser, setPendingRoleUser] = useState<{
    uid: string;
    email: string;
    displayName: string;
  } | null>(null);

  // عداد تنازلي لإعادة إرسال رابط استعادة كلمة السر
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const mapFirebaseError = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-email':
        return 'صيغة البريد الإلكتروني غير صحيحة.';
      case 'auth/user-disabled':
        return 'هذا الحساب تم تعطيله.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'البريد الإلكتروني أو كلمة السر غير صحيحة.';
      case 'auth/email-already-in-use':
        return 'هذا البريد الإلكتروني مسجل بالفعل بحساب آخر.';
      case 'auth/weak-password':
        return 'كلمة السر ضعيفة. يجب أن تتكون من 6 أحرف أو أرقام على الأقل.';
      case 'auth/network-request-failed':
        return 'تعذر الاتصال بالإنترنت. يرجى التحقق من الشبكة.';
      case 'auth/too-many-requests':
        return 'تم إرسال عدة طلبات في وقت قصير. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.';
      default:
        return err?.message || 'حدث خطأ أثناء المصادقة.';
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCred.user;

      // 1. محاولة قراءة الملف من Firestore مع التفريق بين غياب الملف وخطأ الشبكة
      let cloudProfile: UserProfile | null = null;
      let networkError = false;
      try {
        cloudProfile = await getUserProfileFromCloud(user.uid);
      } catch (err) {
        console.warn('Network error reading profile from cloud:', err);
        networkError = true;
      }

      let finalProfile: UserProfile;
      if (cloudProfile) {
        finalProfile = cloudProfile;
      } else if (networkError) {
        // فشل القراءة بسبب الشبكة: نستخدم النسخة المحلية لو لنفس المستخدم، وإلا نمنع الدخول
        const local = Storage.getUserProfile();
        if (local && local.uid === user.uid) {
          finalProfile = local;
        } else {
          setErrorMsg('تعذر تحميل بيانات حسابك، يرجى التحقق من الاتصال بالإنترنت والمحاولة مجدداً.');
          setLoading(false);
          return;
        }
      } else {
        // المستند غير موجود أصلاً في السحابة
        const local = Storage.getUserProfile();
        if (local && local.uid === user.uid) {
          finalProfile = local;
        } else {
          // عدم تحويل المرافق لمريض تلقائياً: اطلب من المستخدم تحديد الدور
          setPendingRoleUser({
            uid: user.uid,
            email: user.email || email.trim(),
            displayName: user.displayName || displayName || 'مستخدم رفيقي',
          });
          setLoading(false);
          return;
        }
      }

      Storage.saveUserProfile(finalProfile);
      try {
        await saveUserProfileToCloud(finalProfile);
      } catch {
        // ignore
      }
      onAuthSuccess(finalProfile);
    } catch (err: any) {
      setErrorMsg(mapFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResolvePendingRole = async (selectedRole: UserRole) => {
    if (!pendingRoleUser) return;
    setLoading(true);
    setErrorMsg('');
    try {
      // لو للمريض مستند سابق في السحابة نعيد استخدام نفس كود الربط حتى لا تضيع بياناته القديمة
      let existingPatientCode: string | null = null;
      if (selectedRole === 'patient') {
        existingPatientCode = await findPatientCodeByUid(pendingRoleUser.uid);
      }
      const pairingCode =
        selectedRole === 'patient' ? existingPatientCode || generatePairingCode() : undefined;
      const finalProfile: UserProfile = {
        uid: pendingRoleUser.uid,
        email: pendingRoleUser.email,
        displayName: pendingRoleUser.displayName,
        phone: phone || '',
        countryCode: countryCode || '+20',
        role: selectedRole,
        pairingCode,
        linkedPatientCodes: [],
        createdAt: new Date().toISOString(),
      };

      if (selectedRole === 'patient' && pairingCode && !existingPatientCode) {
        try {
          await initializePatientCloudDocument(pairingCode, finalProfile.uid, finalProfile.displayName);
        } catch (e) {
          console.warn('Could not initialize patient doc:', e);
        }
      }

      await saveUserProfileToCloud(finalProfile);
      Storage.saveUserProfile(finalProfile);
      onAuthSuccess(finalProfile);
    } catch (err) {
      setErrorMsg('حدث خطأ أثناء حفظ نوع الحساب. يرجى المحاولة مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!displayName.trim()) {
      setErrorMsg('يرجى كتابة الاسم الكريم.');
      return;
    }
    if (role === 'caregiver' && patientCodeToLink.trim() && !patientCodeToLink.trim().toUpperCase().startsWith('RAF-')) {
      setErrorMsg('كود ربط المريض يجب أن يبدأ بـ RAF-');
      return;
    }

    setLoading(true);

    try {
      // 1. إنشاء الحساب في Firebase Auth
      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCred.user.uid;

      let pairingCode: string | undefined = undefined;
      let linkedCodes: string[] = [];

      if (role === 'patient') {
        pairingCode = generatePairingCode();
      } else if (role === 'caregiver' && patientCodeToLink.trim()) {
        const cleanCode = patientCodeToLink.trim().toUpperCase();
        linkedCodes = [cleanCode];
      }

      const newProfile: UserProfile = {
        uid,
        email: email.trim(),
        displayName: displayName.trim(),
        phone: phone.trim(),
        countryCode,
        role,
        pairingCode,
        linkedPatientCodes: linkedCodes,
        activePatientCode: linkedCodes[0],
        createdAt: new Date().toISOString(),
      };

      // 2. حفظ ملف المستخدم في السحابة أولاً مع محاولات إعادة
      let savedToCloud = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await saveUserProfileToCloud(newProfile);
          savedToCloud = true;
          break;
        } catch (err) {
          console.warn(`Retry ${attempt}/3 saveUserProfileToCloud:`, err);
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      if (!savedToCloud) {
        // الحساب أُنشئ بالفعل في Firebase Auth، لذا إعادة التسجيل ستفشل (البريد مستخدم). ننقل المستخدم لتسجيل الدخول.
        setErrorMsg('تم إنشاء حسابك لكن تعذر حفظ بياناته في السحابة. سجّل دخولك الآن بنفس البريد وكلمة السر لإكمال الإعداد.');
        setMode('login');
        setLoading(false);
        return;
      }

      Storage.saveUserProfile(newProfile);

      // تهيئة مستند المريض السحابي إن كان الدور مريضاً
      if (role === 'patient' && pairingCode) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await initializePatientCloudDocument(pairingCode, uid, displayName.trim());
            break;
          } catch (err) {
            console.warn(`Retry ${attempt}/3 initializePatientCloudDocument:`, err);
          }
        }
      }

      // 3. ربط المرافق بالمريض إن كان هناك كود
      let linkingWarning: string | undefined = undefined;
      if (role === 'caregiver' && patientCodeToLink.trim()) {
        const cleanCode = patientCodeToLink.trim().toUpperCase();
        try {
          const linkRes = await linkCaregiverToPatient(cleanCode, uid);
          if (!linkRes.success) {
            linkingWarning = 'تعذر الربط بكود المريض حالياً. يمكنك الربط لاحقاً من داخل الإعدادات.';
          }
        } catch {
          linkingWarning = 'تعذر الربط بكود المريض حالياً. يمكنك الربط لاحقاً من داخل الإعدادات.';
        }
      }

      onAuthSuccess(newProfile, linkingWarning);
    } catch (err: any) {
      setErrorMsg(mapFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const RESET_SUCCESS_TEXT =
    'تم إرسال الرابط إلى بريدك. لو ما لقيتوش، افحص مجلد الرسائل غير المرغوبة (Spam/Junk) واضغط «ليست رسالة مزعجة». المرسل: رفيقي';

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('يرجى كتابة البريد الإلكتروني لإرسال رابط الاستعادة.');
      return;
    }
    if (resendTimer > 0) return;

    setErrorMsg('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMsg(RESET_SUCCESS_TEXT);
      setResendTimer(60);
    } catch (err: any) {
      const code = err?.code || '';
      // حماية الخصوصية: لا تكشف هل الإيميل مسجل أم لا (نفس الرسالة في الحالتين)
      if (code === 'auth/user-not-found') {
        setSuccessMsg(RESET_SUCCESS_TEXT);
        setResendTimer(60);
      } else if (code === 'auth/invalid-email') {
        setErrorMsg('صيغة البريد الإلكتروني غير صحيحة. يرجى التأكد من كتابة البريد بشكل سليم.');
      } else if (code === 'auth/too-many-requests') {
        setErrorMsg('تم إرسال عدة طلبات في وقت قصير. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.');
      } else if (code === 'auth/network-request-failed') {
        setErrorMsg('تعذر الاتصال بالإنترنت. يرجى التحقق من اتصال الشبكة.');
      } else {
        setErrorMsg(err?.message || 'حدث خطأ أثناء إرسال الرابط. يرجى المحاولة لاحقاً.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (pendingRoleUser) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80 dark:border-slate-800 text-center animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
            يرجى تحديد نوع حسابك
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            لم نجد دوراً مسجلاً لحسابك في السحابة. اختر كيف تود استخدام تطبيق رفيقي للمتابعة:
          </p>
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs text-center border border-rose-200 dark:border-rose-800">
              {errorMsg}
            </div>
          )}
          <div className="space-y-3">
            <button
              onClick={() => handleResolvePendingRole('patient')}
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Pill className="w-4 h-4" />
              <span>أنا مريض (أتابع أدويتي وقياساتي)</span>
            </button>
            <button
              onClick={() => handleResolvePendingRole('caregiver')}
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Users className="w-4 h-4" />
              <span>أنا مرافق (أتابع وأرعى مريضاً)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80 dark:border-slate-800 animate-in fade-in duration-200">
        {/* رأس الشاشة */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-2.5 shadow-inner">
            <Pill className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white">
            {mode === 'login' && 'تسجيل الدخول'}
            {mode === 'register' && 'إنشاء حساب جديد'}
            {mode === 'forgot' && 'استعادة كلمة السر'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {mode === 'login' && 'سجل دخولك وسيتم توجيهك مباشرة لواجهتك المناسبة'}
            {mode === 'register' && 'حدد دورك الأساسي لتهيئة الواجهة المخصصة لك'}
            {mode === 'forgot' && 'أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة التعيين'}
          </p>
        </div>

        {/* رسائل التنبيه والأخطاء */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            {errorMsg}
          </div>
        )}
        {successMsg && mode !== 'forgot' && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* نموذج تسجيل الدخول */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <input
                  type="email"
                  dir="ltr"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-12 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 pe-10 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500 text-start"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-4" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  كلمة السر
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setSuccessMsg('');
                    setMode('forgot');
                  }}
                  className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                >
                  نسيت كلمة السر؟
                </button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  dir="ltr"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 pe-10 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500 text-start"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-4" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50 mt-2"
            >
              {loading ? 'جاري التحقق وتوجيه الحساب...' : 'تسجيل الدخول'}
            </button>
          </form>
        )}

        {/* نموذج إنشاء حساب جديد باختيار إجباري للدور */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            {/* اختيار إجباري بين «أنا مريض» و«أنا مرافق» عبر بطاقتين كبار */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                اختر دورك (يحدد نوع الواجهة ولن يمكن تغييره لاحقاً) *
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* بطاقة المريض */}
                <div
                  onClick={() => setRole('patient')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    role === 'patient'
                      ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-600 flex items-center justify-center">
                      <Pill className="w-5 h-5" />
                    </div>
                    {role === 'patient' && (
                      <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    أنا مريض
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    لإدارة أدويتك اليومية، استلام المنبّهات بالصوت، وتوليد كود ربط لمشاركته مع أسرتك.
                  </p>
                </div>

                {/* بطاقة المرافق */}
                <div
                  onClick={() => setRole('caregiver')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    role === 'caregiver'
                      ? 'border-cyan-600 bg-cyan-50/70 dark:bg-cyan-950/40 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/60 text-cyan-600 flex items-center justify-center">
                      <HeartHandshake className="w-5 h-5" />
                    </div>
                    {role === 'caregiver' && (
                      <span className="w-6 h-6 rounded-full bg-cyan-600 text-white flex items-center justify-center text-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    أنا مرافق
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    لمتابعة جرعات والديك أو مرضاك عن بُعد، واستلام التنبيهات الحية فور أخذ الجرعة.
                  </p>
                </div>
              </div>
            </div>

            {/* الاسم */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                الاسم بالكامل *
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="مثال: أحمد محمد"
                className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* الهاتف بمفتاح الدولة */}
            <PhoneWithCountryPicker
              label="رقم الهاتف للتواصل والواتساب"
              countryCode={countryCode}
              phone={phone}
              onCountryCodeChange={setCountryCode}
              onPhoneChange={setPhone}
            />

            {/* البريد الإلكتروني */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                البريد الإلكتروني *
              </label>
              <input
                type="email"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500 text-start"
              />
            </div>

            {/* كلمة السر */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                كلمة السر (6 أحرف أو أرقام على الأقل) *
              </label>
              <input
                type="password"
                dir="ltr"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500 text-start"
              />
            </div>

            {/* كود ربط المريض في حال كان الدور مرافق */}
            {role === 'caregiver' && (
              <div className="bg-cyan-50 dark:bg-cyan-950/30 p-3 rounded-xl border border-cyan-200 dark:border-cyan-800">
                <label className="block text-xs font-bold text-cyan-800 dark:text-cyan-300 mb-1">
                  كود ربط المريض الآن (اختياري)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={patientCodeToLink}
                  onChange={(e) => setPatientCodeToLink(e.target.value.toUpperCase())}
                  placeholder="RAF-XXXXXXXX"
                  className="w-full h-10 bg-white dark:bg-slate-800 border border-cyan-300 dark:border-cyan-700 rounded-lg px-3 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 outline-none uppercase"
                />
                <p className="text-[10px] text-cyan-700 dark:text-cyan-400 mt-1">
                  إذا لم يكن الكود معك الآن، يمكنك تخطيه وإضافته من واجهة المرافق في أي وقت.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full h-12 text-white rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50 mt-2 ${
                role === 'caregiver'
                  ? 'bg-cyan-700 hover:bg-cyan-800'
                  : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              {loading
                ? 'جاري إنشاء الحساب...'
                : role === 'patient'
                ? 'إنشاء حساب مريض والبدء'
                : 'إنشاء حساب مرافق والبدء'}
            </button>
          </form>
        )}

        {/* نموذج نسيت كلمة السر */}
        {mode === 'forgot' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            {successMsg && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-slate-800 dark:text-slate-100 text-xs leading-relaxed space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>تم إرسال الرابط بنجاح</span>
                </div>
                <p className="text-slate-700 dark:text-slate-200 leading-relaxed font-normal">
                  تم إرسال الرابط إلى بريدك. لو ما لقيتوش، افحص مجلد الرسائل غير المرغوبة (Spam/Junk) واضغط «ليست رسالة مزعجة». المرسل: <strong className="text-teal-700 dark:text-teal-300 font-bold">رفيقي</strong>.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                البريد الإلكتروني المسجل
              </label>
              <div className="relative">
                <input
                  type="email"
                  dir="ltr"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-12 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 pe-10 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500 text-start"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-4" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || resendTimer > 0}
              className={`w-full h-12 rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 ${
                resendTimer > 0
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                  : 'bg-teal-600 hover:bg-teal-700 text-white'
              }`}
            >
              {loading ? (
                'جاري الإرسال...'
              ) : resendTimer > 0 ? (
                <>
                  <Clock className="w-4 h-4 animate-pulse text-amber-600 dark:text-amber-400" />
                  <span>إعادة الإرسال بعد ({resendTimer} ثانية)</span>
                </>
              ) : successMsg ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>إعادة الإرسال</span>
                </>
              ) : (
                'إرسال رابط استعادة كلمة السر'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setSuccessMsg('');
                setMode('login');
              }}
              className="w-full h-10 rounded-xl font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center gap-1.5"
            >
              العودة لتسجيل الدخول
            </button>
          </form>
        )}

        {/* التبديل بين الشاشات */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
          {mode === 'login' ? (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              ليس لديك حساب بعد؟{' '}
              <button
                onClick={() => {
                  setErrorMsg('');
                  setSuccessMsg('');
                  setMode('register');
                }}
                className="font-bold text-teal-600 dark:text-teal-400 hover:underline"
              >
                أنشئ حسابك وحدد دورك
              </button>
            </p>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              لديك حساب بالفعل؟{' '}
              <button
                onClick={() => {
                  setErrorMsg('');
                  setSuccessMsg('');
                  setMode('login');
                }}
                className="font-bold text-teal-600 dark:text-teal-400 hover:underline"
              >
                سجل الدخول الآن
              </button>
            </p>
          )}

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="mt-3 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              الاستمرار كزائر (مريض محلي)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
