const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');
const attendanceController = require('../../controllers/education/attendance');

// Tạo điểm danh mới
router.post('/', auth, roleCheck(['admin', 'tutor', 'staff']), attendanceController.createAttendance);

// Lấy danh sách điểm danh của buổi học
router.get('/schedule/:schedule_id', auth, roleCheck(['admin', 'tutor', 'staff', 'student']), attendanceController.getAttendanceBySchedule);

// Lấy lịch sử điểm danh của sinh viên trong lớp
router.get('/class/:class_id/student/:student_id', auth, roleCheck(['admin', 'tutor', 'staff', 'student']), attendanceController.getStudentAttendance);

// Cập nhật điểm danh
router.patch('/:id', auth, roleCheck(['admin', 'tutor', 'staff']), attendanceController.updateAttendance);

// Xóa điểm danh
router.delete('/:id', auth, roleCheck(['admin', 'tutor', 'staff']), attendanceController.deleteAttendance);

// Điểm danh hàng loạt
router.post('/bulk', auth, roleCheck(['admin', 'tutor', 'staff']), attendanceController.bulkAttendance);

module.exports = router;