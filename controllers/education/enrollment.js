const Enrollment = require('../../models/education/enrollment');
const ClassInfo = require('../../models/education/classInfo');
const Student = require('../../models/organization/student');

// Đăng ký lớp học
exports.enrollStudent = async (req, res) => {
  try {
    const { class_id, student_id } = req.body;
    
    // Kiểm tra lớp học tồn tại
    const classInfo = await ClassInfo.findOne({ _id: class_id, is_deleted: false });
    if (!classInfo) {
      return res.status(404).json({ error: 'Không tìm thấy lớp học' });
    }
    
    // Kiểm tra sinh viên tồn tại
    const student = await Student.findOne({ _id: student_id, is_deleted: false });
    if (!student) {
      return res.status(404).json({ error: 'Không tìm thấy sinh viên' });
    }
    
    // Kiểm tra sinh viên đã đăng ký lớp học này chưa
    const existingEnrollment = await Enrollment.findOne({ class_id, student_id });
    if (existingEnrollment) {
      return res.status(400).json({ error: 'Sinh viên đã đăng ký lớp học này' });
    }
    
    // Kiểm tra lớp học đã đầy chưa
    if (classInfo.max_students) {
      const enrollmentCount = await Enrollment.countDocuments({ class_id });
      if (enrollmentCount >= classInfo.max_students) {
        return res.status(400).json({ error: 'Lớp học đã đầy' });
      }
    }
    
    // Kiểm tra lớp học có đang mở không
    if (classInfo.status !== 'open') {
      return res.status(400).json({ error: 'Lớp học không còn nhận đăng ký' });
    }
    
    const enrollment = new Enrollment({
      class_id,
      student_id
    });
    
    await enrollment.save();
    
    // Thông báo realtime
    if (req.io) {
      req.io.to(`class:${class_id}`).emit('enrollment:created', {
        enrollment_id: enrollment._id,
        class_id,
        student_id
      });
    }
    
    res.status(201).json(enrollment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách sinh viên đã đăng ký lớp
exports.getStudentsByClass = async (req, res) => {
  try {
    const { class_id } = req.params;
    
    const enrollments = await Enrollment.find({ class_id })
      .populate('student_id', 'user_id')
      .populate({
        path: 'student_id',
        populate: { path: 'user_id', select: 'first_name last_name email avatar_path' }
      })
      .sort({ createdAt: 1 });
      
    res.status(200).json(enrollments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách lớp học của sinh viên
exports.getClassesByStudent = async (req, res) => {
  try {
    const { student_id } = req.params;
    
    const enrollments = await Enrollment.find({ student_id })
      .populate({
        path: 'class_id',
        match: { is_deleted: false },
        populate: { path: 'course_id', select: 'name code' }
      })
      .sort({ 'class_id.year': -1, 'class_id.semester': 1 });
    
    // Lọc bỏ các null (trường hợp class đã bị xóa)
    const filteredEnrollments = enrollments.filter(e => e.class_id !== null);
      
    res.status(200).json(filteredEnrollments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Kiểm tra sinh viên đã đăng ký lớp học chưa
exports.checkEnrollment = async (req, res) => {
  try {
    const { class_id, student_id } = req.params;
    
    const enrollment = await Enrollment.findOne({ class_id, student_id });
    
    res.status(200).json({
      enrolled: !!enrollment,
      enrollment
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Rút khỏi lớp học
exports.unenrollStudent = async (req, res) => {
  try {
    const { id } = req.params;
    
    const enrollment = await Enrollment.findByIdAndDelete(id);
    
    if (!enrollment) {
      return res.status(404).json({ error: 'Không tìm thấy đăng ký lớp học' });
    }
    
    // Thông báo realtime
    if (req.io) {
      req.io.to(`class:${enrollment.class_id}`).emit('enrollment:deleted', {
        enrollment_id: enrollment._id,
        class_id: enrollment.class_id,
        student_id: enrollment.student_id
      });
    }
    
    res.status(200).json({ message: 'Đã hủy đăng ký lớp học thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Đánh giá lớp học
exports.reviewClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    
    // Kiểm tra rating hợp lệ
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Đánh giá phải từ 1 đến 5 sao' });
    }
    
    const enrollment = await Enrollment.findById(id);
    
    if (!enrollment) {
      return res.status(404).json({ error: 'Không tìm thấy đăng ký lớp học' });
    }
    
    // Cập nhật đánh giá
    enrollment.review = {
      rating,
      comment,
      review_at: new Date()
    };
    
    await enrollment.save();
    
    res.status(200).json(enrollment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};