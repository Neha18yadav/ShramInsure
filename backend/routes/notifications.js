// routes/notifications.js — User notification routes
'use strict';

const router = require('express').Router();
const notifCtrl = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.get('/',         protect, notifCtrl.getNotifications);
router.patch('/read-all', protect, notifCtrl.markAllRead);
router.patch('/:id/read', protect, notifCtrl.markRead);
router.delete('/:id',   protect, notifCtrl.deleteNotification);

module.exports = router;
