const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const notificationController = require('../../controllers/communication/notification');

router.get('/', auth, notificationController.getUserNotifications);
router.get('/unreadCount', auth, notificationController.getUnreadCount);
router.post('/', auth, notificationController.createNotification);
router.patch('/:id/read', auth, notificationController.markAsRead);
router.patch('/markAllRead', auth, notificationController.markAllAsRead);

module.exports = router;