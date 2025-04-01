const Course = require('../../models/education/course');
const Department = require('../../models/organization/department');

// Tạo khóa học mới
exports.createCourse = async (req, res) => {
  try {
    const { name, code, description, department_id } = req.body;
    
    if (!name || !code || !department_id) {
      return res.status(400).json({ 
        error: 'Name, code and department are required fields' 
      });
    }
    
    // Kiểm tra code đã tồn tại chưa (thêm trim() để chuẩn hóa)
    const existingCourse = await Course.findOne({ 
      code: code.trim().toUpperCase()
    });

    if (existingCourse) {
      return res.status(400).json({ error: 'Course code already exists' });
    }

    // Kiểm tra phòng/khoa tồn tại
    const department = await Department.findById(department_id);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    const course = new Course({
      name: name.trim(),
      code: code.trim().toUpperCase(), // Chuẩn hóa code thành uppercase
      description: description ? description.trim() : null,
      department_id
    });
    
    await course.save();
    await course.populate('department_id', 'name');
    
    res.status(201).json(course);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Lấy danh sách khóa học
exports.getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find()
      .populate('department_id', 'name');
    
    res.status(200).json(courses);
  } catch (error) {
    console.error('Error getting courses:', error);
    res.status(500).json({ error: error.message });
  }
};

// Lấy chi tiết khóa học
exports.getCourseById = async (req, res) => {
  try {
      const { id } = req.params;
      const course = await Course.findById(id)
      .populate('department_id', 'name');
      
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
      res.status(200).json(course);
    } catch (error) {
      console.error('Error getting course:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
};

// Cập nhật khóa học
exports.updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.code) {
      const existingCourse = await Course.findOne({ code: updateData.code.trim().toUpperCase(), _id: { $ne: id } });
      if (existingCourse) {
        return res.status(400).json({ error: 'Course code already exists' });
      }
      updateData.code = updateData.code.trim().toUpperCase();
    }

    if (updateData.department_id) {
      const department = await Department.findById(updateData.department_id);
      if (!department) {
        return res.status(404).json({ error: 'Department not found' });
      }
    }

    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    course.set(updateData);
    await course.save();
    res.status(200).json(course);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Xóa khóa học
exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ error: 'Khóa học không tồn tại' });
    }
    await course.deleteOne();
    res.status(200).json({ message: 'Khóa học đã được xóa thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
