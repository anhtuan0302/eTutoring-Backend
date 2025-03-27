const Token = require('../../models/auth/token');
const User = require('../../models/auth/user');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const sendEmail = require('../../config/email');

// Tạo token JWT
const generateJwtToken = (user, type, expiresIn) => {
  return jwt.sign(
    { _id: user._id, role: user.role, type },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

// Lưu token vào database
const saveToken = async (userId, tokenValue, type, expiresIn, ip = '') => {
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
  
  const token = new Token({
    user_id: userId,
    type,
    value: tokenValue,
    expires_at: expiresAt,
    created_by_ip: ip
  });
  
  return await token.save();
};

// Tạo token đăng nhập (access + refresh)
exports.generateAuthTokens = async (userId, ip = '') => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Không tìm thấy người dùng');
    }
    
    // Tạo access token (hết hạn sau 15 phút)
    const accessTokenValue = generateJwtToken(user, 'access', '24h');
    const accessToken = await saveToken(user._id, accessTokenValue, 'access', 24 * 60 * 60, ip);

    // Tạo refresh token (hết hạn sau 7 ngày)
    const refreshTokenValue = generateJwtToken(user, 'refresh', '7d');
    const refreshToken = await saveToken(user._id, refreshTokenValue, 'refresh', 7 * 24 * 60 * 60, ip);
    
    return {
      access: {
        token: accessTokenValue,
        expires: accessToken.expires_at
      },
      refresh: {
        token: refreshTokenValue,
        expires: refreshToken.expires_at
      }
    };
  } catch (error) {
    console.error('Error generating auth tokens:', error);
    throw error;
  }
};

// Đổi refresh token lấy access token mới
exports.refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    
    // Kiểm tra refresh token trong database
    const tokenDoc = await Token.findOne({
      value: refresh_token,
      type: 'refresh',
      is_revoked: false,
      expires_at: { $gt: new Date() }
    });
    
    if (!tokenDoc) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    // Verify refresh token
    try {
      const decoded = jwt.verify(refresh_token, process.env.JWT_SECRET);
      
      // Tạo access token mới
      const user = await User.findById(decoded._id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Tạo access token (hết hạn sau 15 phút)
      const accessTokenValue = generateJwtToken(user, 'access', '24h');
      const accessToken = await saveToken(user._id, accessTokenValue, 'access', 24 * 60 * 60, req.ip);
      
      return res.status(200).json({
        access_token: accessTokenValue,
        expires: accessToken.expires_at
      });
    } catch (err) {
      // Refresh token không hợp lệ - thu hồi nó
      tokenDoc.is_revoked = true;
      tokenDoc.revoked_at = new Date();
      await tokenDoc.save();
      
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: error.message });
  }
};

// Thu hồi token
exports.revokeToken = async (req, res) => {
  try {
    const { token } = req.params;
    
    const tokenDoc = await Token.findOne({
      value: token
    });
    
    if (!tokenDoc) {
      return res.status(404).json({ error: 'Token not found' });
    }
    
    // Chỉ cho phép admin hoặc chủ sở hữu token thu hồi
    if (req.user.role !== 'admin' && req.user._id.toString() !== tokenDoc.user_id.toString()) {
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
    }
    
    tokenDoc.is_revoked = true;
    tokenDoc.revoked_at = new Date();
    await tokenDoc.save();
    
    res.status(200).json({ message: 'Token đã bị thu hồi' });
  } catch (error) {
    console.error('Error revoking token:', error);
    res.status(500).json({ error: error.message });
  }
};

// Tạo token đặt lại mật khẩu
exports.createPasswordResetToken = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const user = await User.findOne({ email });
    
    // Không tiết lộ nếu email không tồn tại (bảo mật)
    if (!user) {
      return res.status(200).json({ message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi' });
    }
    
    // Tạo token ngẫu nhiên
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Lưu token vào database (hết hạn sau 1 giờ)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    
    const token = new Token({
      user_id: user._id,
      type: 'password-reset',
      value: resetToken,
      expires_at: expiresAt,
      created_by_ip: req.ip
    });
    
    await token.save();
    
    // Gửi email đặt lại mật khẩu
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    await sendEmail({
      email: user.email,
      subject: 'Đặt lại mật khẩu của bạn',
      message: `
        Xin chào ${user.first_name},
        
        Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng truy cập liên kết sau để đặt lại mật khẩu của bạn:
        ${resetUrl}
        
        Liên kết này sẽ hết hạn sau 24 giờ.
        
        Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
      `
    });
    
    res.status(200).json({ message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi' });
  } catch (error) {
    console.error('Error creating password reset token:', error);
    res.status(500).json({ error: error.message });
  }
};

// Xác thực token đặt lại mật khẩu
exports.verifyPasswordResetToken = async (req, res) => {
  try {
    const { token } = req.params;
    
    const tokenDoc = await Token.findOne({
      value: token,
      type: 'password-reset',
      is_revoked: false,
      expires_at: { $gt: new Date() }
    });
    
    if (!tokenDoc) {
      return res.status(400).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }
    
    const user = await User.findById(tokenDoc.user_id);
    
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }
    
    res.status(200).json({
      message: 'Token hợp lệ',
      user: {
        _id: user._id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error verifying password reset token:', error);
    res.status(500).json({ error: error.message });
  }
};

// Đặt lại mật khẩu
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirm_password } = req.body;
    
    if (password !== confirm_password) {
      return res.status(400).json({ error: 'Mật khẩu xác nhận không khớp' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 8 ký tự' });
    }
    
    const tokenDoc = await Token.findOne({
      value: token,
      type: 'password-reset',
      is_revoked: false,
      expires_at: { $gt: new Date() }
    });
    
    if (!tokenDoc) {
      return res.status(400).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }
    
    const user = await User.findById(tokenDoc.user_id);
    
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }
    
    // Mã hóa mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Cập nhật mật khẩu
    user.password = hashedPassword;
    await user.save();
    
    // Thu hồi token đặt lại mật khẩu
    tokenDoc.is_revoked = true;
    tokenDoc.revoked_at = new Date();
    await tokenDoc.save();
    
    // Thu hồi tất cả các token của user (buộc đăng nhập lại)
    await Token.updateMany(
      {
        user_id: user._id,
        is_revoked: false
      },
      {
        is_revoked: true,
        revoked_at: new Date()
      }
    );
    
    res.status(200).json({ message: 'Đặt lại mật khẩu thành công' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: error.message });
  }
};