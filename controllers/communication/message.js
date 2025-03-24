const Message = require("../../models/communication/message");
const ChatConversation = require("../../models/communication/chatConversation");
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

// Gửi tin nhắn
exports.sendMessage = async (req, res) => {
  try {
    const { conversation_id, content } = req.body;
    const sender_id = req.user._id;
    let attachment = null;

    // Xử lý file đính kèm nếu có
    if (req.file) {
      attachment = {
        file_name: req.file.originalname,
        file_type: req.file.mimetype,
        file_path: req.file.path,
        file_size: req.file.size,
      };
    }

    // Kiểm tra có ít nhất content hoặc attachment
    if (!content && !req.file) {
      return res
        .status(400)
        .json({ error: "Tin nhắn phải có nội dung hoặc file đính kèm" });
    }

    // Kiểm tra cuộc hội thoại
    const conversation = await ChatConversation.findOne({
      _id: conversation_id,
      $or: [{ user1_id: sender_id }, { user2_id: sender_id }],
      is_deleted: false,
    });

    if (!conversation) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "Không tìm thấy cuộc hội thoại" });
    }

    // Tạo tin nhắn mới
    const message = new Message({
      conversation_id,
      sender_id,
      content: content || null,
      attachment,
      is_read: false,
    });

    await message.save();

    // Cập nhật thông tin cuộc hội thoại
    await ChatConversation.findByIdAndUpdate(conversation_id, {
      last_message: content || "Đã gửi một file đính kèm",
      last_message_at: new Date(),
    });

    await message.populate(
      "sender_id",
      "first_name last_name username avatar_path"
    );
    res.status(201).json(message);
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
};

// Thêm hàm updateMessage, chỉ cho phép sửa content, không cho phép sửa attachment
exports.updateMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const sender_id = req.user._id;

    // Kiểm tra tin nhắn tồn tại và quyền sửa
    const message = await Message.findOne({
      _id: id,
      sender_id,
      is_deleted: false,
    });

    if (!message) {
      return res.status(404).json({ error: "Không tìm thấy tin nhắn" });
    }

    // Không cho phép sửa tin nhắn chỉ có attachment
    if (!message.content && message.attachment) {
      return res
        .status(400)
        .json({ error: "Không thể sửa tin nhắn chỉ có file đính kèm" });
    }

    // Cập nhật nội dung
    message.content = content;
    await message.save();

    // Nếu đây là tin nhắn cuối cùng, cập nhật last_message trong conversation
    const conversation = await ChatConversation.findById(
      message.conversation_id
    );
    if (
      conversation.last_message_at.getTime() === message.createdAt.getTime()
    ) {
      conversation.last_message = content;
      await conversation.save();
    }

    await message.populate(
      "sender_id",
      "first_name last_name username avatar_path"
    );
    res.status(200).json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy tin nhắn trong cuộc hội thoại
exports.getMessages = async (req, res) => {
  try {
    const { conversation_id } = req.params;
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // Kiểm tra cuộc hội thoại
    const conversation = await ChatConversation.findOne({
      _id: conversation_id,
      $or: [{ user1_id: userId }, { user2_id: userId }],
      is_deleted: false,
    });

    if (!conversation) {
      return res.status(404).json({ error: "Không tìm thấy cuộc hội thoại" });
    }

    // Lấy tin nhắn
    const messages = await Message.find({
      conversation_id,
      is_deleted: false,
    })
      .populate("sender_id", "first_name last_name username avatar_path")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Đánh dấu tin nhắn đã đọc
    await Message.updateMany(
      {
        conversation_id,
        sender_id: { $ne: userId },
        is_read: false,
      },
      {
        is_read: true,
        read_at: new Date(),
      }
    );

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Xóa tin nhắn
exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const sender_id = req.user._id;

    const message = await Message.findOneAndUpdate(
      {
        _id: id,
        sender_id,
        is_deleted: false,
      },
      { is_deleted: true },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: "Không tìm thấy tin nhắn" });
    }

    res.status(200).json({ message: "Đã xóa tin nhắn" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.downloadAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Tìm tin nhắn và kiểm tra quyền truy cập
    const message = await Message.findOne({
      _id: id,
      is_deleted: false,
    });

    if (!message || !message.attachment) {
      return res.status(404).json({ error: "Không tìm thấy file đính kèm" });
    }

    // Kiểm tra người dùng có quyền truy cập cuộc hội thoại
    const conversation = await ChatConversation.findOne({
      _id: message.conversation_id,
      $or: [{ user1_id: userId }, { user2_id: userId }],
      is_deleted: false,
    });

    if (!conversation) {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền truy cập file này" });
    }

    // Kiểm tra file tồn tại
    const filePath = path.join(
      __dirname,
      "../../../",
      message.attachment.file_path
    );
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File không tồn tại trên server" });
    }

    // Gửi file
    res.download(filePath, message.attachment.file_name);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Thêm hàm kiểm tra file tồn tại (không cần download)
exports.checkAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const message = await Message.findOne({
      _id: id,
      is_deleted: false,
    });

    if (!message || !message.attachment) {
      return res.status(404).json({ error: "Không tìm thấy file đính kèm" });
    }

    // Kiểm tra quyền truy cập
    const conversation = await ChatConversation.findOne({
      _id: message.conversation_id,
      $or: [{ user1_id: userId }, { user2_id: userId }],
      is_deleted: false,
    });

    if (!conversation) {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền truy cập file này" });
    }

    // Kiểm tra file tồn tại
    const filePath = path.join(
      __dirname,
      "../../../",
      message.attachment.file_path
    );
    const fileExists = fs.existsSync(filePath);

    res.status(200).json({
      attachment: message.attachment,
      exists: fileExists,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
