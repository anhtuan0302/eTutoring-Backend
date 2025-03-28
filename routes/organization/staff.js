const express = require('express');
const router = express.Router();
const staffController = require('../../controllers/organization/staff');
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');

// Lấy danh sách nhân viên (yêu cầu đăng nhập)
router.get('/', auth, staffController.getAllStaffs);

// Lấy thông tin nhân viên theo ID (yêu cầu đăng nhập)
router.get('/:id', auth, staffController.getStaffById);

// Lấy thông tin nhân viên theo userID (yêu cầu đăng nhập)
router.get('/user/:userId', auth, staffController.getStaffByUserId);

// Cập nhật thông tin nhân viên (chỉ admin)
router.patch('/:id', 
  auth, 
  roleCheck(['admin']), 
  staffController.updateStaff
);

// Thống kê nhân viên theo khoa (chỉ admin)
router.get('/stats/department', 
  auth, 
  roleCheck(['admin']), 
  staffController.getStaffByDepartment
);

module.exports = router;