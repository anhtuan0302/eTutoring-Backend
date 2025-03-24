const Student = require('../../models/organization/student');
const Tutor = require('../../models/organization/tutor');
const Staff = require('../../models/organization/staff');
const Department = require('../../models/organization/department');
const User = require('../../models/auth/user');

// Lấy danh sách tất cả sinh viên
exports.getAllStudents = async (req, res) => {
    try {
        const students = await Student.find();
        res.status(200).json(students);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Tạo sinh viên mới
exports.createStudent = async (req, res) => {
    try {
        const { user_id, student_code, department_id } = req.body;

        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).json({ error: 'Người dùng không tồn tại' });
        }

        const department = await Department.findById(department_id);
        if (!department) {
            return res.status(404).json({ error: 'Phòng ban không tồn tại' });
        }

        const existingStudent = await Student.findOne({ student_code });
        if (existingStudent) {
            return res.status(400).json({ error: 'Mã sinh viên đã tồn tại' });
        }

        const existingTutor = await Tutor.findOne({ user_id: user_id });
        if (existingTutor) {
            return res.status(400).json({ error: 'Tài khoản đã được đăng ký làm giáo viên. Một người dùng chỉ có thể làm một vai trò duy nhất trong hệ thống.' });
        }

        const existingStaff = await Staff.findOne({ user_id: user_id });
        if (existingStaff) {
            return res.status(400).json({ error: 'Tài khoản đã được đăng ký làm nhân viên. Một người dùng chỉ có thể làm một vai trò duy nhất trong hệ thống.' });
        }

        const userAlreadyStudent = await Student.findOne({ user_id: user_id });
        if (userAlreadyStudent) {
            return res.status(400).json({ error: 'Tài khoản đã được đăng ký làm sinh viên. Một người dùng chỉ có thể làm một vai trò duy nhất trong hệ thống.' });
        }

        if (user.role === 'admin') {
            return res.status(403).send({ 
                error: 'Người dùng có vai trò admin không thể đăng ký làm sinh viên.' 
              });
        }

        const student = new Student({ user_id: user._id, student_code, department_id: department._id });
        await student.save();
        
        if (user.role !== 'student') {
            user.role = 'student';
            await user.save();
        }

        res.status(201).json({ message: 'Tạo sinh viên thành công' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Cập nhật sinh viên
exports.updateStudent = async (req, res) => {
    try {
        const { id } = req.params;
        
        const student = await Student.findById(id);
        if (!student) {
            return res.status(404).json({ error: 'Sinh viên không tồn tại' });
        }
        student.set(req.body);
        await student.save();
        res.status(200).json({ message: 'Cập nhật sinh viên thành công' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Xóa sinh viên
exports.deleteStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const student = await Student.findById(id);
        if (!student) {
            return res.status(404).json({ error: 'Sinh viên không tồn tại' });
        }
        await student.deleteOne();
        res.status(200).json({ message: 'Xóa sinh viên thành công' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Lấy thông tin sinh viên theo ID
exports.getStudentById = async (req, res) => {
    try {
        const { id } = req.params;
        const student = await Student.findById(id);
        if (!student) {
            return res.status(404).json({ error: 'Sinh viên không tồn tại' });
        }
        res.status(200).json(student);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};