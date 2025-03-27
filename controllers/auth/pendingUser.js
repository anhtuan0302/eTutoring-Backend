const PendingUser = require('../../models/auth/pendingUser');
const User = require('../../models/auth/user');
const Student = require('../../models/organization/student');
const Tutor = require('../../models/organization/tutor');
const Staff = require('../../models/organization/staff');
const Department = require('../../models/organization/department');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const sendEmail = require('../../config/email');

// Hàm tạo mã ngẫu nhiên cho student/staff/tutor
const generateRandomCode = (prefix, length = 6) => {
  const randomNumbers = Math.floor(Math.random() * Math.pow(10, length))
    .toString()
    .padStart(length, '0');
  return `${prefix}${randomNumbers}`;
};

// Tạo mã duy nhất cho các loại người dùng
const generateUniqueCode = async (role) => {
  let isUnique = false;
  let code;
  let Model;
  let prefix;

  switch (role) {
    case 'student':
      Model = Student;
      prefix = 'ST';
      break;
    case 'tutor':
      Model = Tutor;
      prefix = 'TU';
      break;
    case 'staff':
      Model = Staff;
      prefix = 'SF';
      break;
    default:
      throw new Error('Vai trò không hợp lệ');
  }

  while (!isUnique) {
    code = generateRandomCode(prefix);
    const existing = await Model.findOne({ [`${role}_code`]: code });
    if (!existing) {
      isUnique = true;
    }
  }

  return code;
};

// Tạo lời mời người dùng mới
exports.createPendingUser = async (req, res) => {
  try {
    const { role, first_name, last_name, email, phone_number, department_id } = req.body;

    // Xác thực dữ liệu đầu vào
    if (!role || !first_name || !last_name || !email || !department_id) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
    }

    // Kiểm tra department tồn tại
    const department = await Department.findById(department_id);
    if (!department) {
      return res.status(400).json({ error: 'Phòng/Khoa không tồn tại' });
    }

    // Kiểm tra email có tồn tại trong hệ thống chưa
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email đã tồn tại trong hệ thống' });
    }

    // Kiểm tra điện thoại nếu có
    if (phone_number) {
      const existingPhone = await User.findOne({ phone_number });
      if (existingPhone) {
        return res.status(400).json({ error: 'Số điện thoại đã tồn tại trong hệ thống' });
      }
    }

    // Kiểm tra role hợp lệ
    const validRoles = ['student', 'tutor', 'staff', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Vai trò không hợp lệ' });
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
      phone_number,
      department_id,
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
    }).populate('department_id', 'name');

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
        department: pendingUser.department_id,
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

    // Kiểm tra mật khẩu
    if (password !== confirm_password) {
      return res.status(400).json({ error: 'Mật khẩu xác nhận không khớp' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    // Tìm người dùng đang chờ xử lý
    const pendingUser = await PendingUser.findOne({
      invitation_token: token,
      invitation_expires_at: { $gt: new Date() }
    });

    if (!pendingUser) {
      return res.status(400).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Tạo username
    const baseUsername = `${pendingUser.first_name.toLowerCase()}.${pendingUser.last_name.toLowerCase()}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "");
    
    let username = baseUsername;
    let usernameSuffix = 1;
    
    while (await User.findOne({ username })) {
      username = `${baseUsername}${usernameSuffix}`;
      usernameSuffix++;
    }

    // Tạo user mới
    const newUser = new User({
      role: pendingUser.role,
      first_name: pendingUser.first_name,
      last_name: pendingUser.last_name,
      username,
      email: pendingUser.email,
      password: hashedPassword,
      phone_number: pendingUser.phone_number
    });

    await newUser.save();

    // Tạo profile theo role
    switch (pendingUser.role) {
      case 'student': {
        const student = new Student({
          user_id: newUser._id,
          student_code: await generateUniqueCode('student'),
          department_id: pendingUser.department_id
        });
        await student.save();
        break;
      }
      case 'tutor': {
        const tutor = new Tutor({
          user_id: newUser._id,
          tutor_code: await generateUniqueCode('tutor'),
          department_id: pendingUser.department_id
        });
        await tutor.save();
        break;
      }
      case 'staff': {
        const staff = new Staff({
          user_id: newUser._id,
          staff_code: await generateUniqueCode('staff'),
          department_id: pendingUser.department_id
        });
        await staff.save();
        break;
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
        role: newUser.role
      }
    });
  } catch (error) {
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