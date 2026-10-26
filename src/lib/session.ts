/**
 * إدارة الجلسة وتسجيل الخروج المركزي (Session Management)
 * تنفذ كل خطوات إنهاء الجلسة بالترتيب الصارم لضمان عدم تسرب أي بيانات بين المستخدمين
 */
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { cancelAllNativeAlarms } from '../utils/nativeAlarms';
import { stopRepeatingAlarm } from '../utils/audio';
import { Storage } from '../utils/storage';

// سجل للاشتراكات والمؤقتات النشطة لإلغائها فورياً عند الخروج
type CleanupCallback = () => void;
const activeCleanups: Set<CleanupCallback> = new Set();
const activeIntervals: Set<number> = new Set();

/**
 * تسجيل دالة تنظيف (مثل unsubscribe من onSnapshot)
 */
export function registerSessionCleanup(cleanup: CleanupCallback): () => void {
  activeCleanups.add(cleanup);
  return () => {
    activeCleanups.delete(cleanup);
  };
}

/**
 * تسجيل مؤقت setInterval نشط لإلغائه عند الخروج
 */
export function registerSessionInterval(intervalId: number): void {
  activeIntervals.add(intervalId);
}

export function unregisterSessionInterval(intervalId: number): void {
  activeIntervals.delete(intervalId);
}

/**
 * دالة تسجيل الخروج المركزية الموحدة
 * تنفذ:
 * 1. stopRepeatingAlarm()
 * 2. إلغاء الإشعارات المحلية
 * 3. unsubscribe لأي onSnapshot ومؤقتات
 * 4. await signOut(auth) داخل try/catch وعرض الخطأ الفعلي إن فشل
 * 5. مسح مفاتيح localStorage وتصفير حالة React
 */
export async function logout(options?: {
  onSuccess?: () => void;
  onError?: (errMessage: string) => void;
}): Promise<boolean> {
  try {
    // 1. stopRepeatingAlarm()
    try {
      stopRepeatingAlarm();
    } catch (e) {
      console.warn('stopRepeatingAlarm warning:', e);
    }

    // 2. إلغاء الإشعارات المحلية المعلّقة
    try {
      await cancelAllNativeAlarms();
    } catch (e) {
      console.warn('cancelAllNativeAlarms warning:', e);
    }

    // 3. unsubscribe لأي onSnapshot وإيقاف المؤقتات
    activeCleanups.forEach((cleanup) => {
      try {
        cleanup();
      } catch (err) {
        console.warn('Error during session cleanup:', err);
      }
    });
    activeCleanups.clear();

    activeIntervals.forEach((intId) => {
      try {
        clearInterval(intId);
      } catch {
        // ignore
      }
    });
    activeIntervals.clear();

    // 4. await signOut(auth) داخل try/catch، ولو فشل عرض رسالة الخطأ الفعلية للمستخدم
    try {
      await signOut(auth);
    } catch (authError: any) {
      console.error('Firebase signOut error:', authError);
      const actualError = authError?.message || 'فشل الاتصال بـ Firebase لإنهاء الجلسة.';
      if (options?.onError) {
        options.onError(actualError);
      }
      return false;
    }

    // 5. مسح مفاتيح المستخدم من localStorage وتصفير حالة React
    Storage.clearUserData();
    if (options?.onSuccess) {
      options.onSuccess();
    }

    return true;
  } catch (err: any) {
    console.error('Fatal error during logout:', err);
    const msg = err?.message || 'حدث خطأ أثناء تسجيل الخروج';
    if (options?.onError) {
      options.onError(msg);
    }
    return false;
  }
}
