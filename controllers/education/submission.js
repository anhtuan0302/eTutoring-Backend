const Submission = require('../../models/education/submission');
const ClassContent = require('../../models/education/classContent');
const Enrollment = require('../../models/education/enrollment');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Cấu hình multer cho upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/submission';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

exports.upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Loại file không được hỗ trợ'));
    }
  }
});

// Nộp bài
exports.createSubmission = async (req, res) => {
  try {
    const { assignment_id, student_id, content } = req.body;
    
    // Kiểm tra bài tập tồn tại
    const assignment = await ClassContent.findOne({ 
      _id: assignment_id, 
      content_type: 'assignment',
      is_deleted: false 
    });
    
    if (!assignment) {
      return res.status(404).json({ error: 'Không tìm thấy bài tập' });
    }
    
    // Kiểm tra sinh viên đã đăng ký lớp học chưa
    const enrollment = await Enrollment.findOne({ 
      class_id: assignment.class_id,
      student_id
    });
    
    if (!enrollment) {
      return res.status(400).json({ error: 'Sinh viên chưa đăng ký lớp học này' });
    }
    
    // Xử lý files nếu có
    const attachments = req.files?.map(file => ({
      file_name: file.originalname,
      file_path: file.path,
      file_type: file.mimetype,
      file_size: file.size
    })) || [];
    
    // Kiểm tra đã có bài nộp chưa
    const existingSubmission = await Submission.findOne({
      assignment_id,
      student_id
    });
    
    let submission;
    let isNew = false;
    
    if (existingSubmission) {
      // Cập nhật bài nộp cũ
      existingSubmission.content = content;
      existingSubmission.attachments = attachments;
      existingSubmission.submitted_at = new Date();
      existingSubmission.status = 'submitted';
      existingSubmission.is_late = assignment.duedate && new Date() > new Date(assignment.duedate);
      existingSubmission.version = existingSubmission.version + 1;
      
      submission = await existingSubmission.save();
    } else {
      // Tạo bài nộp mới
      submission = new Submission({
        assignment_id,
        student_id,
        content,
        attachments,
        submitted_at: new Date(),
        is_late: assignment.duedate && new Date() > new Date(assignment.duedate),
        status: 'submitted',
        version: 1
      });
      
      await submission.save();
      isNew = true;
    }
    
    // Thông báo realtime
    if (req.io) {
      req.io.to(`class:${assignment.class_id}`).emit('submission:created', {
        submission_id: submission._id,
        assignment_id,
        student_id,
        is_new: isNew,
        version: submission.version,
        is_late: submission.is_late
      });
    }
    
    res.status(201).json(submission);
  } catch (error) {
    // Xóa files nếu có lỗi
    if (req.files) {
      req.files.forEach(file => fs.unlinkSync(file.path));
    }
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách bài nộp của bài tập
exports.getSubmissionsByAssignment = async (req, res) => {
  try {
    const { assignment_id } = req.params;
    
    const submissions = await Submission.find({ assignment_id })
      .populate('student_id', 'user_id')
      .populate({
        path: 'student_id',
        populate: { path: 'user_id', select: 'first_name last_name' }
      })
      .sort({ submitted_at: -1 });
      
    res.status(200).json(submissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy bài nộp của sinh viên
exports.getStudentSubmission = async (req, res) => {
  try {
    const { assignment_id, student_id } = req.params;
    
    const submission = await Submission.findOne({ assignment_id, student_id })
      .populate('student_id', 'user_id')
      .populate({
        path: 'student_id',
        populate: { path: 'user_id', select: 'first_name last_name' }
      });
    
    if (!submission) {
      return res.status(404).json({ error: 'Không tìm thấy bài nộp' });
    }
    
    res.status(200).json(submission);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Chấm điểm bài nộp
exports.gradeSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { score, feedback } = req.body;
    
    // Kiểm tra điểm hợp lệ
    if (score < 0 || score > 100) {
      return res.status(400).json({ error: 'Điểm phải từ 0 đến 100' });
    }
    
    const submission = await Submission.findById(id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Không tìm thấy bài nộp' });
    }
    
    // Cập nhật điểm
    submission.grade = {
      score,
      feedback,
      graded_at: new Date(),
      graded_by: req.user._id
    };
    submission.status = 'graded';
    
    await submission.save();
    
    // Thông báo realtime
    if (req.io) {
      const assignment = await ClassContent.findById(submission.assignment_id);
      req.io.to(`class:${assignment.class_id}`).emit('submission:graded', {
        submission_id: submission._id,
        assignment_id: submission.assignment_id,
        student_id: submission.student_id,
        score
      });
    }
    
    res.status(200).json(submission);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Download attachment
exports.downloadAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    
    const submission = await Submission.findById(id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Không tìm thấy bài nộp' });
    }
    
    // Tìm attachment
    const attachment = submission.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Không tìm thấy file đính kèm' });
    }
    
    const filePath = path.join(__dirname, '../../', attachment.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File không tồn tại' });
    }
    
    res.download(filePath, attachment.file_name);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};