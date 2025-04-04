const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');
const classContentController = require('../../controllers/education/classContent');

// Tạo nội dung mới
router.post('/',
  auth,
  roleCheck(['admin', 'staff', 'tutor']),
  classContentController.upload.array('attachments'),
  classContentController.createContent
);

// Lấy danh sách nội dung của lớp
router.get('/class/:classInfo_id', auth, classContentController.getContentsByClassId);

// Lấy thông tin nội dung theo ID
router.get('/:id', auth, classContentController.getContentById);

// Cập nhật nội dung
router.put('/:id',
  auth,
  roleCheck(['admin', 'staff', 'tutor']),
  classContentController.upload.array('attachments'),
  classContentController.updateContent
);

// Xóa attachment
router.delete('/:id/attachment/:attachmentId', auth, roleCheck(['admin', 'staff', 'tutor']), classContentController.removeAttachment);

// Xóa nội dung
router.delete('/:id', auth, roleCheck(['admin', 'staff', 'tutor']), classContentController.deleteContent);

// Download attachment
router.get('/:id/attachment/:attachmentId/download', auth, classContentController.downloadAttachment);

module.exports = router;