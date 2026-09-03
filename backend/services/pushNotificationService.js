const { webpush } = require('../config/webPush');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');

/**
 * Send Web Push Notification to a user across all their registered devices
 */
const sendPushToUser = async (userId, payload) => {
  try {
    if (!userId) return;

    const subscriptions = await PushSubscription.find({ user: userId });
    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[Push Notification] No push subscriptions found for user ID: ${userId}`);
      return;
    }

    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        const pushSubscriptionObj = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth
          }
        };

        await webpush.sendNotification(pushSubscriptionObj, payloadString);
        console.log(`[Push Notification] Successfully dispatched to endpoint: ${sub.endpoint.slice(0, 30)}...`);
      } catch (err) {
        console.error(`[Push Notification Error] Failed to send push: ${err.statusCode || err.message}`);
        // If subscription is expired or unlinked (404 / 410 Gone), remove from database
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[Push Notification] Removing expired subscription for endpoint: ${sub.endpoint.slice(0, 30)}...`);
          await PushSubscription.deleteOne({ _id: sub._id });
        }
      }
    });

    await Promise.allSettled(sendPromises);
  } catch (error) {
    console.error('[Push Notification Error]', error.message);
  }
};

/**
 * Send Push Notification for Task Assignment / Delegation
 */
const sendTaskAssignedPushNotification = async (task, assignedEmployeeId, assignedById) => {
  try {
    if (!assignedEmployeeId) return;

    // Fetch details of assigned by user if id provided
    let assignedByName = 'Admin';
    if (assignedById) {
      const assigner = await User.findById(assignedById).select('name role');
      if (assigner) assignedByName = assigner.name;
    }

    const dueDateStr = task.dueDate
      ? new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'No deadline';

    const payload = {
      title: `🎯 New Task: ${task.taskName}`,
      body: `📋 Dept: ${task.department || 'General'} | Priority: ${task.priority || 'Medium'}\n👤 Assigned By: ${assignedByName}\n📅 Due: ${dueDateStr}`,
      icon: '/logo_ra.jpeg',
      badge: '/logo_ra.jpeg',
      tag: `task-${task._id}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
      data: {
        url: '/tasks',
        taskId: task._id?.toString()
      },
      actions: [
        { action: 'view', title: 'Open Task' }
      ]
    };

    await sendPushToUser(assignedEmployeeId, payload);
  } catch (error) {
    console.error('[Send Task Push Error]', error.message);
  }
};

module.exports = {
  sendPushToUser,
  sendTaskAssignedPushNotification
};
