const express = require('express');
const router = express.Router();
const tutorController = require('../../controllers/organization/tutor');
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');

// Lấy danh sách giảng viên (yêu cầu đăng nhập)
router.get('/', auth, tutorController.getAllTutors);

// Lấy thông tin giảng viên theo ID (yêu cầu đăng nhập)
router.get('/:id', auth, tutorController.getTutorById);

// Lấy thông tin giảng viên theo userID (yêu cầu đăng nhập)
router.get('/user/:userId', auth, tutorController.getTutorByUserId);

// Cập nhật thông tin giảng viên (chỉ admin và staff)
router.put('/:id', 
  auth, 
  roleCheck(['admin', 'staff']), 
  tutorController.updateTutor
);

// Thống kê giảng viên theo khoa (chỉ admin và staff)
router.get('/stats/department', 
  auth, 
  roleCheck(['admin', 'staff']), 
  tutorController.getTutorsByDepartment
);

module.exports = router;