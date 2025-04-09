const Submission = require('../../models/education/submission');
const ClassContent = require('../../models/education/classContent');
const ClassInfo = require('../../models/education/classInfo');
const Student = require('../../models/organization/student');
const Enrollment = require('../../models/education/enrollment');
const ClassTutor = require('../../models/education/classTutor');
const Tutor = require('../../models/organization/tutor');
const User = require('../../models/auth/user');
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
      'application/pdf'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Loại file không được hỗ trợ'));
    }
  }
}).single('file');

// Kiểm tra sinh viên có thuộc lớp không
const checkStudentInClass = async (studentId, classInfoId) => {
  const enrollment = await Enrollment.findOne({
    student_id: studentId,
    classInfo_id: classInfoId
  });
  return enrollment !== null;
};

// Kiểm tra giảng viên có thuộc lớp không
const checkTutorInClass = async (tutorId, classInfoId) => {
  try {
    const classTutor = await ClassTutor.findOne({
      tutor_id: tutorId,
      classInfo_id: classInfoId
    });

    return classTutor !== null;
  } catch (error) {
    console.error('Error in checkTutorInClass:', error);
    return false;
  }
};

// Tạo submission mới
exports.createSubmission = async (req, res) => {
  try {
    const { assignment_id, student_id } = req.body;
    const file = req.file; // Thay đổi từ req.files sang req.file

    if (!file) {
      return res.status(400).json({ error: 'Vui lòng upload file' });
    }

    // Kiểm tra assignment tồn tại
    const assignment = await ClassContent.findById(assignment_id);
    if (!assignment) {
      return res.status(404).json({ error: 'Không tìm thấy bài tập' });
    }

    // Kiểm tra sinh viên có thuộc lớp không
    const isStudentInClass = await checkStudentInClass(student_id, assignment.classInfo_id);
    if (!isStudentInClass) {
      return res.status(403).json({ error: 'Bạn không thuộc lớp học này' });
    }

    // Kiểm tra hạn nộp
    if (assignment.duedate && new Date() > new Date(assignment.duedate)) {
      return res.status(400).json({ error: 'Đã quá hạn nộp bài' });
    }

    // Xử lý file upload
    const fileData = {
      file_name: file.originalname,
      file_path: file.path,
      file_type: file.mimetype,
      file_size: file.size
    };

    // Kiểm tra xem đã có submission chưa
    let submission = await Submission.findOne({ assignment_id, student_id });

    if (submission) {
      // Nếu đã có, cập nhật attachments
      // Xóa file cũ nếu có
      if (submission.attachments && submission.attachments.length > 0) {
        submission.attachments.forEach(attachment => {
          if (fs.existsSync(attachment.file_path)) {
            fs.unlinkSync(attachment.file_path);
          }
        });
      }
      submission.attachments = [fileData];
      submission.submitted_at = new Date();
      await submission.save();
    } else {
      // Nếu chưa có, tạo mới
      submission = new Submission({
        assignment_id,
        student_id,
        attachments: [fileData]
      });
      await submission.save();
    }

    res.status(201).json(submission);
  } catch (error) {
    // Xóa file nếu có lỗi
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Error in createSubmission:', error);
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách submission của một assignment
exports.getSubmissionsByAssignment = async (req, res) => {
  try {
    const { assignment_id } = req.params;
    const user = req.user;

    // Nếu là student, tìm submission của student đó
    if (user.role === 'student') {
      // Đầu tiên tìm student record của user
      const student = await Student.findOne({
        user_id: user._id
      });
      
      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Tìm submission với student_id
      const submission = await Submission.findOne({
        assignment_id: assignment_id,
        student_id: student._id
      })
      .populate('attachments')
      .populate({
        path: 'student_id',
        populate: {
          path: 'user_id'
        }
      });

      return res.json({ data: submission });
    }

    // Nếu là tutor hoặc admin, lấy tất cả submissions
    const submissions = await Submission.find({ assignment_id })
      .populate('attachments')
      .populate({
        path: 'student_id',
        populate: {
          path: 'user_id'
        }
      });

    return res.json({ data: submissions });

  } catch (error) {
    console.error('Error in getSubmissionsByAssignment:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Chấm điểm submission
exports.gradeSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { score, feedback, file } = req.body;
    const user = req.user;

    // Tìm tutor record
    let tutor = null;
    if (user.role === 'tutor') {
      tutor = await Tutor.findOne({ user_id: user._id });
      if (!tutor) {
        return res.status(403).json({ error: 'Không tìm thấy thông tin giảng viên' });
      }
    }

    // Tìm submission
    const submission = await Submission.findById(id)
      .populate({
        path: 'assignment_id',
        populate: {
          path: 'classInfo_id',
          select: '_id'
        }
      });

    if (!submission) {
      return res.status(404).json({ error: 'Không tìm thấy bài nộp' });
    }

    // Kiểm tra quyền truy cập
    if (user.role === 'tutor') {
      const classTutor = await ClassTutor.findOne({
        tutor_id: tutor._id,
        classInfo_id: submission.assignment_id.classInfo_id._id
      });

      if (!classTutor) {
        return res.status(403).json({ error: 'Bạn không phải là giảng viên của lớp học này' });
      }
    }

    // Kiểm tra điểm hợp lệ
    if (score < 0 || score > 100) {
      return res.status(400).json({ error: 'Điểm phải nằm trong khoảng 0-100' });
    }

    // Tạo object grade mới
    const gradeData = {
      score,
      feedback,
      graded_at: new Date(),
      graded_by: tutor._id
    };

    // Nếu có file đính kèm (feedback file)
    if (file) {
      gradeData.file_path = file.path;
    }

    // Cập nhật hoặc tạo mới grade
    submission.grade = gradeData;
    submission.status = 'graded';
    await submission.save();

    // Populate thêm thông tin giảng viên chấm điểm
    const populatedSubmission = await Submission.findById(submission._id)
      .populate({
        path: 'student_id',
        select: 'student_code',
        populate: {
          path: 'user_id',
          select: 'first_name last_name email avatar_path'
        }
      })
      .populate({
        path: 'assignment_id',
        select: 'title description duedate',
        populate: {
          path: 'classInfo_id',
          select: 'code course_id',
          populate: {
            path: 'course_id',
            select: 'name code'
          }
        }
      })
      .populate({
        path: 'grade.graded_by',
        select: 'tutor_code',
        populate: {
          path: 'user_id',
          select: 'first_name last_name email avatar_path'
        }
      });

    res.status(200).json({
      data: populatedSubmission.toObject()
    });
  } catch (error) {
    // Nếu có lỗi và đã upload file, xóa file
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Error grading submission:', error);
    res.status(500).json({ error: error.message });
  }
};

// Download attachment
exports.downloadAttachment = async (req, res) => {
  try {
    const { submission_id, attachment_id } = req.params;
    const user = req.user;

    // Kiểm tra submission tồn tại
    const submission = await Submission.findById(submission_id)
      .populate({
        path: 'assignment_id',
        populate: {
          path: 'classInfo_id',
          select: '_id'
        }
      });

    if (!submission) {
      return res.status(404).json({ error: 'Không tìm thấy bài nộp' });
    }

    // Kiểm tra quyền truy cập
    if (user.role === 'student' && submission.student_id.toString() !== user.student_id.toString()) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập file này' });
    }

    if (user.role === 'tutor') {
      const isTutorInClass = await checkTutorInClass(user.tutor_id, submission.assignment_id.classInfo_id._id);
      if (!isTutorInClass) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập file này' });
      }
    }

    // Tìm attachment
    const attachment = submission.attachments.id(attachment_id);
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

// Lấy thông tin một bài nộp
exports.getSubmissionById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Tìm tutor record trước khi query submission
    let tutor = null;
    if (user.role === 'tutor') {
      tutor = await Tutor.findOne({ user_id: user._id });
      if (!tutor) {
        return res.status(403).json({ error: 'Không tìm thấy thông tin giảng viên' });
      }
    }

    const submission = await Submission.findById(id)
      .populate({
        path: 'student_id',
        select: 'student_code',
        populate: {
          path: 'user_id',
          select: 'first_name last_name email avatar_path'
        }
      })
      .populate({
        path: 'assignment_id',
        select: 'title description duedate',
        populate: {
          path: 'classInfo_id',
          select: 'code course_id',
          populate: {
            path: 'course_id',
            select: 'name code'
          }
        }
      })
      .populate({
        path: 'attachments',
        select: 'file_name file_path file_type file_size'
      });

    if (!submission) {
      return res.status(404).json({ error: 'Không tìm thấy bài nộp' });
    }

    // Kiểm tra quyền truy cập
    if (user.role === 'student') {
      if (submission.student_id.user_id.toString() !== user._id.toString()) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }
    } else if (user.role === 'tutor') {
      // Kiểm tra xem tutor có trong lớp học không
      const classTutor = await ClassTutor.findOne({
        tutor_id: tutor._id,
        classInfo_id: submission.assignment_id.classInfo_id._id
      });

      if (!classTutor) {
        return res.status(403).json({ error: 'Bạn không phải là giảng viên của lớp học này' });
      }
    }

    // Populate thêm thông tin grade nếu có
    if (submission.grade) {
      
      await submission.populate({
        path: 'grade.graded_by',
        model: 'tutor',
        select: 'tutor_code user_id',
        populate: {
          path: 'user_id',
          model: 'user',
          select: 'first_name last_name email avatar_path'
        }
      });
    }

    // Format response data theo cấu trúc mà frontend mong đợi
    const responseData = {
      data: {
        ...submission.toObject(),
        grade: submission.grade ? {
          ...submission.grade,
          graded_by: submission.grade.graded_by ? {
            ...submission.grade.graded_by.toObject(),
            user_id: submission.grade.graded_by.user_id.toObject()
          } : null
        } : null
      }
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error getting submission by id:', error);
    res.status(500).json({ error: error.message });
  }
};