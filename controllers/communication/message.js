const Message = require("../../models/communication/message");
const { firebase, admin } = require('../../config/firebase');
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Cấu hình multer cho upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/chat";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

exports.upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

exports.sendMessage = async (req, res) => {
  try {
    const { conversation_id, content } = req.body;
    const sender_id = req.user._id;

    if (!conversation_id || (!content && !req.file)) {
      return res.status(400).json({ 
        error: "Thiếu thông tin bắt buộc hoặc file đính kèm" 
      });
    }

    // Tạo message mới trong Firebase
    const messagesRef = firebase.ref(`messages/${conversation_id}`);
    const newMessageRef = messagesRef.push();
    const messageId = newMessageRef.key;

    // Xử lý attachment nếu có
    let attachment = null;
    if (req.file) {
      attachment = {
        file_name: req.file.originalname,
        file_type: req.file.mimetype,
        file_path: req.file.path,
        file_size: req.file.size
      };
    }

    const messageData = {
      _id: messageId,
      conversation_id,
      sender_id: sender_id.toString(),
      content: content?.trim() || null,
      attachment,
      is_read: false,
      is_edited: false,
      is_deleted: false,
      created_at: admin.database.ServerValue.TIMESTAMP,
      updated_at: admin.database.ServerValue.TIMESTAMP
    };

    await Promise.all([
      // Lưu message vào Firebase
      newMessageRef.set(messageData),
      // Cập nhật last_message trong conversation
      firebase.ref(`conversations/${conversation_id}`).update({
        last_message: content?.trim() || "Đã gửi một file đính kèm",
        last_message_at: admin.database.ServerValue.TIMESTAMP,
        updated_at: admin.database.ServerValue.TIMESTAMP
      }),
      // Lưu reference vào MongoDB
      new Message({
        _id: messageId,
        conversation_id,
        sender_id
      }).save()
    ]);

    res.status(201).json(messageData);
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { conversation_id } = req.params;
    const userId = req.user._id.toString();

    const messagesRef = firebase.ref(`messages/${conversation_id}`);
    const snapshot = await messagesRef
      .orderByChild('created_at')
      .once('value');

    const messages = [];
    snapshot.forEach((childSnapshot) => {
      const message = childSnapshot.val();
      if (!message.is_deleted) {
        messages.push(message);
      }
    });

    // Đánh dấu đã đọc
    const updates = {};
    messages.forEach(msg => {
      if (msg.sender_id !== userId && !msg.is_read) {
        updates[`${msg._id}/is_read`] = true;
        updates[`${msg._id}/read_at`] = admin.database.ServerValue.TIMESTAMP;
      }
    });

    if (Object.keys(updates).length > 0) {
      await messagesRef.update(updates);
    }

    res.status(200).json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();
    const { content } = req.body;

    // Tìm message trong MongoDB để verify
    const message = await Message.findOne({
      _id: id,
      sender_id: userId
    });

    if (!message) {
      return res.status(404).json({ error: "Không tìm thấy tin nhắn hoặc bạn không có quyền sửa" });
    }

    // Tìm message trong Firebase
    const messageRef = firebase.ref(`messages/${message.conversation_id}`);
    const snapshot = await messageRef.orderByChild('_id').equalTo(id).once('value');
    
    if (!snapshot.exists()) {
      return res.status(404).json({ error: "Không tìm thấy tin nhắn" });
    }

    const messageKey = Object.keys(snapshot.val())[0];
    const messageData = snapshot.val()[messageKey];

    // Kiểm tra điều kiện chỉnh sửa
    if (messageData.is_deleted) {
      return res.status(400).json({ error: "Không thể sửa tin nhắn đã thu hồi" });
    }

    const timeDiff = Date.now() - messageData.created_at;
    if (timeDiff > 5 * 60 * 1000) { // 5 phút
      return res.status(400).json({ error: "Không thể sửa tin nhắn sau 5 phút" });
    }

    // Cập nhật tin nhắn
    const updates = {
      content: content.trim(),
      is_edited: true,
      updated_at: admin.database.ServerValue.TIMESTAMP
    };

    await messageRef.child(messageKey).update(updates);

    // Cập nhật last_message nếu cần
    const conversationRef = firebase.ref(`conversations/${message.conversation_id}`);
    const convSnapshot = await conversationRef.once('value');
    const conversation = convSnapshot.val();

    if (conversation.last_message === messageData.content) {
      await conversationRef.update({
        last_message: content.trim(),
        updated_at: admin.database.ServerValue.TIMESTAMP
      });
    }

    res.status(200).json({
      ...messageData,
      ...updates,
      updated_at: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();

    // Tìm message trong MongoDB để verify
    const message = await Message.findOne({
      _id: id,
      sender_id: userId
    });

    if (!message) {
      return res.status(404).json({ error: "Không tìm thấy tin nhắn hoặc bạn không có quyền xóa" });
    }

    // Tìm và cập nhật message trong Firebase
    const messageRef = firebase.ref(`messages/${message.conversation_id}`);
    const snapshot = await messageRef.orderByChild('_id').equalTo(id).once('value');
    
    if (!snapshot.exists()) {
      return res.status(404).json({ error: "Không tìm thấy tin nhắn" });
    }

    const messageKey = Object.keys(snapshot.val())[0];
    const messageData = snapshot.val()[messageKey];

    // Xóa file đính kèm nếu có
    if (messageData.attachment) {
      const filePath = path.join(__dirname, "../../../", messageData.attachment.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Cập nhật trạng thái tin nhắn
    await messageRef.child(messageKey).update({
      content: null,
      attachment: null,
      is_deleted: true,
      deleted_at: admin.database.ServerValue.TIMESTAMP,
      updated_at: admin.database.ServerValue.TIMESTAMP
    });

    // Cập nhật last_message trong conversation nếu cần
    const conversationRef = firebase.ref(`conversations/${message.conversation_id}`);
    const convSnapshot = await conversationRef.once('value');
    const conversation = convSnapshot.val();

    if (conversation.last_message === messageData.content) {
      // Tìm tin nhắn cuối cùng không bị xóa
      const lastMessageSnapshot = await messageRef
        .orderByChild('created_at')
        .limitToLast(1)
        .once('value');
      
      let newLastMessage = "Không có tin nhắn";
      let lastMessageTime = Date.now();

      lastMessageSnapshot.forEach((childSnapshot) => {
        const lastMsg = childSnapshot.val();
        if (!lastMsg.is_deleted) {
          newLastMessage = lastMsg.content || "Đã gửi một file đính kèm";
          lastMessageTime = lastMsg.created_at;
        }
      });

      await conversationRef.update({
        last_message: newLastMessage,
        last_message_at: lastMessageTime,
        updated_at: admin.database.ServerValue.TIMESTAMP
      });
    }

    res.status(200).json({ message: "Đã thu hồi tin nhắn thành công" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.downloadAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Kiểm tra message trong MongoDB
    const message = await Message.findOne({
      _id: id
    });

    if (!message || !message.attachment) {
      return res.status(404).json({ error: "Không tìm thấy file đính kèm" });
    }

    // Kiểm tra quyền truy cập qua Firebase
    const conversationRef = firebase.ref(`conversations/${message.conversation_id}`);
    const snapshot = await conversationRef.once('value');
    const conversation = snapshot.val();

    if (!conversation || (conversation.user1_id !== userId.toString() && conversation.user2_id !== userId.toString())) {
      return res.status(403).json({ error: "Bạn không có quyền truy cập file này" });
    }

    // Kiểm tra file tồn tại
    const filePath = path.join(__dirname, "../../../", message.attachment.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File không tồn tại trên server" });
    }

    // Gửi file
    res.download(filePath, message.attachment.file_name);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.checkAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const message = await Message.findOne({
      _id: id
    });

    if (!message || !message.attachment) {
      return res.status(404).json({ error: "Không tìm thấy file đính kèm" });
    }

    // Kiểm tra quyền truy cập qua Firebase
    const conversationRef = firebase.ref(`conversations/${message.conversation_id}`);
    const snapshot = await conversationRef.once('value');
    const conversation = snapshot.val();

    if (!conversation || (conversation.user1_id !== userId.toString() && conversation.user2_id !== userId.toString())) {
      return res.status(403).json({ error: "Bạn không có quyền truy cập file này" });
    }

    const filePath = path.join(__dirname, "../../../", message.attachment.file_path);
    const fileExists = fs.existsSync(filePath);

    res.status(200).json({
      attachment: message.attachment,
      exists: fileExists,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
