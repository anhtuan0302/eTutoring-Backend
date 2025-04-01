const express = require("express");
const router = express.Router();
const pendingUserController = require("../../controllers/auth/pendingUser");
const auth = require("../../middleware/auth");
const roleCheck = require("../../middleware/roleCheck");

// Tạo lời mời người dùng mới (chỉ admin và staff)
router.post('/', 
  auth, 
  roleCheck(['admin', 'staff']),
  pendingUserController.createPendingUser
);

// Xác thực lời mời (public)
router.get('/verify/:token', pendingUserController.verifyInvitation);

// Hoàn tất đăng ký (public)
router.post(
  '/complete/:token', 
  pendingUserController.upload.single('avatar'),
  pendingUserController.completeRegistration
);

// Lấy danh sách lời mời đang chờ (chỉ admin và staff)
router.get('/', 
  auth, 
  roleCheck(['admin', 'staff']), 
  pendingUserController.getPendingUsers
);

// Hủy lời mời (chỉ admin và staff)
router.delete('/:id', 
  auth, 
  roleCheck(['admin', 'staff']), 
  pendingUserController.cancelInvitation
);

// Gửi lại lời mời (chỉ admin và staff)
router.post('/:id/resend', 
  auth, 
  roleCheck(['admin', 'staff']), 
  pendingUserController.resendInvitation
);

module.exports = router;