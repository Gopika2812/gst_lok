import api from './api';

// Helper to convert base64 VAPID public key to Uint8Array for PushManager
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const isPushNotificationSupported = () => {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
};

export const getNotificationPermission = () => {
  if (!isPushNotificationSupported()) return 'unsupported';
  return Notification.permission; // 'default', 'granted', 'denied'
};

// Register Service Worker
export const registerServiceWorker = async () => {
  if (!isPushNotificationSupported()) {
    console.warn('[Push Notification] Push notifications are not supported on this browser.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('[Service Worker] Registered successfully:', registration.scope);
    return registration;
  } catch (error) {
    console.error('[Service Worker] Registration failed:', error);
    return null;
  }
};

// Subscribe user device to Web Push notifications
export const subscribeToPushNotifications = async () => {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications are not supported on this device/browser.');
  }

  // 1. Request Notification Permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notification permission was denied. Please allow notifications in Chrome site settings.'
        : 'Notification permission was dismissed.'
    );
  }

  // 2. Ensure Service Worker is ready
  const registration = await navigator.serviceWorker.ready;

  // 3. Fetch VAPID Public Key from backend
  const { data: keyData } = await api.get('/notifications/vapid-public-key');
  const vapidPublicKey = keyData?.publicKey;
  if (!vapidPublicKey) {
    throw new Error('VAPID public key not received from server.');
  }

  const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

  // 4. Check for existing subscription or create new
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey
    });
  }

  // 5. Send subscription payload to backend
  const subJson = subscription.toJSON();
  await api.post('/notifications/subscribe', {
    endpoint: subJson.endpoint,
    keys: {
      p256dh: subJson.keys?.p256dh,
      auth: subJson.keys?.auth
    },
    userAgent: navigator.userAgent
  });

  return subscription;
};

// Unsubscribe user device
export const unsubscribeFromPushNotifications = async () => {
  if (!isPushNotificationSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await api.post('/notifications/unsubscribe', { endpoint });
    }
  } catch (error) {
    console.error('[Unsubscribe Error]', error);
  }
};

// Trigger a test lock-screen / Chrome push notification
export const sendTestPushNotification = async (delaySeconds = 0) => {
  const response = await api.post('/notifications/test-push', { delaySeconds });
  return response.data;
};

// Check backend registration status
export const fetchNotificationStatus = async () => {
  try {
    const { data } = await api.get('/notifications/status');
    return data;
  } catch (err) {
    return { isSubscribed: false, activeDeviceCount: 0 };
  }
};
