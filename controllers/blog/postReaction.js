const PostReaction = require('../../models/blog/postReaction');
const Post = require('../../models/blog/post');

exports.addReaction = async (req, res) => {
  try {
    const { reaction_type } = req.body;
    const post_id = req.params.post_id;
    const user_id = req.user._id;

    // Tìm reaction hiện tại nếu có
    let reaction = await PostReaction.findOne({
      post_id,
      user_id
    });

    if (reaction) {
      // Nếu reaction type giống nhau thì xóa reaction (unlike/unreact)
      if (reaction.reaction_type === reaction_type) {
        await reaction.deleteOne();
        reaction = null;
      } else {
        // Nếu khác thì cập nhật loại reaction mới
        reaction.reaction_type = reaction_type;
        await reaction.save();
      }
    } else {
      // Tạo reaction mới
      reaction = new PostReaction({
        post_id,
        user_id,
        reaction_type
      });
      await reaction.save();
    }

    // Đếm số lượng từng loại reaction
    const reactionCounts = await PostReaction.aggregate([
      { $match: { post_id: mongoose.Types.ObjectId(post_id) } },
      { $group: {
          _id: '$reaction_type',
          count: { $sum: 1 }
        }
      }
    ]);

    // Emit socket event cho reaction update
    req.io.to(`post:${post_id}`).emit('reaction:updated', {
      post_id,
      reactions: reactionCounts,
      latest_reaction: reaction ? {
        user_id: req.user._id,
        reaction_type: reaction.reaction_type
      } : null
    });

    res.status(200).json({
      reaction,
      reactions: reactionCounts
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getReactions = async (req, res) => {
  try {
    const post_id = req.params.post_id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const reaction_type = req.query.type;

    const query = { post_id };
    if (reaction_type) {
      query.reaction_type = reaction_type;
    }

    const reactions = await PostReaction.find(query)
      .populate('user_id', 'username first_name last_name avatar_path')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await PostReaction.countDocuments(query);

    // Đếm số lượng từng loại reaction
    const reactionCounts = await PostReaction.aggregate([
      { $match: { post_id: mongoose.Types.ObjectId(post_id) } },
      { $group: {
          _id: '$reaction_type',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      reactions,
      counts: reactionCounts,
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
    const post_id = req.params.post_id;
    const user_id = req.user._id;

    const reaction = await PostReaction.findOne({
      post_id,
      user_id
    });

    res.status(200).json({ reaction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};