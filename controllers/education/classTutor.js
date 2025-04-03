const ClassTutor = require('../../models/education/classTutor');
const ClassInfo = require('../../models/education/classInfo');
const Tutor = require('../../models/organization/tutor');

// Thêm giảng viên vào lớp
exports.assignTutor = async (req, res) => {
  try {
    const { classInfo_id, tutor_id, is_primary } = req.body;
    
    const classInfo = await ClassInfo.findById(classInfo_id)
    .populate({
      path: 'course_id',
      populate: {
        path: 'department_id'
      }
    });

    if (!classInfo) {
      return res.status(404).json({ error: 'Không tìm thấy lớp học' });
    }
    
    // Kiểm tra giảng viên tồn tại
    const tutor = await Tutor.findById(tutor_id).populate('department_id');
    if (!tutor) {
      return res.status(404).json({ error: 'Không tìm thấy giảng viên' });
    }
    
    // Kiểm tra department của giảng viên có khớp với department của khóa học không
    if (tutor.department_id._id.toString() !== classInfo.course_id.department_id._id.toString()) {
      return res.status(403).json({ 
        error: 'Giảng viên không thể đăng ký dạy lớp học thuộc khoa/bộ môn khác' 
      });
    }

    // Kiểm tra xem đã có phân công chưa
    const existingAssignment = await ClassTutor.findOne({ 
      classInfo_id,
      tutor_id 
    });
    if (existingAssignment) {
      return res.status(400).json({ error: 'Giảng viên đã được phân công cho lớp này' });
    }
    
    // Nếu là giảng viên chính, kiểm tra lớp đã có giảng viên chính chưa
    if (is_primary) {
      const existingPrimaryTutor = await ClassTutor.findOne({
        classInfo_id,
        is_primary: true
      });

      if (existingPrimaryTutor) {
        return res.status(400).json({ error: 'Lớp học đã có giảng viên chính' });
      }
    }
    
    const classTutor = new ClassTutor({
      classInfo_id,
      tutor_id,
      is_primary: is_primary || false
    });
    
    await classTutor.save();
    
    // Populate thông tin chi tiết
    const populatedClassTutor = await ClassTutor.findById(classTutor._id)
      .populate({
        path: 'classInfo_id',
        populate: {
          path: 'course_id',
          select: 'name code',
          populate: {
            path: 'department_id',
            select: 'name'
          }
        },
      })
      .populate({
        path: 'tutor_id',
        populate: [
            {
            path: 'user_id',
            select: '-password'
          },
          {
            path: 'department_id',
            select: 'name'
          }
        ]
      });

    res.status(201).json(populatedClassTutor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách giảng viên của lớp
exports.getTutorsByClass = async (req, res) => {
  try {
    const { class_id } = req.params;
    
    const tutors = await ClassTutor.find({ classInfo_id: class_id })
      .populate({
        path: 'tutor_id',
        populate: {
          path: 'user_id',
          select: '-password'
        }
      })
      .populate({
        path: 'tutor_id',
        populate: {
          path: 'department_id',
          select: 'name'
        }
      })
      .sort({ is_primary: -1 });
      
    res.status(200).json(tutors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách lớp học của giảng viên
exports.getClassesByTutor = async (req, res) => {
  try {
    const { tutor_id } = req.params;
    
    const classes = await ClassTutor.find({ tutor_id })
      .populate({
        path: 'tutor_id',
        populate: [
          {
            path: 'user_id',
            select: 'first_name last_name email phone_number avatar_path'
          },
          {
            path: 'department_id',
            select: 'name'
          }
        ]
      })
      .populate({
        path: 'classInfo_id',  // Sửa từ class_id thành classInfo_id
        populate: { path: 'course_id', select: 'name code' }
      })
      .sort({ 'classInfo_id.createdAt': -1 });  // Sửa từ class_id thành classInfo_id
      
    const filteredClasses = classes.filter(c => c.classInfo_id !== null);  // Sửa từ class_id thành classInfo_id
      
    res.status(200).json(filteredClasses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cập nhật vai trò giảng viên
exports.updateTutorRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_primary } = req.body;
    
    const classTutor = await ClassTutor.findById(id);
    if (!classTutor) {
      return res.status(404).json({ error: 'Không tìm thấy phân công giảng viên' });
    }
    
    // Nếu cập nhật thành giảng viên chính, cập nhật các giảng viên chính khác thành phụ
    if (is_primary) {
      await ClassTutor.updateMany(
        { 
          classInfo_id: classTutor.classInfo_id,  // Sửa từ class_id thành classInfo_id
          is_primary: true, 
          _id: { $ne: id } 
        },
        { is_primary: false }
      );
    }
    
    classTutor.is_primary = is_primary;
    await classTutor.save();
    
    // Populate thông tin chi tiết
    await classTutor.populate([
      { path: 'classInfo_id', select: 'code name' },  // Sửa từ class_id thành classInfo_id
      { path: 'tutor_id', select: 'tutor_code' },
      { 
        path: 'tutor_id',
        populate: { path: 'user_id', select: 'first_name last_name email' }
      }
    ]);
    
    res.status(200).json(classTutor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Xóa phân công giảng viên
exports.removeTutor = async (req, res) => {
  try {
    const { id } = req.params;
    
    const classTutor = await ClassTutor.findByIdAndDelete(id);
    if (!classTutor) {
      return res.status(404).json({ error: 'Không tìm thấy phân công giảng viên' });
    }
    
    res.status(200).json({ message: 'Đã xóa phân công giảng viên thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};