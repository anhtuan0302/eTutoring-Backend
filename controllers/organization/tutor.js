const Tutor = require('../../models/organization/tutor');
const Department = require('../../models/organization/department');

// Lấy danh sách giảng viên
exports.getAllTutors = async (req, res) => {
  try {
    const tutors = await Tutor.find();
    res.status(200).json(tutors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy thông tin giảng viên theo ID
exports.getTutorById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const tutor = await Tutor.findById(id)
      .populate('user_id', '-password')
      .populate('department_id', 'name');
    
    if (!tutor) {
      return res.status(404).json({ error: 'Không tìm thấy giảng viên' });
    }
    
    res.status(200).json(tutor);
  } catch (error) {
    console.error('Error getting tutor by id:', error);
    res.status(500).json({ error: error.message });
  }
};

// Lấy thông tin giảng viên theo userID
exports.getTutorByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const tutor = await Tutor.findOne({ user_id: userId })
      .populate('user_id', '-password')
      .populate('department_id', 'name');
    
    if (!tutor) {
      return res.status(404).json({ error: 'Không tìm thấy giảng viên' });
    }
    
    res.status(200).json(tutor);
  } catch (error) {
    console.error('Error getting tutor by user id:', error);
    res.status(500).json({ error: error.message });
  }
};

// Cập nhật thông tin giảng viên (admin only)
exports.updateTutor = async (req, res) => {
  try {
    // Kiểm tra quyền admin
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
    }
    
    const { id } = req.params;
    const { department_id } = req.body;
    
    const tutor = await Tutor.findById(id);
    
    if (!tutor) {
      return res.status(404).json({ error: 'Không tìm thấy giảng viên' });
    }
    
    // Kiểm tra department có tồn tại không
    if (department_id) {
      const department = await Department.findById(department_id);
      if (!department) {
        return res.status(404).json({ error: 'Không tìm thấy khoa/bộ môn' });
      }
      
      tutor.department_id = department_id;
    }
    
    await tutor.save();
    
    const updatedTutor = await Tutor.findById(id)
      .populate('user_id', '-password')
      .populate('department_id', 'name');
    
    res.status(200).json(updatedTutor);
  } catch (error) {
    console.error('Error updating tutor:', error);
    res.status(500).json({ error: error.message });
  }
};

// Thống kê giảng viên theo khoa
exports.getTutorsByDepartment = async (req, res) => {
  try {
    // Kiểm tra quyền admin hoặc staff
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
    }
    
    const stats = await Tutor.aggregate([
      {
        $lookup: {
          from: 'departments',
          localField: 'department_id',
          foreignField: '_id',
          as: 'department'
        }
      },
      {
        $unwind: '$department'
      },
      {
        $group: {
          _id: '$department_id',
          department: { $first: '$department.name' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error getting tutors by department:', error);
    res.status(500).json({ error: error.message });
  }
};