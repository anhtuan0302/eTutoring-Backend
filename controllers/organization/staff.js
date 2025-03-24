const Staff = require('../../models/organization/staff');
const Student = require('../../models/organization/student');
const Tutor = require('../../models/organization/tutor');
const Department = require('../../models/organization/department');
const User = require('../../models/auth/user');


// Lấy danh sách tất cả nhân viên
exports.getAllStaff = async (req, res) => {
    try {
        const staff = await Staff.find();
        res.status(200).json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Tạo nhân viên mới
exports.createStaff = async (req, res) => {
    try {
        const { user_id, staff_code, department_id } = req.body;

        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).json({ error: 'Người dùng không tồn tại' });
        }

        const department = await Department.findById(department_id);
        if (!department) {
            return res.status(404).json({ error: 'Phòng ban không tồn tại' });
        }

        const existingStaff = await Staff.findOne({ staff_code });
        if (existingStaff) {
            return res.status(400).json({ error: 'Mã nhân viên đã tồn tại' });
        }

        const existingTutor = await Tutor.findOne({ user_id: user_id });
        if (existingTutor) {
            return res.status(400).json({ error: 'Tài khoản đã được đăng ký làm giáo viên. Một người dùng chỉ có thể làm một vai trò duy nhất trong hệ thống.' });
        }

        const existingStudent = await Student.findOne({ user_id: user_id });
        if (existingStudent) {
            return res.status(400).json({ error: 'Tài khoản đã được đăng ký làm sinh viên. Một người dùng chỉ có thể làm một vai trò duy nhất trong hệ thống.' });
        }
        
        const userAlreadyStaff = await Staff.findOne({ user_id: user_id });
        if (userAlreadyStaff) {
            return res.status(400).json({ error: 'Tài khoản đã được đăng ký làm nhân viên. Một người dùng chỉ có thể làm một vai trò duy nhất trong hệ thống.' });
        }

        if (user.role === 'admin') {
            return res.status(403).send({ 
                error: 'Người dùng có vai trò admin không thể đăng ký làm nhân viên.' 
              });
        }

        const staff = new Staff({ user_id: user._id, staff_code, department_id: department._id });
        await staff.save();

        if (user.role !== 'staff') {
            user.role = 'staff';
            await user.save();
        }

        res.status(201).json({ message: 'Tạo nhân viên thành công' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Cập nhật nhân viên
exports.updateStaff = async (req, res) => {
    try {
        const { id } = req.params;

        const staff = await Staff.findById(id);
        if (!staff) {
            return res.status(404).json({ error: 'Nhân viên không tồn tại' });
        }
        staff.set(req.body);
        await staff.save();
        res.status(200).json({ message: 'Cập nhật nhân viên thành công' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Xóa nhân viên
exports.deleteStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const staff = await Staff.findById(id);
        if (!staff) {
            return res.status(404).json({ error: 'Nhân viên không tồn tại' });
        }
        await staff.deleteOne();
        res.status(200).json({ message: 'Xóa nhân viên thành công' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Lấy thông tin nhân viên theo ID
exports.getStaffById = async (req, res) => {
    try {
        const { id } = req.params;
        const staff = await Staff.findById(id);
        if (!staff) {
            return res.status(404).json({ error: 'Nhân viên không tồn tại' });
        }
        res.status(200).json(staff);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};


