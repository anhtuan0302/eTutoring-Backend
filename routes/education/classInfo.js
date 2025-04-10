const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');
const classInfoController = require('../../controllers/education/classInfo');

// Tạo lớp học mới
router.post('/', auth, roleCheck(['admin', 'staff']), classInfoController.createClass);

// Lấy danh sách lớp học
router.get('/', auth, roleCheck(['admin', 'staff', 'tutor', 'student']), classInfoController.getAllClasses);

// Lấy thông tin lớp học theo ID
router.get('/:id', auth, roleCheck(['admin', 'staff', 'tutor', 'student']), classInfoController.getClassById);

// Cập nhật lớp học
router.patch('/:id', auth, roleCheck(['admin', 'staff']), classInfoController.updateClass);

// Xóa lớp học
router.delete('/:id', auth, roleCheck(['admin', 'staff']), classInfoController.deleteClass);

// Get class students
router.get('/:id/students', auth, roleCheck(['admin', 'staff', 'tutor', 'student']), classInfoController.getClassStudents);

// Get class tutors
router.get('/:id/tutors', auth, roleCheck(['admin', 'staff', 'tutor', 'student']), classInfoController.getClassTutors);

module.exports = router;