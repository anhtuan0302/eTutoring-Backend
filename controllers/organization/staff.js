const Staff = require("../../models/organization/staff");
const Department = require("../../models/organization/department");
const User = require('../../models/auth/user');
const fs = require('fs');
const path = require('path');

// Lấy danh sách nhân viên
exports.getAllStaffs = async (req, res) => {
  try {
    const staffs = await Staff.find()
      .populate("department_id", "name")
      .populate("user_id", "-password");
    res.status(200).json(staffs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy thông tin nhân viên theo ID
exports.getStaffById = async (req, res) => {
  try {
    const { id } = req.params;

    const staff = await Staff.findById(id)
      .populate("user_id", "-password")
      .populate("department_id", "name");

    if (!staff) {
      return res.status(404).json({ error: "Không tìm thấy nhân viên" });
    }

    res.status(200).json(staff);
  } catch (error) {
    console.error("Error getting staff by id:", error);
    res.status(500).json({ error: error.message });
  }
};

// Lấy thông tin nhân viên theo userID
exports.getStaffByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const staff = await Staff.findOne({ user_id: userId })
      .populate("user_id", "-password")
      .populate("department_id", "name");
    if (!staff) {
      return res.status(404).json({ error: "Không tìm thấy nhân viên" });
    }

    res.status(200).json(staff);
  } catch (error) {
    console.error("Error getting staff by user id:", error);
    res.status(500).json({ error: error.message });
  }
};

// Cập nhật thông tin nhân viên (admin only)
exports.updateStaff = async (req, res) => {
  try {
    // Kiểm tra quyền admin
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Không có quyền thực hiện thao tác này" });
    }

    const { id } = req.params;
    const { department_id } = req.body;

    const staff = await Staff.findById(id);

    if (!staff) {
      return res.status(404).json({ error: "Không tìm thấy nhân viên" });
    }

    // Kiểm tra department có tồn tại không
    if (department_id) {
      const department = await Department.findById(department_id);
      if (!department) {
        return res.status(404).json({ error: "Không tìm thấy khoa/bộ môn" });
      }

      staff.department_id = department_id;
    }

    await staff.save();

    const updatedStaff = await Staff.findById(id)
      .populate("user_id", "-password")
      .populate("department_id", "name");

    res.status(200).json(updatedStaff);
  } catch (error) {
    console.error("Error updating staff:", error);
    res.status(500).json({ error: error.message });
  }
};

// Thống kê nhân viên theo khoa
exports.getStaffByDepartment = async (req, res) => {
  try {
    // Kiểm tra quyền admin
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Không có quyền thực hiện thao tác này" });
    }

    const stats = await Staff.aggregate([
      {
        $lookup: {
          from: "departments",
          localField: "department_id",
          foreignField: "_id",
          as: "department",
        },
      },
      {
        $unwind: "$department",
      },
      {
        $group: {
          _id: "$department_id",
          department: { $first: "$department.name" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    res.status(200).json(stats);
  } catch (error) {
    console.error("Error getting staff by department:", error);
    res.status(500).json({ error: error.message });
  }
};

// Xóa nhân viên và user tương ứng
exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    // Tìm thông tin nhân viên
    const staff = await Staff.findById(id);
    if (!staff) {
      return res.status(404).json({ error: 'Không tìm thấy nhân viên' });
    }

    // Lưu user_id để xóa user sau
    const userId = staff.user_id;

    // Tìm user để lấy đường dẫn avatar
    const user = await User.findById(userId);
    if (user && user.avatar_path) {
      // Xóa file avatar
      const avatarPath = path.join(__dirname, '../../', user.avatar_path);
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
      }
    }

    // Xóa staff trước
    await Staff.findByIdAndDelete(id);

    // Xóa user tương ứng
    await User.findByIdAndDelete(userId);

    res.status(200).json({ 
      message: 'Đã xóa nhân viên và tài khoản thành công',
      deletedStaff: staff
    });

  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ error: error.message });
  }
};