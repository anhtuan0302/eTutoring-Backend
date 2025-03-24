const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');
const courseController = require('../../controllers/education/cousre');

// Tạo khóa học mới
router.post('/', auth, roleCheck(['admin', 'staff']), courseController.createCourse);

// Lấy danh sách khóa học
router.get('/', auth, courseController.getAllCourses);

// Lấy thông tin khóa học theo ID
router.get('/:id', auth, courseController.getCourseById);

// Cập nhật khóa học
router.put('/:id', auth, roleCheck(['admin', 'staff']), courseController.updateCourse);

// Xóa khóa học
router.delete('/:id', auth, roleCheck(['admin', 'staff']), courseController.deleteCourse);

module.exports = router;