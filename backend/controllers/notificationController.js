const { vapidPublicKey } = require('../config/webPush');
const PushSubscription = require('../models/PushSubscription');
const { sendPushToUser } = require('../services/pushNotificationService');

// Get VAPID Public Key for frontend client subscription
exports.getVapidPublicKey = async (req, res) => {
  try {
    res.json({ publicKey: vapidPublicKey });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Save / Register Push Subscription for logged-in user
exports.subscribe = async (req, res) => {
  try {
    const { endpoint, keys, userAgent } = req.body;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ message: 'Invalid subscription payload' });
    }

    const subscription = await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        user: req.user._id,
        endpoint,
        keys,
        userAgent: userAgent || req.headers['user-agent'] || ''
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      message: 'Push subscription registered successfully',
      subscriptionId: subscription._id
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Unregister / Remove Push Subscription
exports.unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ message: 'Endpoint is required' });
    }

    await PushSubscription.deleteOne({ endpoint, user: req.user._id });
    res.json({ message: 'Push subscription removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Send Test Notification (Instant or Delayed for Lock Screen Testing)
exports.testPushNotification = async (req, res) => {
  try {
    const { delaySeconds = 0 } = req.body;
    const userId = req.user._id;
    const userName = req.user.name || 'User';

    const testPayload = {
      title: '🔔 Royal Accounting Alert',
      body: `Hi ${userName}! Task assignment alerts are active. Screen lock & Chrome notifications are working seamlessly.`,
      icon: '/logo_ra.jpeg',
      badge: '/logo_ra.jpeg',
      tag: 'test-notification',
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
      data: {
        url: '/tasks',
        test: true
      },
      actions: [
        { action: 'view', title: 'Open App' }
      ]
    };

    if (delaySeconds > 0) {
      // Delay push so user can lock mobile device
      setTimeout(async () => {
        await sendPushToUser(userId, testPayload);
      }, delaySeconds * 1000);

      return res.json({
        message: `Test notification scheduled! Please lock your phone screen now. Alert will appear in ${delaySeconds} seconds.`
      });
    } else {
      await sendPushToUser(userId, testPayload);
      return res.json({ message: 'Test notification sent successfully' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Notification Subscription Status for Current User
exports.getNotificationStatus = async (req, res) => {
  try {
    const count = await PushSubscription.countDocuments({ user: req.user._id });
    res.json({
      isSubscribed: count > 0,
      activeDeviceCount: count
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
