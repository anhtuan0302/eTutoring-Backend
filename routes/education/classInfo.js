const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');
const classInfoController = require('../../controllers/education/classInfo');

// Tạo lớp học mới
router.post('/', auth, roleCheck(['admin', 'staff']), classInfoController.createClass);

// Lấy danh sách lớp học
router.get('/', auth, classInfoController.getAllClasses);

// Lấy thông tin lớp học theo ID
router.get('/:id', auth, classInfoController.getClassById);

// Cập nhật lớp học
router.put('/:id', auth, roleCheck(['admin', 'staff']), classInfoController.updateClass);

// Xóa lớp học
router.delete('/:id', auth, roleCheck(['admin', 'staff']), classInfoController.deleteClass);

module.exports = router;