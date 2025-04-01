const ChatConversation = require('../../models/communication/chatConversation');
const User = require('../../models/auth/user');
const { sendToUser } = require('../../config/socket');

// Tạo cuộc hội thoại mới
exports.createConversation = async (req, res) => {
  try {
    const { user2_id } = req.body;
    const user1_id = req.user._id;

    // Kiểm tra user2 tồn tại
    const user2 = await User.findById(user2_id);
    if (!user2) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    // Kiểm tra cuộc hội thoại đã tồn tại
    let conversation = await ChatConversation.findOne({
      $or: [
        { user1_id, user2_id },
        { user1_id: user2_id, user2_id: user1_id }
      ],
      is_deleted: false
    }).populate('user1_id user2_id', 'first_name last_name username avatar_path status');

    if (conversation) {
      // Thông báo cho cả hai người dùng về cuộc trò chuyện
      sendToUser(user1_id, 'conversation:update', conversation);
      sendToUser(user2_id, 'conversation:update', conversation);
      return res.status(200).json(conversation);
    }

    // Tạo cuộc hội thoại mới
    conversation = new ChatConversation({
      user1_id,
      user2_id,
      last_message: null,
      last_message_at: null
    });

    await conversation.save();
    await conversation.populate('user1_id user2_id', 'first_name last_name username avatar_path status');

    // Thông báo cho cả hai người dùng về cuộc trò chuyện mới
    sendToUser(user1_id, 'conversation:new', conversation);
    sendToUser(user2_id, 'conversation:new', conversation);

    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách cuộc hội thoại
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await ChatConversation.find({
      $or: [
        { user1_id: userId },
        { user2_id: userId }
      ],
      is_deleted: false
    })
    .populate('user1_id user2_id', 'first_name last_name username avatar_path status')
    .sort({ last_message_at: -1, createdAt: -1 });

    res.status(200).json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Xóa cuộc hội thoại
exports.deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const conversation = await ChatConversation.findOneAndUpdate(
      {
        _id: id,
        $or: [{ user1_id: userId }, { user2_id: userId }]
      },
      { is_deleted: true },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Không tìm thấy cuộc hội thoại' });
    }

    res.status(200).json({ message: 'Đã xóa cuộc hội thoại' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};