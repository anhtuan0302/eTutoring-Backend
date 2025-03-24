const Department = require('../../models/organization/department');

// Lấy danh sách tất cả phòng ban
exports.getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find();
    res.status(200).json(departments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Tạo phòng ban mới
exports.createDepartment = async (req, res) => {
    try {
        const { name, description } = req.body;
        const existingDepartment = await Department.findOne({ name });
        if (existingDepartment) {
            return res.status(400).json({ error: 'Phòng ban đã tồn tại' });
        }
        await new Department({ name, description }).save();
        res.status(201).json({ message: 'Phòng ban đã được tạo thành công' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Cập nhật phòng ban
exports.updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Tìm department
        const department = await Department.findById(id);
        if (!department) {
            return res.status(404).json({ error: 'Phòng ban không tồn tại' });
        }
        
        // Áp dụng tất cả các cập nhật 
        department.set(req.body);
        
        // Mongoose sẽ tự động lọc các fields không có trong schema
        await department.save();
        
        res.status(200).json({ 
            message: 'Phòng ban đã được cập nhật thành công',
            department
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Xóa phòng ban
exports.deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const department = await Department.findById(id);
        if (!department) {
            return res.status(404).json({ error: 'Phòng ban không tồn tại' });
        }
        await department.deleteOne();
        res.status(200).json({ message: 'Phòng ban đã được xóa thành công' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Lấy thông tin phòng ban
exports.getDepartmentById = async (req, res) => {
    try {
        const { id } = req.params;
        const department = await Department.findById(id);
        if (!department) {
            return res.status(404).json({ error: 'Phòng ban không tồn tại' });
        }
        res.status(200).json(department);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};