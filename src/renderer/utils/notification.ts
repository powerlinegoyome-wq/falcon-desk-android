import { LocalNotifications } from '@capacitor/local-notifications';
import { Chat, Message } from '../../types';

let isChannelCreated = false;
let isPermissionRequested = false;

export async function initNotifications(onNotificationClick?: (chatId: number) => void): Promise<void> {
  try {
    if (!isPermissionRequested) {
      isPermissionRequested = true;
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
    }

    // Create high-priority Notification Channel for Android
    if (!isChannelCreated) {
      try {
        await LocalNotifications.createChannel({
          id: 'falcon_messages',
          name: 'Yeni Mesajlar',
          description: 'Telegram botunuza gelen yeni müşteri mesajları',
          importance: 5, // High priority / Heads-up notification
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: '#3B82F6',
        });
        isChannelCreated = true;
      } catch (channelErr) {
        console.warn('Could not create notification channel:', channelErr);
      }
    }

    // Listen to notification click events to open the specific chat
    LocalNotifications.removeAllListeners();
    LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
      const chatId = notificationAction.notification.extra?.chatId;
      if (chatId && onNotificationClick) {
        onNotificationClick(Number(chatId));
      }
    });
  } catch (err) {
    console.warn('Local notifications init error:', err);
    // Fallback to browser Notification API
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {}
    }
  }
}

export async function showIncomingMessageNotification(chat: Chat, message: Message): Promise<void> {
  try {
    const senderName = `${chat.firstName} ${chat.lastName || ''}`.trim() || 'Kullanıcı';
    const title = chat.username ? `${senderName} (@${chat.username})` : senderName;

    let body = message.content || '';
    if (message.messageType === 'photo') {
      body = message.content ? `📷 ${message.content}` : '📷 Yeni bir fotoğraf gönderdi';
    } else if (message.messageType === 'document') {
      body = `📎 Belge: ${message.mediaName || 'Dosya'}`;
    } else if (message.messageType === 'voice') {
      body = '🎤 Sesli mesaj gönderdi';
    } else if (message.messageType === 'sticker') {
      body = message.content ? `🏷️ ${message.content}` : '🏷️ Çıkartma gönderdi';
    }

    // Trigger physical vibration
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([150, 75, 150]);
      } catch {}
    }

    // Schedule native Android notification
    const notifId = Math.floor(Math.random() * 1000000);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title,
          body,
          channelId: 'falcon_messages',
          smallIcon: 'ic_launcher_foreground',
          largeIcon: 'splash',
          schedule: { at: new Date(Date.now() + 50) },
          extra: {
            chatId: chat.id,
          },
        },
      ],
    });
  } catch (err) {
    console.warn('Error scheduling native local notification, falling back to Web Notification:', err);
    // Fallback to Web Notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const senderName = `${chat.firstName} ${chat.lastName || ''}`.trim() || 'Kullanıcı';
        new Notification(senderName, {
          body: message.content || 'Yeni bir mesaj gönderdi',
          icon: '/logo.png',
        });
      } catch {}
    }
  }
}
