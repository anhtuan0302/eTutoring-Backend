const PostComment = require('../../models/blog/postComment');
const Post = require('../../models/blog/post');

exports.createComment = async (req, res) => {
  try {
    const { content } = req.body;
    const post_id = req.params.post_id;
    const user_id = req.user._id;

    const comment = new PostComment({
      post_id,
      user_id,
      content
    });

    await comment.save();
    await comment.populate('user_id', 'username first_name last_name avatar_path');

    // Emit socket event cho comment mới
    req.io.to(`post:${post_id}`).emit('comment:created', {
      comment: {
        _id: comment._id,
        content: comment.content,
        user: comment.user_id,
        createdAt: comment.createdAt
      }
    });

    res.status(201).json(comment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getComments = async (req, res) => {
  try {
    const post_id = req.params.post_id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const comments = await PostComment.find({
      post_id,
      is_deleted: false
    })
      .populate('user_id', 'username first_name last_name avatar_path')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await PostComment.countDocuments({
      post_id,
      is_deleted: false
    });

    res.status(200).json({
      comments,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateComment = async (req, res) => {
  try {
    const { content } = req.body;
    const comment = await PostComment.findByIdAndUpdate(
      req.params.id,
      { content },
      { new: true }
    ).populate('user_id', 'username first_name last_name avatar_path');

    if (!comment) {
      return res.status(404).json({ error: 'Không tìm thấy bình luận' });
    }

    // Emit socket event cho comment được cập nhật
    req.io.to(`post:${comment.post_id}`).emit('comment:updated', {
      comment_id: comment._id,
      content: comment.content
    });

    res.status(200).json(comment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const comment = await PostComment.findByIdAndUpdate(
      req.params.id,
      { is_deleted: true },
      { new: true }
    );

    if (!comment) {
      return res.status(404).json({ error: 'Không tìm thấy bình luận' });
    }

    // Emit socket event cho comment bị xóa
    req.io.to(`post:${comment.post_id}`).emit('comment:deleted', {
      comment_id: comment._id
    });

    res.status(200).json({ message: 'Đã xóa bình luận' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};