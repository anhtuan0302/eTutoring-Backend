const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');
const classScheduleController = require('../../controllers/education/classSchedule');

// Lấy danh sách tất cả lịch học
router.get('/', auth, roleCheck(['admin', 'staff']), classScheduleController.getAllSchedules);

// Lấy thông tin một lịch học
router.get('/:id', auth, roleCheck(['admin', 'staff', 'tutor', 'student']), classScheduleController.getScheduleById);

// Tạo lịch học mới
router.post('/', auth, roleCheck(['admin', 'staff']), classScheduleController.createSchedule);

// Lấy danh sách lịch học của lớp
router.get('/class/:classInfo_id', auth, classScheduleController.getSchedulesByClass);

// Cập nhật lịch học
router.patch('/:id', auth, roleCheck(['admin', 'staff']), classScheduleController.updateSchedule);

// Xóa lịch học
router.delete('/:id', auth, roleCheck(['admin', 'staff']), classScheduleController.deleteSchedule);

// Lấy danh sách lịch học của sinh viên
router.get('/student/:student_id', auth, classScheduleController.getSchedulesForStudentById);

// Lấy danh sách lịch dạy của giảng viên
router.get('/tutor/:tutor_id', auth, classScheduleController.getSchedulesForTutorById);

module.exports = router;