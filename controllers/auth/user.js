const User = require('../../models/auth/user');
const Student = require('../../models/organization/student');
const Staff = require('../../models/organization/staff');
const Tutor = require('../../models/organization/tutor');
const LoginHistory = require('../../models/auth/loginHistory');

// Lấy thông tin người dùng hiện tại
exports.getCurrentUser = async (req, res) => {
    try {
      const user = req.user;
      let roleInfo = null;
  
      // Lấy thông tin role tương ứng
      switch (user.role) {
        case 'student':
          roleInfo = await Student.findOne({ user: user._id });
          break;
        case 'staff':
          roleInfo = await Staff.findOne({ user: user._id });
          break;
        case 'tutor':
          roleInfo = await Tutor.findOne({ user: user._id });
          break;
        default:
          // Admin không có thông tin role phụ
          break;
      }
  
      // Tạo đối tượng user để trả về, không bao gồm mật khẩu
      const userResponse = {
        _id: user._id,
        email: user.email,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        phone_number: user.phone_number,
        avatar_path: user.avatar_path,
        status: user.status,
        lastActive: user.lastActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
  
      res.send({
        user: userResponse,
        roleInfo
      });
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  };

// Cập nhật thông tin người dùng
exports.updateUser = async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['first_name', 'last_name', 'password', 'phone_number'];
    const isValidOperation = updates.every((update) => allowedUpdates.includes(update));
  
    if (!isValidOperation) {
      return res.status(400).send({ error: 'Cập nhật không hợp lệ!' });
    }
  
    try {
      updates.forEach((update) => {
        req.user[update] = req.body[update];
      });
      await req.user.save();
      
      // Tạo đối tượng user để trả về, không bao gồm mật khẩu
      const userResponse = {
        _id: req.user._id,
        email: req.user.email,
        username: req.user.username,
        first_name: req.user.first_name,
        last_name: req.user.last_name,
        fullName: `${req.user.first_name} ${req.user.last_name}`,
        role: req.user.role,
        phone_number: req.user.phone_number,
        avatar_path: req.user.avatar_path,
        status: req.user.status,
        lastActive: req.user.lastActive,
        createdAt: req.user.createdAt,
        updatedAt: req.user.updatedAt
      };
      
      res.send({
        user: userResponse
      });
    } catch (error) {
      res.status(400).send({ error: error.message });
    }
  };

// Lấy lịch sử đăng nhập
exports.getLoginHistory = async (req, res) => {
  try {
    const loginHistory = await LoginHistory.find({ user: req.user._id })
      .sort({ loginTime: -1 })
      .limit(10);

    res.send(loginHistory);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

// Cập nhật thông tin role
exports.updateRoleInfo = async (req, res) => {
  try {
    const { roleInfo } = req.body;
    let roleModel;
    
    switch (req.user.role) {
      case 'student':
        roleModel = await Student.findOne({ user: req.user._id });
        break;
      case 'staff':
        roleModel = await Staff.findOne({ user: req.user._id });
        break;
      case 'tutor':
        roleModel = await Tutor.findOne({ user: req.user._id });
        break;
      default:
        return res.status(400).send({ error: 'Không có thông tin role để cập nhật.' });
    }

    if (!roleModel) {
      return res.status(404).send({ error: 'Không tìm thấy thông tin role.' });
    }

    // Cập nhật thông tin role
    Object.keys(roleInfo).forEach((key) => {
      roleModel[key] = roleInfo[key];
    });

    await roleModel.save();
    res.send(roleModel);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// Lấy danh sách tất cả người dùng
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Xóa người dùng
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }
    await user.deleteOne();
    res.status(200).json({ message: 'Người dùng đã được xóa thành công' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Lấy thông tin người dùng theo ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
