const Enrollment = require('../../models/education/enrollment');
const ClassInfo = require('../../models/education/classInfo');
const Student = require('../../models/organization/student');

// Đăng ký lớp học
exports.enrollStudent = async (req, res) => {
  try {
    const { classInfo_id, student_id } = req.body;
    
    // Kiểm tra lớp học tồn tại
    const classInfo = await ClassInfo.findById(classInfo_id);
    if (!classInfo) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Kiểm tra sinh viên tồn tại
    const student = await Student.findById(student_id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Kiểm tra sinh viên đã đăng ký lớp học này chưa
    const existingEnrollment = await Enrollment.findOne({ 
      classInfo_id, 
      student_id 
    });
    if (existingEnrollment) {
      return res.status(400).json({ error: 'Student has already enrolled in this class' });
    }
    
    // Kiểm tra lớp học đã đầy chưa
    if (classInfo.max_students) {
      const enrollmentCount = await Enrollment.countDocuments({ classInfo_id });
      if (enrollmentCount >= classInfo.max_students) {
        return res.status(400).json({ error: 'Class is full' });
      }
    }
    
    // Kiểm tra lớp học có đang mở không
    if (classInfo.status !== 'open') {
      return res.status(400).json({ error: 'Class is not open for enrollment' });
    }
    
    const enrollment = new Enrollment({
      classInfo_id,
      student_id
    });
    
    await enrollment.save();
    res.status(201).json(enrollment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getStudentsByClass = async (req, res) => {
  try {
      const { classInfo_id } = req.params;
      console.log('Backend: Getting students for class:', classInfo_id);

      const enrollments = await Enrollment.find({ classInfo_id })
          .populate({
              path: 'student_id',
              select: 'student_code user_id',
              populate: {
                  path: 'user_id',
                  select: 'first_name last_name email avatar_path'
              }
          })
          .populate({
              path: 'classInfo_id',
              select: 'code name'
          });

      console.log('Backend: Found enrollments:', enrollments);
      res.status(200).json(enrollments);
  } catch (error) {
      console.error('Backend error in getStudentsByClass:', error);
      res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách lớp học của sinh viên
exports.getClassesByStudent = async (req, res) => {
  try {
    const { student_id } = req.params;
    
    const enrollments = await Enrollment.find({ student_id })
      .populate({
        path: 'classInfo_id',
        populate: { 
          path: 'course_id', 
          select: 'name code' 
        }
      })
      .sort({ createdAt: -1 });
      
    res.status(200).json(enrollments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Kiểm tra sinh viên đã đăng ký lớp học chưa
exports.checkEnrollment = async (req, res) => {
  try {
    const { classInfo_id, student_id } = req.params;
    
    const enrollment = await Enrollment.findOne({ 
      classInfo_id, 
      student_id 
    });
    
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
    
    const enrollment = await Enrollment.findById(id);
    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    await enrollment.deleteOne();
    res.status(200).json({ message: 'Unenrolled successfully' });
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
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    const enrollment = await Enrollment.findById(id);
    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
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