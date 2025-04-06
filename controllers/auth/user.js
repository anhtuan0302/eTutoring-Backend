const User = require("../../models/auth/user");
const Student = require("../../models/organization/student");
const Tutor = require("../../models/organization/tutor");
const Staff = require("../../models/organization/staff");
const Token = require("../../models/auth/token");
const bcrypt = require("bcryptjs");
const tokenController = require("./token");
const loginHistoryController = require("./loginHistory");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { firebase, admin } = require("../../config/firebase");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/avatars";
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file hình ảnh (jpg, png, gif, webp)"));
    }
  },
});

const filterUndefinedValues = (obj) => {
  const filtered = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined && obj[key] !== null) {
      filtered[key] = obj[key];
    }
  });
  return filtered;
};

// Đăng nhập
exports.loginUser = async (req, res) => {
  try {
    const { usernameOrEmail, password, remember } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ error: "Vui lòng cung cấp tên đăng nhập/email và mật khẩu" });
    }

    const user = await User.findOne({
      $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
    });

    if (!user) {
      return res.status(401).json({ error: "Tên đăng nhập/email hoặc mật khẩu không đúng" });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({ error: "Tên đăng nhập/email hoặc mật khẩu không đúng" });
    }

    const tokens = await tokenController.generateAuthTokens(user._id, req.ip, remember || false);

    // Cập nhật trạng thái online trong MongoDB
    user.status = "online";
    user.lastActive = new Date();
    await user.save();

    // Chuẩn bị dữ liệu presence
    const presenceData = filterUndefinedValues({
      status: 'online',
      lastActive: admin.database.ServerValue.TIMESTAMP,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar_path: user.avatar_path || null // Đảm bảo không có undefined
    });

    const presenceRef = firebase.ref(`presence/${user._id}`);
    await presenceRef.set(presenceData);

    // Thiết lập disconnect handler
    const connectedRef = firebase.ref('.info/connected');
    connectedRef.on('value', async (snapshot) => {
      if (snapshot.val() === false) {
        return;
      }

      try {
        const offlineData = {
          ...presenceData,
          status: 'offline',
          lastActive: admin.database.ServerValue.TIMESTAMP
        };
        await presenceRef.onDisconnect().set(offlineData);
      } catch (error) {
        console.error('Error setting onDisconnect:', error);
      }
    });

    try {
      const historyReq = {
        body: {
          user: user._id,
          ipaddress: req.ip,
          browser: req.headers["user-agent"],
        },
        headers: req.headers,
      };
      const historyRes = {
        status: () => ({ json: () => {} }),
      };
      await loginHistoryController.createLoginHistory(historyReq, historyRes);
    } catch (historyError) {
      console.error("Error creating login history:", historyError);
    }

    let profileInfo = null;
    if (user.role === "student") {
      profileInfo = await Student.findOne({ user_id: user._id }).populate("department_id", "name");
    } else if (user.role === "tutor") {
      profileInfo = await Tutor.findOne({ user_id: user._id }).populate("department_id", "name");
    } else if (user.role === "staff") {
      profileInfo = await Staff.findOne({ user_id: user._id }).populate("department_id", "name");
    }

    res.status(200).json({
      user: {
        _id: user._id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone_number: user.phone_number,
        avatar_path: user.avatar_path,
        role: user.role,
        profile: profileInfo,
      },
      tokens,
    });
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(500).json({ error: error.message });
  }
};

// Lấy thông tin người dùng hiện tại
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    // Tùy theo role, lấy thêm thông tin
    let profileInfo = null;

    if (user.role === "student") {
      profileInfo = await Student.findOne({ user_id: user._id }).populate(
        "department_id",
        "name"
      );
    } else if (user.role === "tutor") {
      profileInfo = await Tutor.findOne({ user_id: user._id }).populate(
        "department_id",
        "name"
      );
    } else if (user.role === "staff") {
      profileInfo = await Staff.findOne({ user_id: user._id }).populate(
        "department_id",
        "name"
      );
    }

    res.status(200).json({
      _id: user._id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone_number: user.phone_number,
      avatar_path: user.avatar_path,
      role: user.role,
      profile: profileInfo,
    });
  } catch (error) {
    console.error("Error getting current user:", error);
    res.status(500).json({ error: error.message });
  }
};

// Cập nhật thông tin người dùng
exports.updateUser = async (req, res) => {
  try {
    const { first_name, last_name, phone_number } = req.body;

    // Tìm người dùng
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    // Cập nhật thông tin cơ bản
    if (first_name) user.first_name = first_name;
    if (last_name) user.last_name = last_name;

    // Kiểm tra phone_number nếu được cập nhật
    if (phone_number && phone_number !== user.phone_number) {
      const existingPhone = await User.findOne({
        phone_number,
        _id: { $ne: user._id },
      });
      if (existingPhone) {
        return res
          .status(400)
          .json({ error: "Số điện thoại đã tồn tại trong hệ thống" });
      }
      user.phone_number = phone_number;
    }

    await user.save();

    res.status(200).json({
      _id: user._id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone_number: user.phone_number,
      avatar_path: user.avatar_path,
      role: user.role,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: error.message });
  }
};

// Thay đổi mật khẩu
exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({ error: "Vui lòng điền đầy đủ thông tin" });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ error: "Mật khẩu xác nhận không khớp" });
    }

    if (new_password.length < 8) {
      return res
        .status(400)
        .json({ error: "Mật khẩu mới phải có ít nhất 8 ký tự" });
    }

    // Tìm người dùng
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    // Kiểm tra mật khẩu hiện tại
    const isPasswordMatch = await bcrypt.compare(
      current_password,
      user.password
    );

    if (!isPasswordMatch) {
      return res.status(401).json({ error: "Mật khẩu hiện tại không đúng" });
    }

    // Mã hóa mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    // Cập nhật mật khẩu
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Thay đổi mật khẩu thành công" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ error: error.message });
  }
};

// Cập nhật avatar
exports.updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Vui lòng tải lên một hình ảnh" });
    }

    // Tìm người dùng
    const user = await User.findById(req.user._id);

    if (!user) {
      // Xóa file nếu có lỗi
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    // Xóa avatar cũ nếu có
    if (user.avatar_path) {
      const oldAvatarPath = path.join(__dirname, "../../", user.avatar_path);
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    // Cập nhật đường dẫn avatar mới
    user.avatar_path = req.file.path;
    await user.save();

    res.status(200).json({
      message: "Cập nhật avatar thành công",
      avatar_path: user.avatar_path,
    });
  } catch (error) {
    // Xóa file nếu có lỗi
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Error updating avatar:", error);
    res.status(500).json({ error: error.message });
  }
};


exports.getAllUsers = async (req, res) => {
  try {

    // Query parameters
    const { role, search, limit = 10, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};

    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { first_name: { $regex: search, $options: "i" } },
        { last_name: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Get users
    const users = await User.find(query)
      .select("-password")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    // Count total
    const total = await User.countDocuments(query);

    res.status(200).json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error getting all users:", error);
    res.status(500).json({ error: error.message });
  }
};

// Lấy thông tin người dùng theo ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    // Tùy theo role, lấy thêm thông tin
    let profileInfo = null;

    if (user.role === "student") {
      profileInfo = await Student.findOne({ user_id: user._id }).populate(
        "department_id",
        "name"
      );
    } else if (user.role === "tutor") {
      profileInfo = await Tutor.findOne({ user_id: user._id }).populate(
        "department_id",
        "name"
      );
    } else if (user.role === "staff") {
      profileInfo = await Staff.findOne({ user_id: user._id }).populate(
        "department_id",
        "name"
      );
    }

    res.status(200).json({
      ...user.toObject(),
      profile: profileInfo,
    });
  } catch (error) {
    console.error("Error getting user by id:", error);
    res.status(500).json({ error: error.message });
  }
};

// Thêm hàm logout
exports.logoutUser = async (req, res) => {
  try {
    const user = req.user;
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({ error: 'Bearer token is required' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Thu hồi access token
    const tokenDoc = await Token.findOne({
      value: token,
      type: 'access',
      is_revoked: false
    });

    if (tokenDoc) {
      tokenDoc.is_revoked = true;
      tokenDoc.revoked_at = new Date();
      await tokenDoc.save();
    }

    // Thu hồi refresh tokens
    await Token.updateMany(
      {
        user_id: user._id,
        type: 'refresh',
        is_revoked: false
      },
      {
        is_revoked: true,
        revoked_at: new Date()
      }
    );

    // Cập nhật trạng thái offline trong MongoDB
    user.status = 'offline';
    user.lastActive = new Date();
    await user.save();

    // Chuẩn bị dữ liệu presence
    const presenceData = filterUndefinedValues({
      status: 'offline',
      lastActive: admin.database.ServerValue.TIMESTAMP,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar_path: user.avatar_path || null // Đảm bảo không có undefined
    });

    // Cập nhật presence trong Firebase
    const presenceRef = firebase.ref(`presence/${user._id}`);
    await presenceRef.set(presenceData);

    res.status(200).json({ message: 'Đăng xuất thành công' });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ error: error.message });
  }
};
