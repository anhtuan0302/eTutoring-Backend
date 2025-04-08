const Notification = require('../../models/communication/notification');
const { firebase, admin } = require('../../config/firebase');

const notificationsRef = firebase.ref('notifications');

exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Lấy notifications từ Firebase
    const snapshot = await notificationsRef
      .child(userId.toString())
      .orderByChild('created_at')
      .limitToLast(20)
      .once('value');
    
    const notifications = snapshot.val() || {};
    
    // Chuyển đổi object thành array và sắp xếp theo thời gian
    const notificationList = Object.entries(notifications)
      .map(([key, value]) => ({
        _id: key,
        ...value
      }))
      .sort((a, b) => b.created_at - a.created_at);

    res.status(200).json(notificationList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createNotification = async (req, res) => {
  try {
    const { user_id, content, notification_type, reference_type, reference_id } = req.body;

    if (!content || !notification_type || !user_id) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
    }

    // Tạo notification trong Firebase
    const userNotificationsRef = notificationsRef.child(user_id.toString());
    const newNotificationRef = userNotificationsRef.push();
    const notificationId = newNotificationRef.key;

    const notificationData = {
      content,
      notification_type,
      reference_type: reference_type || null,
      reference_id: reference_id ? reference_id.toString() : null,
      is_read: false,
      created_at: admin.database.ServerValue.TIMESTAMP,
      updated_at: admin.database.ServerValue.TIMESTAMP
    };

    // Lưu vào cả Firebase và MongoDB
    await Promise.all([
      newNotificationRef.set(notificationData),
      new Notification({
        _id: notificationId,
        user: user_id,
        content,
        notification_type,
        reference_type,
        reference_id,
        is_read: false
      }).save()
    ]);

    res.status(201).json({
      _id: notificationId,
      ...notificationData
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const notificationId = req.params.id;

    // Kiểm tra notification trong MongoDB
    const notification = await Notification.findOne({
      _id: notificationId,
      user: userId
    });

    if (!notification) {
      return res.status(404).json({ error: "Không tìm thấy thông báo" });
    }

    // Cập nhật trạng thái trong cả Firebase và MongoDB
    await Promise.all([
      notificationsRef
        .child(userId.toString())
        .child(notificationId)
        .update({
          is_read: true,
          updated_at: admin.database.ServerValue.TIMESTAMP
        }),
      Notification.findByIdAndUpdate(notificationId, {
        is_read: true
      })
    ]);

    res.status(200).json({ message: "Đã đánh dấu đã đọc" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    // Lấy tất cả notifications chưa đọc từ Firebase
    const snapshot = await notificationsRef
      .child(userId.toString())
      .orderByChild('is_read')
      .equalTo(false)
      .once('value');

    if (snapshot.exists()) {
      const updates = {};
      snapshot.forEach(child => {
        updates[`${child.key}/is_read`] = true;
        updates[`${child.key}/updated_at`] = admin.database.ServerValue.TIMESTAMP;
      });

      // Cập nhật đồng thời trong Firebase và MongoDB
      await Promise.all([
        notificationsRef.child(userId.toString()).update(updates),
        Notification.updateMany(
          { user: userId, is_read: false },
          { is_read: true }
        )
      ]);
    }

    res.status(200).json({ message: "Đã đánh dấu tất cả là đã đọc" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const snapshot = await notificationsRef
      .child(userId.toString())
      .orderByChild('is_read')
      .equalTo(false)
      .once('value');

    res.status(200).json({
      count: snapshot.numChildren()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};