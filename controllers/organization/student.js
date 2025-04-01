const Student = require('../../models/organization/student');
const Department = require('../../models/organization/department');
const User = require('../../models/auth/user');
const fs = require('fs');
const path = require('path');

// Lấy danh sách sinh viên
exports.getAllStudents = async (req, res) => {
  try {
    const students = await Student.find()
    .populate("department_id", "name")
    .populate("user_id", "-password");
    res.status(200).json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy thông tin sinh viên theo ID
exports.getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const student = await Student.findById(id)
      .populate('user_id', '-password')
      .populate('department_id', 'name');
    
    if (!student) {
      return res.status(404).json({ error: 'Không tìm thấy sinh viên' });
    }
    
    res.status(200).json(student);
  } catch (error) {
    console.error('Error getting student by id:', error);
    res.status(500).json({ error: error.message });
  }
};

// Lấy thông tin sinh viên theo userID
exports.getStudentByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const student = await Student.findOne({ user_id: userId })
      .populate('user_id', '-password')
      .populate('department_id', 'name');
    
    if (!student) {
      return res.status(404).json({ error: 'Không tìm thấy sinh viên' });
    }
    
    res.status(200).json(student);
  } catch (error) {
    console.error('Error getting student by user id:', error);
    res.status(500).json({ error: error.message });
  }
};

// Cập nhật thông tin sinh viên (admin only)
exports.updateStudent = async (req, res) => {
  try {
    // Kiểm tra quyền admin hoặc staff
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
    }
    
    const { id } = req.params;
    const { department_id } = req.body;
    
    const student = await Student.findById(id);
    
    if (!student) {
      return res.status(404).json({ error: 'Không tìm thấy sinh viên' });
    }
    
    // Kiểm tra department có tồn tại không
    if (department_id) {
      const department = await Department.findById(department_id);
      if (!department) {
        return res.status(404).json({ error: 'Không tìm thấy khoa/bộ môn' });
      }
      
      student.department_id = department_id;
    }
    
    await student.save();
    
    const updatedStudent = await Student.findById(id)
      .populate('user_id', '-password')
      .populate('department_id', 'name');
    
    res.status(200).json(updatedStudent);
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ error: error.message });
  }
};

// Thống kê sinh viên theo khoa
exports.getStudentsByDepartment = async (req, res) => {
  try {
    // Kiểm tra quyền admin hoặc staff
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
    }
    
    const stats = await Student.aggregate([
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
    console.error('Error getting students by department:', error);
    res.status(500).json({ error: error.message });
  }
};

// Xóa sinh viên và user tương ứng
exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    // Tìm thông tin sinh viên
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ error: 'Không tìm thấy sinh viên' });
    }

    // Lưu user_id để xóa user sau
    const userId = student.user_id;

    // Tìm user để lấy đường dẫn avatar
    const user = await User.findById(userId);
    if (user && user.avatar_path) {
      // Xóa file avatar
      const avatarPath = path.join(__dirname, '../../', user.avatar_path);
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
      }
    }

    // Xóa student trước
    await Student.findByIdAndDelete(id);

    // Xóa user tương ứng
    await User.findByIdAndDelete(userId);

    res.status(200).json({ 
      message: 'Đã xóa sinh viên và tài khoản thành công',
      deletedStudent: student
    });

  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: error.message });
  }
};