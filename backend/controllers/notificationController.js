// controllers/notificationController.js — API endpoints for notifications
'use strict';

const notifService = require('../services/notificationService');

exports.getNotifications = (req, res) => {
  try {
    const list = notifService.listUserNotifications(req.user.id);
    res.json({ success: true, notifications: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.markRead = (req, res) => {
  const { id } = req.params;
  try {
    notifService.markRead(req.user.id, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.markAllRead = (req, res) => {
  try {
    notifService.markAllRead(req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteNotification = (req, res) => {
  const { id } = req.params;
  try {
    notifService.remove(req.user.id, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
