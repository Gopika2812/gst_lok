const express = require('express');
const router = express.Router();
const {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  testPushNotification,
  getNotificationStatus
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/vapid-public-key', getVapidPublicKey);
router.post('/subscribe', protect, subscribe);
router.post('/unsubscribe', protect, unsubscribe);
router.post('/test-push', protect, testPushNotification);
router.get('/status', protect, getNotificationStatus);

module.exports = router;
