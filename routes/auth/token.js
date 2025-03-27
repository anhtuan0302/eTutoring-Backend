const express = require('express');
const router = express.Router();
const tokenController = require('../../controllers/auth/token');
const auth = require('../../middleware/auth');

// Đổi refresh token lấy access token mới
router.post('/refresh', tokenController.refreshToken);

// Thu hồi token (yêu cầu đăng nhập)
router.post('/:token/revoke', auth, tokenController.revokeToken);

// Tạo token đặt lại mật khẩu
router.post('/password-reset', tokenController.createPasswordResetToken);

// Xác thực token đặt lại mật khẩu
router.get('/password-reset/:token', tokenController.verifyPasswordResetToken);

// Đặt lại mật khẩu
router.post('/password-reset/:token', tokenController.resetPassword);

module.exports = router;