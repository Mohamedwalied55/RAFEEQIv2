/**
 * إدارة وتلقي الإشعارات داخل التطبيق
 */
import { LocalNotifications, ActionPerformed } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export type NotificationActionHandler = (action: ActionPerformed) => void;

export function registerNotificationListeners(handler: NotificationActionHandler): () => void {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }

  let removeListener: (() => void) | null = null;

  try {
    const subPromise = LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
      handler(notification);
    });

    subPromise.then((sub) => {
      removeListener = () => {
        sub.remove();
      };
    });
  } catch (err) {
    console.warn('Could not register notification action listener:', err);
  }

  return () => {
    if (removeListener) {
      removeListener();
    }
  };
}
