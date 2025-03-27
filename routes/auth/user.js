const express = require("express");
const router = express.Router();
const userController = require("../../controllers/auth/user");
const auth = require("../../middleware/auth");
const roleCheck = require("../../middleware/roleCheck");

// Đăng nhập
router.post('/login', userController.loginUser);

// Đăng xuất
router.post('/logout', auth, userController.logoutUser);

// Lấy thông tin người dùng hiện tại (yêu cầu đăng nhập)
router.get('/me', auth, userController.getCurrentUser);

// Cập nhật thông tin người dùng (yêu cầu đăng nhập)
router.put('/me', auth, userController.updateUser);

// Thay đổi mật khẩu (yêu cầu đăng nhập)
router.post('/change-password', auth, userController.changePassword);

// Cập nhật avatar (yêu cầu đăng nhập)
router.post('/avatar', auth, userController.upload.single('avatar'), userController.updateAvatar);

// Lấy danh sách người dùng (chỉ admin)
router.get('/', 
  auth, 
  roleCheck(['admin']), 
  userController.getAllUsers
);

// Lấy thông tin người dùng theo ID (yêu cầu đăng nhập)
router.get('/:id', auth, userController.getUserById);

// Vô hiệu hóa tài khoản người dùng (chỉ admin)
router.post('/:id/disable', 
  auth, 
  roleCheck(['admin']), 
  userController.disableUser
);

module.exports = router;