const Post = require("../../models/blog/post");
const { firebase, admin } = require("../../config/firebase");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Cấu hình multer cho upload files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/blog";
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
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/webm",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

exports.createPost = async (req, res) => {
  try {
    const { content } = req.body;
    const user_id = req.user._id;

    if (!content) {
      return res.status(400).json({ error: "Nội dung là bắt buộc" });
    }

    // Tạo post mới trong Firebase
    const postsRef = firebase.ref('posts');
    const newPostRef = postsRef.push();
    const postId = newPostRef.key;

    // Xử lý attachments nếu có
    const attachments = req.files?.map(file => ({
      file_name: file.originalname,
      file_path: file.path,
      file_type: file.mimetype,
      file_size: file.size
    })) || [];

    // Xác định is_approved dựa vào role
    const is_approved = ["admin", "staff", "tutor"].includes(req.user.role);

    // Lưu data vào Firebase với đầy đủ thông tin
    const postData = {
      content: content.trim(),
      user_id: user_id.toString(),
      author: {
        _id: user_id.toString(),
        first_name: req.user.first_name || "",
        last_name: req.user.last_name || "",
        avatar_path: req.user.avatar_path || null,
        role: req.user.role || ""
      },
      is_approved,
      attachments,
      created_at: admin.database.ServerValue.TIMESTAMP,
      updated_at: admin.database.ServerValue.TIMESTAMP
    };

    await Promise.all([
      // Lưu post vào Firebase
      newPostRef.set(postData),
      // Lưu tracking vào MongoDB
      new Post({
        _id: postId,
        user_id,
        status: is_approved ? "approved" : "pending"
      }).save()
    ]);

    res.status(201).json({
      ...postData,
      _id: postId,
      status: is_approved ? "approved" : "pending"
    });
  } catch (error) {
    // Xóa files nếu có lỗi
    if (req.files) {
      req.files.forEach(file => fs.unlinkSync(file.path));
    }
    res.status(400).json({ error: error.message });
  }
};

exports.getAllPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || "approved";

    // Lấy posts từ MongoDB để filter theo status
    const query = { status };
    const posts = await Post.find(query)
      .populate("user_id", "-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Lấy chi tiết posts từ Firebase
    const postsRef = firebase.ref('posts');
    const snapshot = await postsRef.once('value');
    const firebasePosts = snapshot.val() || {};

    // Kết hợp data
    const combinedPosts = posts.map(post => ({
      ...firebasePosts[post._id],
      _id: post._id,
      status: post.status,
      user: post.user_id,
      created_at: post.createdAt,
      updated_at: post.updatedAt
    }));

    const total = await Post.countDocuments(query);

    res.status(200).json({
      posts: combinedPosts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPostById = async (req, res) => {
  try {
    // Lấy post từ MongoDB
    const post = await Post.findById(req.params.id)
      .populate("user_id", "-password");

    if (!post) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" });
    }

    // Lấy chi tiết từ Firebase
    const postRef = firebase.ref(`posts/${req.params.id}`);
    const snapshot = await postRef.once('value');
    const firebasePost = snapshot.val();

    if (!firebasePost) {
      return res.status(404).json({ error: "Không tìm thấy nội dung bài viết" });
    }

    res.status(200).json({
      ...firebasePost,
      _id: post._id,
      status: post.status,
      user: post.user_id,
      created_at: post.createdAt,
      updated_at: post.updatedAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updatePost = async (req, res) => {
  try {
    const { title, content } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: "Tiêu đề và nội dung là bắt buộc" });
    }

    // Kiểm tra post trong MongoDB
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" });
    }

    // Kiểm tra quyền sửa
    if (post.user_id.toString() !== req.user._id.toString() && 
        !["admin", "staff"].includes(req.user.role)) {
      return res.status(403).json({ error: "Bạn không có quyền sửa bài viết này" });
    }

    // Lấy data từ Firebase
    const postRef = firebase.ref(`posts/${req.params.id}`);
    const snapshot = await postRef.once('value');
    const oldData = snapshot.val();

    // Xử lý attachments mới nếu có
    const attachments = [...(oldData.attachments || [])];
    if (req.files?.length > 0) {
      const newAttachments = req.files.map(file => ({
        file_name: file.originalname,
        file_path: file.path,
        file_type: file.mimetype,
        file_size: file.size
      }));
      attachments.push(...newAttachments);
    }

    const updateData = {
      ...oldData,
      title: title.trim(),
      content: content.trim(),
      attachments,
      updated_at: admin.database.ServerValue.TIMESTAMP
    };

    // Update Firebase và MongoDB
    await Promise.all([
      postRef.set(updateData),
      // Cập nhật status nếu cần
      req.user.role === "student" && post.status === "approved" ?
        Post.findByIdAndUpdate(req.params.id, { status: "pending" }) :
        Promise.resolve()
    ]);

    res.status(200).json({
      ...updateData,
      _id: post._id,
      status: req.user.role === "student" && post.status === "approved" ? "pending" : post.status
    });
  } catch (error) {
    // Xóa files mới nếu có lỗi
    if (req.files) {
      req.files.forEach(file => fs.unlinkSync(file.path));
    }
    res.status(400).json({ error: error.message });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" });
    }

    // Kiểm tra quyền xóa
    if (post.user_id.toString() !== req.user._id.toString() && 
        !["admin", "staff"].includes(req.user.role)) {
      return res.status(403).json({ error: "Bạn không có quyền xóa bài viết này" });
    }

    // Lấy post từ Firebase để xóa files
    const postRef = firebase.ref(`posts/${req.params.id}`);
    const snapshot = await postRef.once('value');
    const postData = snapshot.val();

    // Xóa files từ server
    if (postData?.attachments?.length > 0) {
      postData.attachments.forEach(attachment => {
        const filePath = path.join(__dirname, "../../../", attachment.file_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }

    // Xóa data từ Firebase và MongoDB
    await Promise.all([
      postRef.remove(),
      Post.findByIdAndDelete(req.params.id)
    ]);

    res.status(200).json({ message: "Đã xóa bài viết thành công" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.moderatePost = async (req, res) => {
  try {
    const { status, reason } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ" });
    }

    if (status === "rejected" && !reason) {
      return res.status(400).json({ error: "Vui lòng cung cấp lý do từ chối" });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" });
    }

    // Kiểm tra quyền duyệt bài
    if (!["admin", "staff", "tutor"].includes(req.user.role)) {
      return res.status(403).json({ error: "Bạn không có quyền duyệt bài viết" });
    }

    // Cập nhật trong MongoDB
    post.status = status;
    post.moderated_info = {
      moderated_at: new Date(),
      moderated_by: req.user._id
    };
    await post.save();

    // Cập nhật trong Firebase
    const postRef = firebase.ref(`posts/${req.params.id}`);
    await postRef.update({
      moderated_at: admin.database.ServerValue.TIMESTAMP,
      moderated_by: req.user._id.toString(),
      moderate_reason: reason || null,
      updated_at: admin.database.ServerValue.TIMESTAMP
    });

    // Emit socket event nếu cần
    req.io?.emit("post:moderated", {
      post_id: post._id,
      status,
      reason
    });

    res.status(200).json({ 
      message: `Bài viết đã được ${status === "approved" ? "phê duyệt" : "từ chối"}`,
      status,
      moderated_info: post.moderated_info
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.removeAttachment = async (req, res) => {
  try {
    const { id, attachmentPath } = req.params;

    // Kiểm tra post trong MongoDB
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" });
    }

    // Kiểm tra quyền xóa attachment
    if (post.user_id.toString() !== req.user._id.toString() && 
        !["admin", "staff"].includes(req.user.role)) {
      return res.status(403).json({ error: "Bạn không có quyền xóa file đính kèm" });
    }

    // Lấy data từ Firebase
    const postRef = firebase.ref(`posts/${id}`);
    const snapshot = await postRef.once('value');
    const postData = snapshot.val();

    // Tìm và xóa attachment
    const attachmentIndex = postData.attachments.findIndex(
      att => att.file_path === attachmentPath
    );

    if (attachmentIndex === -1) {
      return res.status(404).json({ error: "Không tìm thấy file đính kèm" });
    }

    // Xóa file từ server
    const filePath = path.join(__dirname, "../../../", attachmentPath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Cập nhật attachments trong Firebase
    postData.attachments.splice(attachmentIndex, 1);
    await postRef.update({
      attachments: postData.attachments,
      updated_at: admin.database.ServerValue.TIMESTAMP
    });

    res.status(200).json({ message: "Đã xóa file đính kèm" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addView = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    const postRef = firebase.ref(`posts/${postId}`);
    const viewsRef = firebase.ref(`views/${postId}`);

    // Thêm người xem mới
    const newViewRef = viewsRef.push();
    await newViewRef.set({
      user_id: userId.toString(),
      viewed_at: admin.database.ServerValue.TIMESTAMP
    });

    // Cập nhật số lượt xem
    await postRef.update({
      view_count: admin.database.ServerValue.increment(1)
    });

    res.status(200).json({ message: "View added successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách người xem
exports.getViewers = async (req, res) => {
  try {
    const postId = req.params.id;
    const viewsRef = firebase.ref(`views/${postId}`);
    
    const snapshot = await viewsRef.once('value');
    const views = snapshot.val() || {};

    // Lấy thông tin user cho mỗi view
    const viewers = await Promise.all(
      Object.values(views).map(async view => {
        const user = await User.findById(view.user_id).select('-password');
        return {
          ...user.toObject(),
          viewed_at: view.viewed_at
        };
      })
    );

    res.status(200).json({ viewers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};