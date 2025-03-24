const Course = require('../../models/education/course');

// Tạo khóa học mới
exports.createCourse = async (req, res) => {
  try {
    const { name, code, description, department_id } = req.body;
    
    // Kiểm tra code đã tồn tại chưa
    const existingCourse = await Course.findOne({ code, is_deleted: false });
    if (existingCourse) {
      return res.status(400).json({ error: 'Mã khóa học đã tồn tại' });
    }
    
    const course = new Course({
      name,
      code,
      description,
      department_id
    });
    
    await course.save();
    
    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách khóa học
exports.getAllCourses = async (req, res) => {
  try {
    const { department_id } = req.query;
    const filter = { is_deleted: false };
    
    if (department_id) {
      filter.department_id = department_id;
    }
    
    const courses = await Course.find(filter)
      .populate('department_id', 'name code')
      .sort({ name: 1 });
      
    res.status(200).json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy chi tiết khóa học
exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findOne({ 
      _id: req.params.id, 
      is_deleted: false 
    }).populate('department_id', 'name code');
    
    if (!course) {
      return res.status(404).json({ error: 'Không tìm thấy khóa học' });
    }
    
    res.status(200).json(course);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cập nhật khóa học
exports.updateCourse = async (req, res) => {
  try {
    const { name, description, department_id } = req.body;
    
    const course = await Course.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      { name, description, department_id },
      { new: true }
    ).populate('department_id', 'name code');
    
    if (!course) {
      return res.status(404).json({ error: 'Không tìm thấy khóa học' });
    }
    
    res.status(200).json(course);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Xóa khóa học
exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      { is_deleted: true },
      { new: true }
    );
    
    if (!course) {
      return res.status(404).json({ error: 'Không tìm thấy khóa học' });
    }
    
    res.status(200).json({ message: 'Đã xóa khóa học thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};