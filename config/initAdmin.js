const User = require('../models/auth/user');
const bcrypt = require('bcryptjs');

const initAdmin = async () => {
  try {
    // Kiểm tra xem đã có admin nào chưa
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (!adminExists) {
      console.log('Khởi tạo tài khoản admin mặc định...');
      
      // Lấy thông tin admin từ biến môi trường
      const adminUsername = process.env.ADMIN_USERNAME;
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;
      const adminFirstName = process.env.ADMIN_FIRST_NAME;
      const adminLastName = process.env.ADMIN_LAST_NAME;
      
      // Hash mật khẩu
      const hashedPassword = await bcrypt.hash(adminPassword, 8);
      
      // Tạo admin mới
      const admin = new User({
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        first_name: adminFirstName,
        last_name: adminLastName,
        role: 'admin',
        isActive: true
      });
      
      // Lưu admin vào database
      await admin.save();
      console.log('Tài khoản admin mặc định đã được tạo thành công!');
      console.log(`Username: ${adminUsername}`);
      console.log(`Email: ${adminEmail}`);
      console.log(`Password: ${adminPassword}`);
    } else {
      console.log('Tài khoản admin đã tồn tại trong hệ thống.');
    }
  } catch (error) {
    console.error('Lỗi khi khởi tạo tài khoản admin:', error);
  }
};

module.exports = initAdmin;