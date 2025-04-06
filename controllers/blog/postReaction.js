const PostReaction = require('../../models/blog/postReaction');
const Post = require('../../models/blog/post');
const { firebase, admin } = require('../../config/firebase');

exports.createReaction = async (req, res) => {
  try {
    const { reaction_type } = req.body;
    const post_id = req.params.post_id;
    const user_id = req.user._id;

    if (!reaction_type) {
      return res.status(400).json({ error: "Loại reaction là bắt buộc" });
    }

    // Kiểm tra post tồn tại
    const post = await Post.findById(post_id);
    if (!post) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" });
    }

    // Tìm reaction hiện tại trong MongoDB
    let reaction = await PostReaction.findOne({
      post_id,
      user_id
    });

    let reactionId;
    let action = 'added';

    if (reaction) {
      reactionId = reaction._id;
      // Nếu reaction giống nhau thì xóa (unreact)
      if (reaction_type === await this.getUserReactionType(post_id, user_id)) {
        await Promise.all([
          firebase.ref(`reactions/${post_id}/${reactionId}`).remove(),
          reaction.deleteOne()
        ]);
        action = 'removed';
      } else {
        // Cập nhật loại reaction mới
        await firebase.ref(`reactions/${post_id}/${reactionId}`).update({
          reaction_type,
          updated_at: admin.database.ServerValue.TIMESTAMP
        });
        action = 'updated';
      }
    } else {
      // Tạo reaction mới
      const reactionsRef = firebase.ref(`reactions/${post_id}`);
      const newReactionRef = reactionsRef.push();
      reactionId = newReactionRef.key;

      const reactionData = {
        reaction_type,
        user_id: user_id.toString(),
        created_at: admin.database.ServerValue.TIMESTAMP,
        updated_at: admin.database.ServerValue.TIMESTAMP
      };

      await Promise.all([
        newReactionRef.set(reactionData),
        new PostReaction({
          _id: reactionId,
          post_id,
          user_id
        }).save()
      ]);
    }

    // Lấy tổng số reaction mới
    const counts = await this.getReactionCounts(post_id);

    // Emit socket event cho reaction update
    req.io?.to(`post:${post_id}`).emit('reaction:updated', {
      post_id,
      user_id: user_id.toString(),
      reaction_type: action !== 'removed' ? reaction_type : null,
      action,
      counts
    });

    res.status(200).json({
      post_id,
      user_id: user_id.toString(),
      reaction_type: action !== 'removed' ? reaction_type : null,
      action,
      counts
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAllReactions = async (req, res) => {
  try {
    const { post_id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const reaction_type = req.query.type;

    // Kiểm tra post tồn tại
    const post = await Post.findById(post_id);
    if (!post) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" });
    }

    // Query từ MongoDB
    const query = { post_id };
    const reactions = await PostReaction.find(query)
      .populate('user_id', '-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Lấy chi tiết từ Firebase
    const reactionsRef = firebase.ref(`reactions/${post_id}`);
    const snapshot = await reactionsRef.once('value');
    const firebaseReactions = snapshot.val() || {};

    // Kết hợp data
    const combinedReactions = reactions.map(reaction => ({
      ...firebaseReactions[reaction._id],
      _id: reaction._id,
      user: reaction.user_id
    }));

    // Lọc theo reaction_type nếu có
    const filteredReactions = reaction_type
      ? combinedReactions.filter(r => r.reaction_type === reaction_type)
      : combinedReactions;

    const counts = await this.getReactionCounts(post_id);
    const total = await PostReaction.countDocuments(query);

    res.status(200).json({
      reactions: filteredReactions,
      counts,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUserReaction = async (req, res) => {
  try {
    const { post_id } = req.params;
    const user_id = req.user._id;

    const reaction_type = await this.getUserReactionType(post_id, user_id);

    res.status(200).json({ reaction_type });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper methods
exports.getUserReactionType = async (post_id, user_id) => {
  const reaction = await PostReaction.findOne({
    post_id,
    user_id
  });

  if (!reaction) return null;

  const reactionRef = firebase.ref(`reactions/${post_id}/${reaction._id}`);
  const snapshot = await reactionRef.once('value');
  const reactionData = snapshot.val();

  return reactionData?.reaction_type || null;
};

exports.getReactionCounts = async (post_id) => {
  const reactionsRef = firebase.ref(`reactions/${post_id}`);
  const snapshot = await reactionsRef.once('value');
  const reactions = snapshot.val() || {};

  return Object.values(reactions).reduce((acc, reaction) => {
    const type = reaction.reaction_type;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
};