const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');
const classScheduleController = require('../../controllers/education/classSchedule');

// Tạo lịch học mới
router.post('/', auth, roleCheck(['admin', 'staff']), classScheduleController.createSchedule);

// Lấy danh sách lịch học của lớp
router.get('/class/:class_id', auth, classScheduleController.getSchedulesByClass);

// Lấy thông tin lịch học theo ID
router.get('/:id', auth, classScheduleController.getScheduleById);

// Cập nhật lịch học
router.put('/:id', auth, roleCheck(['admin', 'staff']), classScheduleController.updateSchedule);

// Xóa lịch học
router.delete('/:id', auth, roleCheck(['admin', 'staff']), classScheduleController.deleteSchedule);

module.exports = router;