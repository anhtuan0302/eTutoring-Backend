const PendingUser = require("../../models/auth/pendingUser");
const User = require("../../models/auth/user");
const Token = require("../../models/auth/token");
const LoginHistory = require("../../models/auth/loginHistory");
const Student = require("../../models/organization/student");
const Staff = require("../../models/organization/staff");
const Tutor = require("../../models/organization/tutor");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendEmail = require("../../config/email");

// Tạo token JWT với expiry time
const generateToken = (userId, expiresIn = "7d") => {
  return jwt.sign({ _id: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn,
  });
};

// Lưu token vào database
const saveToken = async (
  userId,
  tokenValue,
  type = "access",
  expiresIn = 7,
  ip = null
) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresIn); // mặc định 7 ngày

  const token = new Token({
    user_id: userId,
    type,
    value: tokenValue,
    expires_at: expiresAt,
    created_by_ip: ip,
  });

  await token.save();
  return token;
};

// Thu hồi token
const revokeToken = async (token) => {
  token.is_revoked = true;
  token.revoked_at = new Date();
  await token.save();
};

// Tạo pendingUser
exports.registerPendingUser = async (req, res) => {
  try {
    const { email, username, role, first_name, last_name, department } = req.body;

    // Kiểm tra xem email hoặc username đã tồn tại chưa
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res
        .status(400)
        .send({ error: "Email hoặc tên người dùng đã được đăng ký." });
    }

    // Kiểm tra xem email hoặc username đã có trong pendingUser chưa
    const existingPending = await PendingUser.findOne({
      $or: [{ email }, { username }],
    });
    if (existingPending) {
      return res
        .status(400)
        .send({
          error:
            "Email hoặc tên người dùng đã được đăng ký nhưng chưa hoàn tất.",
        });
    }

    // Tạo token xác thực
    const verificationToken = crypto.randomBytes(20).toString("hex");

    // Tạo pending user
    const pendingUser = new PendingUser({
      email,
      username,
      role,
      fullName,
      verificationToken,
      tokenExpires: Date.now() + 24 * 60 * 60 * 1000, // hết hạn sau 24 giờ
    });

    await pendingUser.save();

    // Gửi email xác nhận
    const verificationURL = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    const message = `Xin chào ${fullName},\n\nVui lòng nhấp vào liên kết sau để xác nhận email và hoàn tất đăng ký: \n\n${verificationURL}\n\nLiên kết này sẽ hết hạn sau 24 giờ.`;

    await sendEmail({
      email: pendingUser.email,
      subject: "Xác nhận email đăng ký eTutoring",
      message,
    });

    res
      .status(201)
      .send({
        message: "Đăng ký thành công! Vui lòng kiểm tra email để xác nhận.",
      });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// Xác nhận email và tạo form nhập mật khẩu
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const pendingUser = await PendingUser.findOne({
      verificationToken: token,
      tokenExpires: { $gt: Date.now() },
    });

    if (!pendingUser) {
      return res
        .status(400)
        .send({ error: "Token không hợp lệ hoặc đã hết hạn." });
    }

    // Đánh dấu là đã xác minh email
    pendingUser.isEmailVerified = true;
    await pendingUser.save();

    res.status(200).send({
      message: "Xác minh email thành công!",
      userId: pendingUser._id,
      email: pendingUser.email,
      username: pendingUser.username,
      role: pendingUser.role,
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// Hoàn tất đăng ký (tạo user)
exports.completeRegistration = async (req, res) => {
  try {
    const { pendingUserId, password, additionalInfo } = req.body;

    const pendingUser = await PendingUser.findById(pendingUserId);

    if (!pendingUser || !pendingUser.isEmailVerified) {
      return res
        .status(400)
        .send({
          error:
            "Không tìm thấy thông tin đăng ký hoặc email chưa được xác minh.",
        });
    }

    // Tách họ và tên từ fullName
    const nameParts = pendingUser.fullName.split(" ");
    const lastName = nameParts.pop();
    const firstName = nameParts.join(" ");

    // Tạo user mới
    const user = new User({
      email: pendingUser.email,
      username: pendingUser.username,
      first_name: firstName,
      last_name: lastName,
      role: pendingUser.role,
      password: await bcrypt.hash(password, 8),
    });

    await user.save();

    // Tạo thông tin role tương ứng
    let roleModel;
    switch (pendingUser.role) {
      case "student":
        roleModel = new Student({
          user: user._id,
          ...additionalInfo,
        });
        break;
      case "staff":
        roleModel = new Staff({
          user: user._id,
          ...additionalInfo,
        });
        break;
      case "tutor":
        roleModel = new Tutor({
          user: user._id,
          ...additionalInfo,
        });
        break;
      default:
        // Không cần tạo bảng thông tin phụ cho admin
        break;
    }

    if (roleModel) {
      await roleModel.save();
    }

    // Xóa pendingUser
    await PendingUser.findByIdAndDelete(pendingUserId);

    // Tạo token JWT
    const tokenValue = generateToken(user._id);

    // Lưu token vào database
    await saveToken(user._id, tokenValue, "access", 7, req.ip);

    // Lưu lịch sử đăng nhập
    const loginHistory = new LoginHistory({
      user: user._id,
      ipaddress: req.ip,
      browser: req.headers["user-agent"],
    });
    await loginHistory.save();

    res.status(201).send({
      user: {
        _id: user._id,
        email: user.email,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
      token: tokenValue,
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// Đăng nhập
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Tìm user bằng email hoặc username
    const user = await User.findOne({
      $or: [{ email }, { username: email }],
    });

    if (!user) {
      return res
        .status(401)
        .send({ error: "Thông tin đăng nhập không chính xác." });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res
        .status(401)
        .send({ error: "Thông tin đăng nhập không chính xác." });
    }

    // Tạo token JWT
    const tokenValue = generateToken(user._id);

    // Lưu token vào database
    await saveToken(user._id, tokenValue, "access", 7, req.ip);

    // Lưu lịch sử đăng nhập
    const loginHistory = new LoginHistory({
      user: user._id,
      ipaddress: req.ip,
      browser: req.headers["user-agent"] || "unknown",
    });
    await loginHistory.save();

    res.send({
      user: {
        _id: user._id,
        email: user.email,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
      token: tokenValue,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(400).send({ error: error.message });
  }
};

// Đăng xuất
exports.logout = async (req, res) => {
  try {
    // Thu hồi token hiện tại
    await revokeToken(req.tokenDoc);

    res.send({ message: "Đã đăng xuất." });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

// Đăng xuất khỏi tất cả thiết bị
exports.logoutAll = async (req, res) => {
  try {
    // Tìm và thu hồi tất cả các token của user
    const tokens = await Token.find({
      user_id: req.user._id,
      type: "access",
      is_revoked: false,
    });

    for (const token of tokens) {
      await revokeToken(token);
    }

    res.send({ message: "Đã đăng xuất khỏi tất cả thiết bị." });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

// Quên mật khẩu
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .send({ error: "Không tìm thấy người dùng với email này." });
    }

    // Tạo token đặt lại mật khẩu
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Lưu token vào database
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 giờ

    const token = new Token({
      user_id: user._id,
      type: "password-reset",
      value: resetToken,
      expires_at: expiresAt,
      created_by_ip: req.ip,
    });

    await token.save();

    // Gửi email đặt lại mật khẩu
    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const fullName = `${user.first_name} ${user.last_name}`;
    const message = `Xin chào ${fullName},\n\nBạn đã yêu cầu đặt lại mật khẩu. Vui lòng nhấp vào liên kết sau để đặt lại mật khẩu: \n\n${resetURL}\n\nLiên kết này sẽ hết hạn sau 1 giờ.`;

    await sendEmail({
      email: user.email,
      subject: "Đặt lại mật khẩu eTutoring",
      message,
    });

    res.send({ message: "Email đặt lại mật khẩu đã được gửi." });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

// Đặt lại mật khẩu
exports.resetPassword = async (req, res) => {
  try {
    const { token: resetToken, password } = req.body;

    const token = await Token.findOne({
      value: resetToken,
      type: "password-reset",
      is_revoked: false,
      expires_at: { $gt: new Date() },
    });

    if (!token) {
      return res
        .status(400)
        .send({ error: "Token không hợp lệ hoặc đã hết hạn." });
    }

    // Tìm và cập nhật mật khẩu của user
    const user = await User.findById(token.user_id);

    if (!user) {
      return res.status(404).send({ error: "Không tìm thấy người dùng." });
    }

    // Cập nhật mật khẩu
    user.password = await bcrypt.hash(password, 8);
    await user.save();

    // Thu hồi token đặt lại mật khẩu
    await revokeToken(token);

    // Thu hồi tất cả access token hiện tại
    const accessTokens = await Token.find({
      user_id: user._id,
      type: "access",
      is_revoked: false,
    });

    for (const accessToken of accessTokens) {
      await revokeToken(accessToken);
    }

    res.send({
      message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.",
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};
