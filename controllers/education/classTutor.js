const ClassTutor = require('../../models/education/classTutor');
const ClassInfo = require('../../models/education/classInfo');
const Tutor = require('../../models/organization/tutor');

// Thêm giảng viên vào lớp
exports.assignTutor = async (req, res) => {
  try {
    const { class_id, tutor_id, is_primary } = req.body;
    
    // Kiểm tra lớp học tồn tại
    const classInfo = await ClassInfo.findOne({ _id: class_id, is_deleted: false });
    if (!classInfo) {
      return res.status(404).json({ error: 'Không tìm thấy lớp học' });
    }
    
    // Kiểm tra giảng viên tồn tại
    const tutor = await Tutor.findOne({ _id: tutor_id, is_deleted: false });
    if (!tutor) {
      return res.status(404).json({ error: 'Không tìm thấy giảng viên' });
    }
    
    // Kiểm tra xem đã có phân công chưa
    const existingAssignment = await ClassTutor.findOne({ class_id, tutor_id });
    if (existingAssignment) {
      return res.status(400).json({ error: 'Giảng viên đã được phân công cho lớp này' });
    }
    
    // Nếu là giảng viên chính, cập nhật các giảng viên chính khác thành phụ
    if (is_primary) {
      await ClassTutor.updateMany(
        { class_id, is_primary: true },
        { is_primary: false }
      );
    }
    
    const classTutor = new ClassTutor({
      class_id,
      tutor_id,
      is_primary: is_primary || false
    });
    
    await classTutor.save();
    
    // Populate thông tin chi tiết
    await classTutor.populate([
      { path: 'class_id', select: 'code name' },
      { path: 'tutor_id', select: 'tutor_code' },
      { 
        path: 'tutor_id',
        populate: { path: 'user_id', select: 'first_name last_name email' }
      }
    ]);
    
    res.status(201).json(classTutor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách giảng viên của lớp
exports.getTutorsByClass = async (req, res) => {
  try {
    const { class_id } = req.params;
    
    const tutors = await ClassTutor.find({ class_id })
      .populate('tutor_id', 'tutor_code')
      .populate({
        path: 'tutor_id',
        populate: { path: 'user_id', select: 'first_name last_name email avatar_path' }
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
        path: 'class_id',
        match: { is_deleted: false },
        populate: { path: 'course_id', select: 'name code' }
      })
      .sort({ 'class_id.year': -1, 'class_id.semester': 1 });
      
    // Lọc bỏ các null (trường hợp class đã bị xóa)
    const filteredClasses = classes.filter(c => c.class_id !== null);
      
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
        { class_id: classTutor.class_id, is_primary: true, _id: { $ne: id } },
        { is_primary: false }
      );
    }
    
    classTutor.is_primary = is_primary;
    await classTutor.save();
    
    // Populate thông tin chi tiết
    await classTutor.populate([
      { path: 'class_id', select: 'code name' },
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