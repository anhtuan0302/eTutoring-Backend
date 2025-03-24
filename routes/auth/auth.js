const express = require('express');
const authController = require('../../controllers/auth/auth');
const auth = require('../../middleware/auth');
const router = express.Router();

// Đăng ký
router.post('/register', authController.registerPendingUser);

// Xác minh email
router.get('/verify-email/:token', authController.verifyEmail);

// Hoàn tất đăng ký
router.post('/complete-registration', authController.completeRegistration);

// Đăng nhập
router.post('/login', authController.login);

// Đăng xuất
router.post('/logout', auth, authController.logout);

// Đăng xuất tất cả
router.post('/logout-all', auth, authController.logoutAll);

// Quên mật khẩu
router.post('/forgot-password', authController.forgotPassword);

// Đặt lại mật khẩu
router.post('/reset-password', authController.resetPassword);

module.exports = router;