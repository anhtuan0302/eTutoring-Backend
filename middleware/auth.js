const jwt = require('jsonwebtoken');
const User = require('../models/auth/user');
const Token = require('../models/auth/token');

const auth = async (req, res, next) => {
  try {
    // Kiểm tra nếu header Authorization không tồn tại
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).send({ 
        error: 'Vui lòng xác thực.',
        detail: 'Header Authorization không tồn tại'
      });
    }

    // Kiểm tra định dạng header
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).send({ 
        error: 'Vui lòng xác thực.',
        detail: 'Header Authorization phải bắt đầu bằng "Bearer "'
      });
    }

    const tokenValue = authHeader.replace('Bearer ', '');
    
    // Kiểm tra JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET không được cấu hình!');
      return res.status(500).send({ error: 'Lỗi cấu hình server' });
    }

    // Giải mã token
    let decoded;
    try {
      decoded = jwt.verify(tokenValue, process.env.JWT_SECRET);
    } catch (err) {
      console.error('Token verification failed:', err.message);
      return res.status(401).send({ 
        error: 'Vui lòng xác thực.',
        detail: 'Token không hợp lệ hoặc đã hết hạn'
      });
    }

    // Tìm token trong database
    const tokenDoc = await Token.findOne({ 
      user_id: decoded._id, 
      value: tokenValue,
      type: 'access',
      is_revoked: false,
      expires_at: { $gt: new Date() }
    });

    if (!tokenDoc) {
      console.log('Token not found in database or expired/revoked');
      return res.status(401).send({ 
        error: 'Vui lòng xác thực.',
        detail: 'Token không tồn tại hoặc đã hết hạn'
      });
    }

    // Tìm user
    const user = await User.findById(decoded._id);

    if (!user) {
      return res.status(401).send({ 
        error: 'Vui lòng xác thực.',
        detail: 'Không tìm thấy người dùng'
      });
    }

    req.token = tokenValue;
    req.tokenDoc = tokenDoc;
    req.user = user;
    next();
  } catch (e) {
    console.error('Auth middleware error:', e);
    res.status(401).send({ error: 'Vui lòng xác thực.' });
  }
};

module.exports = auth;