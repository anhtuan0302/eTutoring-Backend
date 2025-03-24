const ClassInfo = require('../../models/education/classInfo');
const ClassTutor = require('../../models/education/classTutor');
const Enrollment = require('../../models/education/enrollment');

// Tạo lớp học mới
exports.createClass = async (req, res) => {
  try {
    const { 
      course_id, code, name, semester, year, 
      max_students, status, start_date, end_date 
    } = req.body;
    
    // Kiểm tra code đã tồn tại chưa
    const existingClass = await ClassInfo.findOne({ code, is_deleted: false });
    if (existingClass) {
      return res.status(400).json({ error: 'Mã lớp học đã tồn tại' });
    }
    
    const classInfo = new ClassInfo({
      course_id,
      code,
      name,
      semester,
      year,
      max_students,
      status: status || 'open',
      start_date,
      end_date
    });
    
    await classInfo.save();
    
    res.status(201).json(classInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách lớp học
exports.getAllClasses = async (req, res) => {
  try {
    const { course_id, status, semester, year } = req.query;
    const filter = { is_deleted: false };
    
    if (course_id) filter.course_id = course_id;
    if (status) filter.status = status;
    if (semester) filter.semester = semester;
    if (year) filter.year = year;
    
    const classes = await ClassInfo.find(filter)
      .populate('course_id', 'name code')
      .sort({ year: -1, semester: 1, name: 1 });
      
    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy chi tiết lớp học
exports.getClassById = async (req, res) => {
  try {
    const classInfo = await ClassInfo.findOne({ 
      _id: req.params.id, 
      is_deleted: false 
    }).populate('course_id', 'name code');
    
    if (!classInfo) {
      return res.status(404).json({ error: 'Không tìm thấy lớp học' });
    }
    
    // Lấy số lượng sinh viên đã đăng ký
    const enrollmentCount = await Enrollment.countDocuments({ class_id: req.params.id });
    
    // Lấy thông tin giảng viên của lớp
    const tutors = await ClassTutor.find({ class_id: req.params.id })
      .populate('tutor_id', 'tutor_code')
      .populate({
        path: 'tutor_id',
        populate: {
          path: 'user_id',
          select: 'first_name last_name email'
        }
      });
    
    const result = {
      ...classInfo.toObject(),
      enrollment_count: enrollmentCount,
      tutors
    };
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cập nhật lớp học
exports.updateClass = async (req, res) => {
  try {
    const {
      course_id, name, semester, year,
      max_students, status, start_date, end_date
    } = req.body;
    
    const classInfo = await ClassInfo.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      {
        course_id, name, semester, year,
        max_students, status, start_date, end_date
      },
      { new: true }
    ).populate('course_id', 'name code');
    
    if (!classInfo) {
      return res.status(404).json({ error: 'Không tìm thấy lớp học' });
    }
    
    res.status(200).json(classInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Xóa lớp học
exports.deleteClass = async (req, res) => {
  try {
    const classInfo = await ClassInfo.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      { is_deleted: true },
      { new: true }
    );
    
    if (!classInfo) {
      return res.status(404).json({ error: 'Không tìm thấy lớp học' });
    }
    
    res.status(200).json({ message: 'Đã xóa lớp học thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};