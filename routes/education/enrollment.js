const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');
const enrollmentController = require('../../controllers/education/enrollment');

// Đăng ký lớp học
router.post('/', auth, roleCheck(['admin', 'staff']), enrollmentController.enrollStudent);

// Lấy danh sách sinh viên đã đăng ký lớp
router.get('/class/:classInfo_id', auth, roleCheck(['admin', 'tutor', 'staff']), enrollmentController.getStudentsByClass);

// Lấy danh sách lớp học của sinh viên
router.get('/student/:student_id', auth, roleCheck(['admin', 'tutor', 'staff', 'student']), enrollmentController.getClassesByStudent);

// Kiểm tra sinh viên đã đăng ký lớp học chưa
router.get('/check/:class_id/:student_id', auth, roleCheck(['admin', 'tutor', 'staff']), enrollmentController.checkEnrollment);

// Rút khỏi lớp học
router.delete('/:id', auth, roleCheck(['admin', 'staff']), enrollmentController.unenrollStudent);

// Đánh giá lớp học
router.post('/:id/review', auth, roleCheck(['student']), enrollmentController.reviewClass);

module.exports = router;