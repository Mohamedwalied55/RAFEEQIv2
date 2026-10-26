/**
 * إدارة إشعارات المنبّه الحقيقي عبر نظام أندرويد باستخدام @capacitor/local-notifications
 * تعمل عندما يكون التطبيق مقفلاً في الخلفية
 */
import {
  LocalNotifications,
  ScheduleOptions,
  LocalNotificationSchema,
  Channel,
} from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Medication, DoseLog, AppSettings } from '../types';
import { formatDateYMD } from './storage';

export const ALARM_CHANNEL_ID = 'rafeeqi_alarm_v1';
export const TEST_ALARM_ID = 999999;
const MAX_NOTIFICATIONS_LIMIT = 400;

// تحويل نص المفتاح إلى رقم معرّف صحيح 32-bit ثابت
export function hashStringToNotificationId(str: string, offset = 0): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) + offset) % 2147483647;
}

/**
 * إنشاء قناة التنبيه المخصصة ذات الأهمية القصوى والصوت
 */
export async function setupAlarmChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const channel: Channel = {
      id: ALARM_CHANNEL_ID,
      name: 'منبّه الأدوية',
      description: 'إشعارات مواعيد الأدوية اليومية لتطبيق رفيقي',
      importance: 5, // High / Urgent
      visibility: 1, // Public
      sound: 'alarm.wav',
      vibration: true,
      lights: true,
      lightColor: '#0F9D8A',
    };
    await LocalNotifications.createChannel(channel);
  } catch (err) {
    console.warn('Could not create notification channel:', err);
  }
}

/**
 * فحص وطلب الأذونات
 */
export async function checkAlarmPermissions(): Promise<{
  display: boolean;
  exact: boolean;
}> {
  if (!Capacitor.isNativePlatform()) {
    const hasWebPerm = typeof Notification !== 'undefined' && Notification.permission === 'granted';
    return { display: hasWebPerm, exact: true };
  }

  let display = false;
  let exact = false;

  try {
    const perm = await LocalNotifications.checkPermissions();
    display = perm.display === 'granted';
  } catch (e) {
    console.warn('Error checking permissions:', e);
  }

  try {
    const exactSetting = await LocalNotifications.checkExactNotificationSetting();
    exact = exactSetting.exact_alarm === 'granted';
  } catch (e) {
    console.warn('Error checking exact notification setting:', e);
  }

  return { display, exact };
}

export async function requestDisplayPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    if (typeof Notification !== 'undefined') {
      const res = await Notification.requestPermission();
      return res === 'granted';
    }
    return false;
  }

  try {
    const req = await LocalNotifications.requestPermissions();
    return req.display === 'granted';
  } catch (e) {
    console.warn('Error requesting permissions:', e);
    return false;
  }
}

export async function openExactAlarmSettings(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.changeExactNotificationSetting();
    } catch (e) {
      console.warn('Error opening exact alarm settings:', e);
    }
  }
}

/**
 * إلغاء كافة الإشعارات المحلية المعلّقة
 * يحتفظ بإشعار الاختبار (999999) إن كان معلّقاً ما لم يُطلب إلغاؤه صراحة
 */
export async function cancelAllNativeAlarms(keepTestAlarm = true): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const toCancel = keepTestAlarm
      ? pending.notifications.filter((n) => n.id !== TEST_ALARM_ID)
      : pending.notifications;

    if (toCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: toCancel });
    }
  } catch (err) {
    console.warn('Error cancelling native alarms:', err);
  }
}

/**
 * جدولة إشعار حقيقي عند وقت التأجيل (Snooze)
 */
export async function scheduleSnoozeAlarm(
  med: Medication,
  doseKey: string,
  untilDate: Date
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await setupAlarmChannel();
    let snoozeId = hashStringToNotificationId(`snooze_${doseKey}`, 77);
    if (snoozeId === TEST_ALARM_ID) snoozeId = 999998;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: snoozeId,
          title: `⏰ تذكير مؤجل: موعد دواء ${med.name}`,
          body: `حان موعد الجرعة المؤجلة: ${med.dose} ${med.form} | ${med.foodTiming}`,
          channelId: ALARM_CHANNEL_ID,
          schedule: {
            at: untilDate,
            allowWhileIdle: true,
          },
          sound: 'alarm.wav',
          extra: {
            doseKey,
            medId: med.id,
            isSnooze: true,
          },
        },
      ],
    });
  } catch (err) {
    console.warn('Failed to schedule snooze alarm:', err);
  }
}

// قفل وسلسلة Promise لمنع تداخل عمليات الجدولة المتزامنة
let schedulingChain: Promise<{ count: number }> = Promise.resolve({ count: 0 });

export function rescheduleNativeAlarms(
  medications: Medication[],
  doseLogs: Record<string, DoseLog>,
  settings: AppSettings
): Promise<{ count: number }> {
  schedulingChain = schedulingChain
    .then(async () => {
      return await executeRescheduleNativeAlarms(medications, doseLogs, settings);
    })
    .catch((err) => {
      console.error('Error in rescheduleNativeAlarms queue:', err);
      return { count: 0 };
    });
  return schedulingChain;
}

/**
 * التنفيذ الفعلي لجدولة الإشعارات
 */
async function executeRescheduleNativeAlarms(
  medications: Medication[],
  doseLogs: Record<string, DoseLog>,
  settings: AppSettings
): Promise<{ count: number }> {
  if (!Capacitor.isNativePlatform()) {
    return { count: 0 };
  }

  try {
    await setupAlarmChannel();

    // 1. مسح الإشعارات المجدولة السابقة مع الحفاظ على إشعار الاختبار
    await cancelAllNativeAlarms(true);

    const notificationsToSchedule: LocalNotificationSchema[] = [];
    const usedIds = new Set<number>();
    const now = new Date();
    const repeatMinutes = Math.max(1, settings.repeatAlarmMinutes || 5);
    const repeatCount = Math.min(5, Math.max(0, settings.repeatAlarmCount || 3));

    // دالة توليد معرّف فريد مضمون عدم التكرار في الدفعة ولا يساوي 999999
    const getUniqueId = (baseStr: string, offset = 0): number => {
      let id = hashStringToNotificationId(baseStr, offset);
      if (id === TEST_ALARM_ID) id = 999998;
      while (usedIds.has(id) || id === TEST_ALARM_ID) {
        id = (id + 1) % 2147483640;
        if (id <= 0) id = 1;
        if (id === TEST_ALARM_ID) id = 1000000;
      }
      usedIds.add(id);
      return id;
    };

    // فلترة أدوية الأمثلة التجريبية
    const realMeds = medications.filter(
      (m) => m.active && !m.isExample && !m.id.startsWith('med_sample_')
    );

    // فحص الأيام السبعة القادمة (0 إلى 6) باستخدام التاريخ المحلي الدقيق
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      if (notificationsToSchedule.length >= MAX_NOTIFICATIONS_LIMIT) break;

      const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
      const dayOfWeek = targetDate.getDay();
      const dateStr = formatDateYMD(targetDate);

      for (const med of realMeds) {
        if (!med.days.includes(dayOfWeek)) continue;
        if (med.startDate && dateStr < med.startDate) continue;
        if (med.endDate && dateStr > med.endDate) continue;

        for (const timeStr of med.times) {
          if (notificationsToSchedule.length >= MAX_NOTIFICATIONS_LIMIT) break;

          const doseKey = `${med.id}_${dateStr}_${timeStr}`;
          const existingLog = doseLogs[doseKey];

          // إذا تم أخذ الجرعة أو تخطيها، لا نجدول تنبيهاً
          if (existingLog && (existingLog.status === 'taken' || existingLog.status === 'skipped')) {
            continue;
          }

          const [hh, mm] = timeStr.split(':').map((v) => parseInt(v, 10));
          const scheduleDateTime = new Date(
            targetDate.getFullYear(),
            targetDate.getMonth(),
            targetDate.getDate(),
            hh,
            mm,
            0,
            0
          );

          // إذا كانت الجرعة مؤجلة: جدول وقت التأجيل إن كان في المستقبل، وتجاوز الموعد في جميع الأحوال دون تكرار
          if (existingLog?.status === 'snoozed') {
            if (existingLog.until) {
              const snoozeUntil = new Date(existingLog.until);
              if (snoozeUntil.getTime() > now.getTime()) {
                const snoozeId = getUniqueId(doseKey, 500);
                notificationsToSchedule.push({
                  id: snoozeId,
                  title: `⏰ تذكير مؤجل: ${med.name}`,
                  body: `حان موعد الجرعة المؤجلة: ${med.dose} ${med.form} - ${med.foodTiming}`,
                  channelId: ALARM_CHANNEL_ID,
                  schedule: {
                    at: snoozeUntil,
                    allowWhileIdle: true,
                  },
                  sound: 'alarm.wav',
                  extra: {
                    doseKey,
                    medId: med.id,
                    timeStr,
                    dateStr,
                    isSnoozed: true,
                  },
                });
              }
            }
            // إذا كانت الجرعة snoozed وانتهى until (أو تمت جدولتها)، لا نجدول إشعاراً أساسياً جديداً ولا تكرارات
            continue;
          }

          // إذا كان الموعد الأصلي قد مضى اليوم بأكثر من 30 دقيقة ولم يُؤجّل، نتجاوزه
          if (scheduleDateTime.getTime() <= now.getTime() - 30 * 60 * 1000) {
            continue;
          }

          const isFuture = scheduleDateTime.getTime() > now.getTime();
          const baseAt = isFuture ? scheduleDateTime : new Date(now.getTime() + 5000);

          const title = `💊 حان موعد دواء ${med.name}`;
          const body = `الجرعة: ${med.dose} ${med.form} | ${med.foodTiming} (الموعد: ${timeStr})`;

          // الإشعار الأساسي
          const primaryId = getUniqueId(doseKey, 0);
          notificationsToSchedule.push({
            id: primaryId,
            title,
            body,
            channelId: ALARM_CHANNEL_ID,
            schedule: {
              at: baseAt,
              allowWhileIdle: true,
            },
            sound: 'alarm.wav',
            extra: {
              doseKey,
              medId: med.id,
              timeStr,
              dateStr,
            },
          });

          // تكرارات المنبّه (أول يومين فقط لتوفير حصة الإشعارات)
          if (dayOffset <= 1 && repeatCount > 0) {
            for (let r = 1; r <= repeatCount; r++) {
              if (notificationsToSchedule.length >= MAX_NOTIFICATIONS_LIMIT) break;

              const repeatAt = new Date(baseAt.getTime() + r * repeatMinutes * 60 * 1000);
              const repeatId = getUniqueId(doseKey, r);

              notificationsToSchedule.push({
                id: repeatId,
                title: `⏰ تذكير متكرر (${r}/${repeatCount}): ${med.name}`,
                body: `لم يتم تأكيد الجرعة بعد! ${med.dose} ${med.form} - ${med.foodTiming}`,
                channelId: ALARM_CHANNEL_ID,
                schedule: {
                  at: repeatAt,
                  allowWhileIdle: true,
                },
                sound: 'alarm.wav',
                extra: {
                  doseKey,
                  medId: med.id,
                  isRepeat: true,
                  repeatIndex: r,
                },
              });
            }
          }
        }
      }
    }

    if (notificationsToSchedule.length > 0) {
      const safeBatch = notificationsToSchedule.slice(0, MAX_NOTIFICATIONS_LIMIT);
      const options: ScheduleOptions = {
        notifications: safeBatch,
      };
      await LocalNotifications.schedule(options);
      return { count: safeBatch.length };
    }

    return { count: 0 };
  } catch (err) {
    console.error('Failed to reschedule native alarms:', err);
    return { count: 0 };
  }
}

/**
 * زر اختبار المنبّه: يجدول إشعاراً بعد 10 ثوانٍ بمعرّف خاص 999999
 */
export async function scheduleTestAlarm(): Promise<{ success: boolean; message: string }> {
  if (!Capacitor.isNativePlatform()) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      setTimeout(() => {
        new Notification('🔔 اختبار منبّه رفيقي', {
          body: 'هذا إشعار تجريبي للمنبّه. يعمل النظام بكفاءة!',
          icon: '/favicon.ico',
        });
      }, 10000);
      return {
        success: true,
        message: 'تم جدولة الإشعار التجريبي بعد 10 ثوانٍ في المتصفح.',
      };
    }
    return {
      success: true,
      message: 'المنبّه الحقيقي والتكرار يعملان على أندرويد عبر تطبيق APK.',
    };
  }

  try {
    await setupAlarmChannel();
    const at = new Date(Date.now() + 10000);

    await LocalNotifications.schedule({
      notifications: [
        {
          id: TEST_ALARM_ID,
          title: '🔔 اختبار منبّه رفيقي الناجح!',
          body: 'المنبّه يعمل الآن بدقة حتى مع إغلاق التطبيق. صحتك بأمان مع رفيقي.',
          channelId: ALARM_CHANNEL_ID,
          schedule: {
            at,
            allowWhileIdle: true,
          },
          sound: 'alarm.wav',
        },
      ],
    });

    return {
      success: true,
      message: 'تمت الجدولة بعد 10 ثوانٍ. اقفل التطبيق الآن وانتظر الإشعار!',
    };
  } catch (err) {
    return {
      success: false,
      message: (err as Error)?.message || 'فشل جدولة إشعار الاختبار',
    };
  }
}

