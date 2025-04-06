const PostComment = require('../../models/blog/postComment');
const Post = require('../../models/blog/post');
const { firebase, admin } = require('../../config/firebase');

exports.createComment = async (req, res) => {
  try {
    const { content } = req.body;
    const post_id = req.params.post_id;
    const user_id = req.user._id;

    if (!content?.trim()) {
      return res.status(400).json({ error: "Nội dung bình luận không được để trống" });
    }

    // Kiểm tra post tồn tại
    const post = await Post.findById(post_id);
    if (!post) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" });
    }

    // Tạo comment mới trong Firebase
    const commentsRef = firebase.ref(`comments/${post_id}`);
    const newCommentRef = commentsRef.push();
    const commentId = newCommentRef.key;

    const commentData = {
      content: content.trim(),
      user_id: user_id.toString(),
      created_at: admin.database.ServerValue.TIMESTAMP,
      updated_at: admin.database.ServerValue.TIMESTAMP
    };

    await Promise.all([
      // Lưu comment vào Firebase
      newCommentRef.set(commentData),
      // Lưu tracking vào MongoDB
      new PostComment({
        _id: commentId,
        post_id,
        user_id
      }).save()
    ]);

    // Emit socket event cho comment mới
    req.io?.to(`post:${post_id}`).emit('comment:created', {
      _id: commentId,
      ...commentData,
      user: {
        _id: req.user._id,
        username: req.user.username,
        first_name: req.user.first_name,
        last_name: req.user.last_name,
        avatar_path: req.user.avatar_path
      }
    });

    res.status(201).json({
      _id: commentId,
      ...commentData
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAllComments = async (req, res) => {
  try {
    const post_id = req.params.post_id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Kiểm tra post tồn tại
    const post = await Post.findById(post_id);
    if (!post) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" });
    }

    // Lấy comments từ MongoDB để có thông tin user
    const comments = await PostComment.find({ post_id })
      .populate('user_id', '-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Lấy chi tiết comments từ Firebase
    const commentsRef = firebase.ref(`comments/${post_id}`);
    const snapshot = await commentsRef.once('value');
    const firebaseComments = snapshot.val() || {};

    // Kết hợp data
    const combinedComments = comments.map(comment => ({
      ...firebaseComments[comment._id],
      _id: comment._id,
      user: comment.user_id,
      created_at: comment.createdAt,
      updated_at: comment.updatedAt
    }));

    const total = await PostComment.countDocuments({ post_id });

    res.status(200).json({
      comments: combinedComments,
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
    const { id } = req.params;
    const user_id = req.user._id;

    if (!content?.trim()) {
      return res.status(400).json({ error: "Nội dung bình luận không được để trống" });
    }

    // Kiểm tra comment trong MongoDB
    const comment = await PostComment.findById(id);
    if (!comment) {
      return res.status(404).json({ error: "Không tìm thấy bình luận" });
    }

    // Kiểm tra quyền sửa
    if (comment.user_id.toString() !== user_id.toString() && 
        !["admin", "staff"].includes(req.user.role)) {
      return res.status(403).json({ error: "Bạn không có quyền sửa bình luận này" });
    }

    // Cập nhật trong Firebase
    const commentRef = firebase.ref(`comments/${comment.post_id}/${id}`);
    const updateData = {
      content: content.trim(),
      updated_at: admin.database.ServerValue.TIMESTAMP,
      is_edited: true
    };

    await commentRef.update(updateData);

    // Emit socket event cho comment được cập nhật
    req.io?.to(`post:${comment.post_id}`).emit('comment:updated', {
      comment_id: id,
      content: content.trim(),
      is_edited: true
    });

    res.status(200).json({
      _id: id,
      ...updateData,
      updated_at: Date.now()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user._id;

    // Kiểm tra comment trong MongoDB
    const comment = await PostComment.findById(id);
    if (!comment) {
      return res.status(404).json({ error: "Không tìm thấy bình luận" });
    }

    // Kiểm tra quyền xóa
    if (comment.user_id.toString() !== user_id.toString() && 
        !["admin", "staff"].includes(req.user.role)) {
      return res.status(403).json({ error: "Bạn không có quyền xóa bình luận này" });
    }

    // Xóa từ Firebase và MongoDB
    await Promise.all([
      firebase.ref(`comments/${comment.post_id}/${id}`).remove(),
      comment.deleteOne()
    ]);

    // Emit socket event cho comment bị xóa
    req.io?.to(`post:${comment.post_id}`).emit('comment:deleted', {
      comment_id: id
    });

    res.status(200).json({ message: "Đã xóa bình luận" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};