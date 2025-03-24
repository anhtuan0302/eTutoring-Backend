const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');
const submissionController = require('../../controllers/education/submission');

// Nộp bài
router.post('/', 
  auth, 
  roleCheck(['student']),
  submissionController.upload.array('attachments'),
  submissionController.createSubmission
);

// Lấy danh sách bài nộp của bài tập
router.get('/assignment/:assignment_id', auth, submissionController.getSubmissionsByAssignment);

// Lấy bài nộp của sinh viên
router.get('/assignment/:assignment_id/student/:student_id', auth, submissionController.getStudentSubmission);

// Chấm điểm bài nộp
router.post('/:id/grade', auth, roleCheck(['tutor']), submissionController.gradeSubmission);

// Download attachment
router.get('/:id/attachment/:attachmentId/download', auth, submissionController.downloadAttachment);

module.exports = router;