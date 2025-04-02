const ClassInfo = require("../../models/education/classInfo");
const ClassTutor = require("../../models/education/classTutor");
const Enrollment = require("../../models/education/enrollment");
const Course = require("../../models/education/course");
const { calculateStatusClassInfo } = require("../../config/cron");

// Tạo lớp học mới
exports.createClass = async (req, res) => {
  try {
    const { course_id, code, name, max_students, start_date, end_date } =
      req.body;

    // Kiểm tra code đã tồn tại chưa
    const existingClass = await ClassInfo.findOne({ code });
    if (existingClass) {
      return res.status(400).json({ error: "Class code already exists" });
    }

    const course = await Course.findById(course_id);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const status = calculateStatusClassInfo(start_date, end_date);

    const classInfo = new ClassInfo({
      course_id,
      code: code.trim(),
      name: name.trim(),
      max_students,
      status,
      start_date,
      end_date,
    });

    await classInfo.save();
    await classInfo.populate("course_id", "name code");

    res.status(201).json(classInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách lớp học
exports.getAllClasses = async (req, res) => {
  try {
    const classes = await ClassInfo.find().populate("course_id", "name code");
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Lấy chi tiết lớp học
exports.getClassById = async (req, res) => {
  try {
    const classInfo = await ClassInfo.findById(req.params.id).populate(
      "course_id",
      "name code"
    );

    if (!classInfo) {
      return res.status(404).json({ error: "Class not found" });
    }

    // Lấy số lượng sinh viên đã đăng ký
    const enrollmentCount = await Enrollment.countDocuments({
      class_id: req.params.id,
    });

    // Lấy thông tin giảng viên của lớp
    const tutors = await ClassTutor.find({ class_id: req.params.id })
      .populate("tutor_id", "tutor_code")
      .populate({
        path: "tutor_id",
        populate: {
          path: "user_id",
          select: "first_name last_name email",
        },
      });

    const result = {
      ...classInfo.toObject(),
      enrollment_count: enrollmentCount,
      tutors,
    };

    res.status(200).json(result);
  } catch (error) {
    console.error("Error getting class:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Cập nhật lớp học
exports.updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Kiểm tra code trùng nếu có cập nhật code
    if (updateData.code) {
      const existingClass = await ClassInfo.findOne({
        code: updateData.code.trim(),
        _id: { $ne: id },
      });
      if (existingClass) {
        return res.status(400).json({ error: "Class code already exists" });
      }
      updateData.code = updateData.code.trim();
    }

    // Kiểm tra course tồn tại nếu có cập nhật course
    if (updateData.course_id) {
      const course = await Course.findById(updateData.course_id);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
    }

    // Tính toán lại status nếu có cập nhật dates
    if (updateData.start_date || updateData.end_date) {
      const classInfo = await ClassInfo.findById(id);
      const start_date = updateData.start_date || classInfo.start_date;
      const end_date = updateData.end_date || classInfo.end_date;
      updateData.status = calculateStatusClassInfo(start_date, end_date);
    }

    const classInfo = await ClassInfo.findById(id);
    if (!classInfo) {
      return res.status(404).json({ error: "Class not found" });
    }
    classInfo.set(updateData);
    await classInfo.save();
    res.status(200).json(classInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Xóa lớp học
exports.deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    const classInfo = await ClassInfo.findById(id);

    if (!classInfo) {
      return res.status(404).json({ error: "Class not found" });
    }

    await classInfo.deleteOne();
    res.status(200).json({ message: "Class deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
