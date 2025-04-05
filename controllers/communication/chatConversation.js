const ChatConversation = require('../../models/communication/chatConversation');
const User = require('../../models/auth/user');
const { firebase, admin } = require('../../config/firebase');

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
      ]
    }).populate(['user1_id', 'user2_id']);

    if (conversation) {
      // Lấy thông tin từ Firebase
      const firebaseConv = await firebase.ref(`conversations/${conversation._id}`).once('value');
      return res.status(200).json({
        ...conversation.toObject(),
        ...firebaseConv.val()
      });
    }

    // Tạo conversation mới trong Firebase
    const conversationsRef = firebase.ref('conversations');
    const newConversationRef = conversationsRef.push();
    const conversationId = newConversationRef.key;

    // Lưu thông tin conversation vào Firebase
    await newConversationRef.set({
      id: conversationId,
      user1_id: user1_id.toString(),
      user2_id: user2_id.toString(),
      last_message: null,
      last_message_at: null,
      created_at: admin.database.ServerValue.TIMESTAMP,
      updated_at: admin.database.ServerValue.TIMESTAMP
    });

    // Lưu reference vào MongoDB
    conversation = new ChatConversation({
      _id: conversationId,
      user1_id,
      user2_id
    });
    await conversation.save();
    await conversation.populate(['user1_id', 'user2_id']);

    const result = {
      ...conversation.toObject(),
      last_message: null,
      last_message_at: null,
      created_at: Date.now()
    };

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    
    // Lấy conversations từ MongoDB để có thông tin user
    const mongoConversations = await ChatConversation.find({
      $or: [
        { user1_id: userId },
        { user2_id: userId }
      ]
    }).populate(['user1_id', 'user2_id']);

    // Lấy thông tin realtime từ Firebase
    const conversationsRef = firebase.ref('conversations');
    const snapshot = await conversationsRef
      .orderByChild('updated_at')
      .once('value');
    
    const conversations = [];
    snapshot.forEach((childSnapshot) => {
      const firebaseConv = childSnapshot.val();
      if (firebaseConv.user1_id === userId || firebaseConv.user2_id === userId) {
        // Tìm thông tin MongoDB tương ứng
        const mongoConv = mongoConversations.find(c => c._id === firebaseConv.id);
        if (mongoConv) {
          conversations.push({
            ...mongoConv.toObject(),
            ...firebaseConv
          });
        }
      }
    });

    res.status(200).json(conversations.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();

    // Kiểm tra quyền xóa
    const conversationRef = firebase.ref(`conversations/${id}`);
    const snapshot = await conversationRef.once('value');
    const conv = snapshot.val();

    if (!conv || (conv.user1_id !== userId && conv.user2_id !== userId)) {
      return res.status(404).json({ error: 'Không tìm thấy cuộc hội thoại' });
    }

    // Xóa conversation và messages
    await Promise.all([
      conversationRef.remove(),
      firebase.ref(`messages/${id}`).remove(),
      ChatConversation.findByIdAndDelete(id)
    ]);

    res.status(200).json({ message: 'Đã xóa cuộc hội thoại' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};