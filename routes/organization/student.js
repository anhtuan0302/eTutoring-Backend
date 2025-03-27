const express = require("express");
const router = express.Router();
const studentController = require("../../controllers/organization/student");
const auth = require("../../middleware/auth");
const roleCheck = require("../../middleware/roleCheck");

// Lấy danh sách sinh viên (yêu cầu đăng nhập)
router.get('/', auth, studentController.getAllStudents);

// Lấy thông tin sinh viên theo ID (yêu cầu đăng nhập)
router.get('/:id', auth, studentController.getStudentById);

// Lấy thông tin sinh viên theo userID (yêu cầu đăng nhập)
router.get('/user/:userId', auth, studentController.getStudentByUserId);

// Cập nhật thông tin sinh viên (chỉ admin và staff)
router.put('/:id', 
  auth, 
  roleCheck(['admin', 'staff']), 
  studentController.updateStudent
);

// Thống kê sinh viên theo khoa (chỉ admin và staff)
router.get('/stats/department', 
  auth, 
  roleCheck(['admin', 'staff']), 
  studentController.getStudentsByDepartment
);

module.exports = router;