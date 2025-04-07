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
router.post('/changePassword', auth, userController.changePassword);

// Cập nhật avatar (yêu cầu đăng nhập)
router.post('/avatar', auth, userController.upload.single('avatar'), userController.updateAvatar);

// Lấy danh sách người dùng
router.get('/', 
  auth,
  userController.getAllUsers
);

// Lấy thông tin người dùng theo ID
router.get('/:id', auth, userController.getUserById);

// Lấy thông tin sinh viên theo user_id
router.get('/student/:user_id', auth, userController.getStudentByUserId);

// Lấy thông tin giảng viên theo user_id
router.get('/tutor/:user_id', auth, userController.getTutorByUserId);

module.exports = router;