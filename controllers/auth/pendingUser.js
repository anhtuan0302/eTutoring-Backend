const PendingUser = require('../../models/auth/pendingUser');
const User = require('../../models/auth/user');
const Student = require('../../models/organization/student');
const Tutor = require('../../models/organization/tutor');
const Staff = require('../../models/organization/staff');
const Department = require('../../models/organization/department');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const sendEmail = require('../../config/email');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/avatar";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

exports.upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file hình ảnh (jpg, png, gif, webp)"));
    }
  },
});

// Hàm tạo mã ngẫu nhiên cho student/staff/tutor
const generateRandomCode = async (prefix, currentCount) => {
  // Lấy 2 số cuối của năm hiện tại
  const year = new Date().getFullYear() % 100;
  
  // Format số thứ tự thành chuỗi 4 chữ số (0001, 0002, etc.)
  const sequence = String(currentCount).padStart(4, '0');
  
  return `${prefix}${year}${sequence}`;
};

// Sửa lại hàm generateUniqueCode
const generateUniqueCode = async (role) => {
  let Model;
  let prefix;
  let codeField;

  switch (role) {
    case 'student':
      Model = Student;
      prefix = 'ST';
      codeField = 'student_code';
      break;
    case 'tutor':
      Model = Tutor;
      prefix = 'TU';
      codeField = 'tutor_code';
      break;
    case 'staff':
      Model = Staff;
      prefix = 'SF';
      codeField = 'staff_code';
      break;
    default:
      throw new Error('Vai trò không hợp lệ');
  }

  // Lấy 2 số cuối của năm hiện tại
  const year = new Date().getFullYear() % 100;
  
  // Tìm mã code cuối cùng trong năm hiện tại
  const lastCode = await Model.findOne({
    [codeField]: new RegExp(`^${prefix}${year}`)
  })
  .sort({ [codeField]: -1 });

  let nextCount = 1;
  
  if (lastCode) {
    // Lấy 4 số cuối của mã code cuối cùng và tăng lên 1
    const lastSequence = parseInt(lastCode[codeField].slice(-4));
    nextCount = lastSequence + 1;
  }

  const newCode = await generateRandomCode(prefix, nextCount);
  return newCode;
};

const generateAdminCode = async () => {
  const prefix = 'AD';
  const year = new Date().getFullYear() % 100;
  
  // Tìm user admin cuối cùng trong năm hiện tại
  const lastAdmin = await User.findOne({
    role: 'admin',
    username: new RegExp(`^${prefix}${year}`)
  })
  .sort({ username: -1 });

  let nextCount = 1;
  
  if (lastAdmin) {
    const lastSequence = parseInt(lastAdmin.username.slice(-4));
    nextCount = lastSequence + 1;
  }

  return `${prefix}${year}${String(nextCount).padStart(4, '0')}`;
};

// Tạo lời mời người dùng mới
exports.createPendingUser = async (req, res) => {
  try {
    const { role, first_name, last_name, email, phone_number, department_id } = req.body;

    // Xác thực dữ liệu đầu vào cơ bản
    if (!role || !first_name || !last_name || !email) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
    }

    // Kiểm tra role hợp lệ
    const validRoles = ['student', 'tutor', 'staff', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Vai trò không hợp lệ' });
    }

    // Chỉ kiểm tra department_id nếu role không phải là admin
    if (role !== 'admin') {
      if (!department_id) {
        return res.status(400).json({ error: 'Vui lòng chọn Phòng/Khoa' });
      }

      // Kiểm tra department tồn tại
      const department = await Department.findById(department_id);
      if (!department) {
        return res.status(400).json({ error: 'Phòng/Khoa không tồn tại' });
      }
    }

    // Kiểm tra email có tồn tại trong hệ thống chưa
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email đã tồn tại trong hệ thống' });
    }

    // Kiểm tra điện thoại nếu có
    if (phone_number && phone_number.trim() !== '') {
      const existingPhone = await User.findOne({ phone_number });
      if (existingPhone) {
        return res.status(400).json({ error: 'Số điện thoại đã tồn tại trong hệ thống' });
      }
    }

    // Kiểm tra người dùng đang chờ xử lý
    const existingPendingUser = await PendingUser.findOne({ email });
    if (existingPendingUser) {
      return res.status(400).json({ error: 'Email này đã có lời mời đang chờ xác nhận' });
    }

    // Tạo token mời
    const invitation_token = crypto.randomBytes(32).toString('hex');
    const invitation_expires_at = new Date();
    invitation_expires_at.setHours(invitation_expires_at.getHours() + 24);

    // Tạo người dùng đang chờ xử lý
    const pendingUser = new PendingUser({
      role,
      first_name,
      last_name,
      email,
      phone_number: phone_number && phone_number.trim() !== '' ? phone_number.trim() : undefined, // Thay đổi null thành undefined
      department_id: role !== 'admin' ? department_id : undefined,
      invitation_token,
      invitation_sent_at: new Date(),
      invitation_expires_at
    });

    await pendingUser.save();

    // Gửi email mời
    const invitationUrl = `${process.env.FRONTEND_URL}/invitation?token=${invitation_token}`;
    
    await sendEmail({
      email: email,
      subject: 'Lời mời tham gia hệ thống eTutoring',
      message: `
        Xin chào ${first_name} ${last_name},
        
        Bạn đã được mời tham gia hệ thống eTutoring với vai trò ${role}.
        
        Vui lòng truy cập liên kết sau để thiết lập mật khẩu và hoàn tất đăng ký:
        ${invitationUrl}
        
        Liên kết này sẽ hết hạn sau 24 giờ.
        
        Xin cảm ơn!
      `
    });

    res.status(201).json({ 
      message: 'Lời mời đã được gửi thành công',
      pendingUser: {
        _id: pendingUser._id,
        email: pendingUser.email,
        role: pendingUser.role,
        invitation_expires_at: pendingUser.invitation_expires_at
      }
    });
  } catch (error) {
    console.error('Error creating pending user:', error);
    res.status(500).json({ error: error.message });
  }
};

// Cập nhật verifyInvitation
exports.verifyInvitation = async (req, res) => {
  try {
    const { token } = req.params;
    
    const pendingUser = await PendingUser.findOne({
      invitation_token: token,
      invitation_expires_at: { $gt: new Date() }
    }).populate(pendingUser => pendingUser.department_id ? 'department_id' : null);

    if (!pendingUser) {
      return res.status(400).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    res.status(200).json({
      pendingUser: {
        _id: pendingUser._id,
        first_name: pendingUser.first_name,
        last_name: pendingUser.last_name,
        email: pendingUser.email,
        role: pendingUser.role,
        department: pendingUser.role !== 'admin' ? pendingUser.department_id : undefined,
        invitation_expires_at: pendingUser.invitation_expires_at
      }
    });
  } catch (error) {
    console.error('Error verifying invitation:', error);
    res.status(500).json({ error: error.message });
  }
};

// Hoàn tất đăng ký
exports.completeRegistration = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirm_password } = req.body;
    const avatarFile = req.file; // Lấy file từ multer

    // Kiểm tra mật khẩu
    if (password !== confirm_password) {
      // Xóa file nếu có lỗi
      if (avatarFile) {
        fs.unlinkSync(avatarFile.path);
      }
      return res.status(400).json({ error: 'Mật khẩu xác nhận không khớp' });
    }

    if (password.length < 6) {
      if (avatarFile) {
        fs.unlinkSync(avatarFile.path);
      }
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    // Tìm người dùng đang chờ xử lý
    const pendingUser = await PendingUser.findOne({
      invitation_token: token,
      invitation_expires_at: { $gt: new Date() }
    });

    if (!pendingUser) {
      if (avatarFile) {
        fs.unlinkSync(avatarFile.path);
      }
      return res.status(400).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Tạo mã code theo role
    let userCode;
    if (pendingUser.role === 'admin') {
      userCode = await generateAdminCode();
    } else {
      userCode = await generateUniqueCode(pendingUser.role);
    }

    // Tạo user mới với username là mã code
    const newUser = new User({
      role: pendingUser.role,
      first_name: pendingUser.first_name,
      last_name: pendingUser.last_name,
      username: userCode,
      email: pendingUser.email,
      password: hashedPassword,
      phone_number: pendingUser.phone_number || null,
      avatar_path: avatarFile ? avatarFile.path : undefined
    });

    await newUser.save();

    // Tạo profile theo role
    if (pendingUser.role !== 'admin') {
      switch (pendingUser.role) {
        case 'student': {
          const student = new Student({
            user_id: newUser._id,
            student_code: userCode,
            department_id: pendingUser.department_id
          });
          await student.save();
          break;
        }
        case 'tutor': {
          const tutor = new Tutor({
            user_id: newUser._id,
            tutor_code: userCode,
            department_id: pendingUser.department_id
          });
          await tutor.save();
          break;
        }
        case 'staff': {
          const staff = new Staff({
            user_id: newUser._id,
            staff_code: userCode,
            department_id: pendingUser.department_id
          });
          await staff.save();
          break;
        }
      }
    }

    // Xóa pending user
    await PendingUser.findByIdAndDelete(pendingUser._id);

    res.status(201).json({ 
      message: 'Đăng ký thành công',
      user: {
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        avatar_path: newUser.avatar_path
      }
    });
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Error completing registration:', error);
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách lời mời đang chờ
exports.getPendingUsers = async (req, res) => {
  try {
    const pendingUsers = await PendingUser.find()
      .populate('department_id', 'name')
      .sort({ invitation_sent_at: -1 });
    
    res.status(200).json(pendingUsers);
  } catch (error) {
    console.error('Error getting pending users:', error);
    res.status(500).json({ error: error.message });
  }
};

// Hủy lời mời
exports.cancelInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    
    const pendingUser = await PendingUser.findById(id);
    
    if (!pendingUser) {
      return res.status(404).json({ error: 'Không tìm thấy lời mời' });
    }
    
    await PendingUser.findByIdAndDelete(id);
    
    res.status(200).json({ message: 'Đã hủy lời mời thành công' });
  } catch (error) {
    console.error('Error canceling invitation:', error);
    res.status(500).json({ error: error.message });
  }
};

// Gửi lại lời mời
exports.resendInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    
    const pendingUser = await PendingUser.findById(id);
    
    if (!pendingUser) {
      return res.status(404).json({ error: 'Không tìm thấy lời mời' });
    }
    
    // Tạo token mới
    const invitation_token = crypto.randomBytes(32).toString('hex');
    const invitation_expires_at = new Date();
    invitation_expires_at.setHours(invitation_expires_at.getHours() + 24); // Hết hạn sau 24 giờ
    
    pendingUser.invitation_token = invitation_token;
    pendingUser.invitation_sent_at = new Date();
    pendingUser.invitation_expires_at = invitation_expires_at;
    
    await pendingUser.save();
    
    // Gửi email mời sử dụng sendEmail
    const invitationUrl = `${process.env.FRONTEND_URL}/invitation?token=${invitation_token}`;
    
    await sendEmail({
      email: pendingUser.email,
      subject: 'Lời mời tham gia hệ thống eTutoring',
      message: `
        Xin chào ${pendingUser.first_name} ${pendingUser.last_name},
        
        Bạn đã được mời tham gia hệ thống eTutoring với vai trò ${pendingUser.role}.
        
        Vui lòng truy cập liên kết sau để thiết lập mật khẩu và hoàn tất đăng ký:
        ${invitationUrl}
        
        Liên kết này sẽ hết hạn sau 24 giờ.
        
        Xin cảm ơn!
      `
    });
    
    res.status(200).json({ 
      message: 'Đã gửi lại lời mời thành công',
      pendingUser: {
        _id: pendingUser._id,
        email: pendingUser.email,
        role: pendingUser.role,
        invitation_expires_at: pendingUser.invitation_expires_at
      }
    });
  } catch (error) {
    console.error('Error resending invitation:', error);
    res.status(500).json({ error: error.message });
  }
};