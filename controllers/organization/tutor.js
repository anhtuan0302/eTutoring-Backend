const Tutor = require('../../models/organization/tutor');
const Student = require('../../models/organization/student');
const Staff = require('../../models/organization/staff');
const Department = require('../../models/organization/department');
const User = require('../../models/auth/user');


// Lấy danh sách tất cả giáo viên
exports.getAllTutors = async (req, res) => {
    try {
        const tutors = await Tutor.find();
        res.status(200).json(tutors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Tạo giáo viên mới
exports.createTutor = async (req, res) => {
    try {
        const { user_id, tutor_code, department_id } = req.body;

        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).json({ error: 'Người dùng không tồn tại' });
        }

        const department = await Department.findById(department_id);
        if (!department) {
            return res.status(404).json({ error: 'Phòng ban không tồn tại' });
        }

        const existingTutor = await Tutor.findOne({ tutor_code });
        if (existingTutor) {
            return res.status(400).json({ error: 'Mã giáo viên đã tồn tại' });
        }

        const existingStudent = await Student.findOne({ user_id: user_id });
        if (existingStudent) {
            return res.status(400).json({ error: 'Tài khoản đã được đăng ký làm sinh viên. Một người dùng chỉ có thể làm một vai trò duy nhất trong hệ thống.' });
        }

        const existingStaff = await Staff.findOne({ user_id: user_id });
        if (existingStaff) {
            return res.status(400).json({ error: 'Tài khoản đã được đăng ký làm nhân viên. Một người dùng chỉ có thể làm một vai trò duy nhất trong hệ thống.' });
        }

        const userAlreadyTutor = await Tutor.findOne({ user_id: user_id });
        if (userAlreadyTutor) {
            return res.status(400).json({ error: 'Tài khoản đã được đăng ký làm giáo viên. Một người dùng chỉ có thể làm một vai trò duy nhất trong hệ thống.' });
        }

        if (user.role === 'admin') {
            return res.status(403).send({ 
                error: 'Người dùng có vai trò admin không thể đăng ký làm giáo viên.' 
              });
        }

        const tutor = new Tutor({ user_id: user._id, tutor_code, department_id: department._id });
        await tutor.save();

        if (user.role !== 'tutor') {
            user.role = 'tutor';
            await user.save();
        }

        res.status(201).json({ message: 'Tạo giáo viên thành công' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Cập nhật giáo viên
exports.updateTutor = async (req, res) => {
    try {
        const { id } = req.params;
        
        const tutor = await Tutor.findById(id);
        if (!tutor) {
            return res.status(404).json({ error: 'Giáo viên không tồn tại' });
        }
        tutor.set(req.body);
        await tutor.save();
        res.status(200).json({ message: 'Cập nhật giáo viên thành công' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Xóa giáo viên
exports.deleteTutor = async (req, res) => {
    try {
        const { id } = req.params;
        const tutor = await Tutor.findById(id);
        if (!tutor) {
            return res.status(404).json({ error: 'Giáo viên không tồn tại' });
        }
        await tutor.deleteOne();
        res.status(200).json({ message: 'Xóa giáo viên thành công' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Lấy thông tin giáo viên theo ID
exports.getTutorById = async (req, res) => {
    try {
        const { id } = req.params;
        const tutor = await Tutor.findById(id);
        if (!tutor) {
            return res.status(404).json({ error: 'Giáo viên không tồn tại' });
        }
        res.status(200).json(tutor);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};





