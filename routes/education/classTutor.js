const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');
const classTutorController = require('../../controllers/education/classTutor');

// Thêm giảng viên vào lớp
router.post('/', auth, roleCheck(['admin', 'staff']), classTutorController.assignTutor);

// Lấy danh sách giảng viên của lớp
router.get('/class/:class_id', auth, classTutorController.getTutorsByClass);

// Lấy danh sách lớp học của giảng viên
router.get('/tutor/:tutor_id', auth, classTutorController.getClassesByTutor);

// Cập nhật vai trò giảng viên
router.patch('/:id', auth, roleCheck(['admin', 'staff']), classTutorController.updateTutorRole);

// Xóa giảng viên khỏi lớp
router.delete('/:id', auth, roleCheck(['admin', 'staff']), classTutorController.removeTutor);

module.exports = router;