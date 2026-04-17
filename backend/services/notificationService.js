// services/notificationService.js — Reusable notification logic
'use strict';

const { getDb } = require('../config/database');

const createNotification = (userId, { type, title, message }) => {
  const db = getDb();
  try {
    const result = db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, read, created_at)
      VALUES (?, ?, ?, ?, 0, datetime('now'))
    `).run(userId, type || 'info', title, message);
    
    return { id: result.lastID, success: true };
  } catch (err) {
    console.error('[NotificationService] Create error:', err);
    return { success: false, error: err.message };
  }
};

const markRead = (userId, notificationId) => {
  const db = getDb();
  db.prepare(`UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?`)
    .run(notificationId, userId);
};

const markAllRead = (userId) => {
  const db = getDb();
  db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ?`)
    .run(userId);
};

const remove = (userId, notificationId) => {
  const db = getDb();
  db.prepare(`DELETE FROM notifications WHERE id = ? AND user_id = ?`)
    .run(notificationId, userId);
};

const listUserNotifications = (userId, limit = 20) => {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM notifications 
    WHERE user_id = ? 
    ORDER BY created_at DESC LIMIT ?
  `).all(userId, limit);
};

module.exports = {
  createNotification,
  markRead,
  markAllRead,
  remove,
  listUserNotifications
};
