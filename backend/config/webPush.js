const webpush = require('web-push');

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BLdu2BWm3tw8Mcj4RqifFgrlQgdUZzFnffZZTuGcJB_UdH9yrWAXbd4ZA6UL_UDV_x_JyoOUWmpv8kmXkYt8WHI';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'CwIg36hWSE-kRc-LsYtDnH-T2oo5MgMlEvTRcEHwNG0';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@royalaccounting.in';

webpush.setVapidDetails(
  vapidSubject,
  vapidPublicKey,
  vapidPrivateKey
);

module.exports = {
  webpush,
  vapidPublicKey
};
