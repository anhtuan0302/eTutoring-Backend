const Post = require("../../models/blog/post");
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
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
    const { title, content, post_category_id } = req.body;
    const user_id = req.user._id;

    // Xử lý attachments nếu có
    const attachments =
      req.files?.map((file) => ({
        file_name: file.originalname,
        file_path: file.path,
        file_type: file.mimetype,
        file_size: file.size,
      })) || [];

    // Xác định status dựa vào role
    const status = ["admin", "staff", "tutor"].includes(req.user.role)
      ? "approved"
      : "pending";

    const post = new Post({
      user_id,
      title,
      content,
      post_category_id,
      status,
      attachments,
    });

    await post.save();
    await post.populate([
      { path: "user_id", select: "username first_name last_name" },
      { path: "post_category_id", select: "name" },
    ]);

    // Thông báo realtime nếu cần duyệt
    if (status === "pending") {
      req.io.emit("post:pending", {
        post_id: post._id,
        title: post.title,
        author: post.user_id,
      });
    }

    res.status(201).json(post);
  } catch (error) {
    // Xóa files nếu có lỗi
    if (req.files) {
      req.files.forEach((file) => fs.unlinkSync(file.path));
    }
    res.status(400).json({ error: error.message });
  }
};

exports.getAllPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || "approved";
    const category = req.query.category;

    const query = { is_deleted: false };
    if (status !== "all") query.status = status;
    if (category) query.post_category_id = category;

    const posts = await Post.find(query)
      .populate("user_id", "username first_name last_name")
      .populate("post_category_id", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Post.countDocuments(query);

    res.status(200).json({
      posts,
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
    const post = await Post.findOne({
      _id: req.params.id,
      is_deleted: false,
    })
      .populate("user_id", "username first_name last_name")
      .populate("post_category_id", "name");

    if (!post) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" });
    }

    // Cập nhật lượt xem
    if (!post.viewed_by.includes(req.user._id)) {
      post.viewed_by.push(req.user._id);
      post.view_count += 1;
      await post.save();

      // Emit socket event cho lượt xem mới
      req.io.to(`post:${post._id}`).emit("post:view_updated", {
        post_id: post._id,
        view_count: post.view_count,
      });
    }

    res.status(200).json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updatePost = async (req, res) => {
  try {
    const { title, content, post_category_id } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" });
    }

    // Xử lý attachments mới nếu có
    if (req.files?.length > 0) {
      const newAttachments = req.files.map((file) => ({
        file_name: file.originalname,
        file_path: file.path,
        file_type: file.mimetype,
        file_size: file.size,
      }));
      post.attachments.push(...newAttachments);
    }

    post.title = title;
    post.content = content;
    post.post_category_id = post_category_id;

    // Nếu là student và bài đã approved, cập nhật sẽ cần duyệt lại
    if (req.user.role === "student" && post.status === "approved") {
      post.status = "pending";
    }

    await post.save();
    await post.populate([
      { path: "user_id", select: "username first_name last_name" },
      { path: "post_category_id", select: "name" },
    ]);

    // Emit socket event cho bài viết được cập nhật
    req.io.to(`post:${post._id}`).emit("post:updated", {
      post_id: post._id,
      title: post.title,
      content: post.content,
      status: post.status,
    });

    res.status(200).json(post);
  } catch (error) {
    if (req.files) {
      req.files.forEach((file) => fs.unlinkSync(file.path));
    }
    res.status(400).json({ error: error.message });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { is_deleted: true },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" });
    }

    // Emit socket event cho bài viết bị xóa
    req.io.emit("post:deleted", {
      post_id: post._id,
    });

    res.status(200).json({ message: "Đã xóa bài viết" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.moderatePost = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" });
    }

    post.status = status;
    post.moderated_info = {
      moderated_at: new Date(),
      moderated_by: req.user._id,
      reason: status === "rejected" ? reason : null,
    };

    await post.save();

    // Emit socket event cho bài viết được duyệt/từ chối
    req.io.emit("post:moderated", {
      post_id: post._id,
      status,
      reason,
    });

    res.status(200).json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.removeAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" });
    }

    const attachment = post.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: "Không tìm thấy file đính kèm" });
    }

    // Xóa file từ storage
    fs.unlinkSync(attachment.file_path);

    // Xóa attachment từ mảng
    post.attachments.pull(attachmentId);
    await post.save();

    res.status(200).json({ message: "Đã xóa file đính kèm" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
