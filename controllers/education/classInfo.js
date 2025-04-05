const ClassInfo = require("../../models/education/classInfo");
const ClassTutor = require("../../models/education/classTutor");
const Enrollment = require("../../models/education/enrollment");
const Course = require("../../models/education/course");
const ClassSchedule = require("../../models/education/classSchedule");
const ClassContent = require("../../models/education/classContent");
const { calculateStatusClassInfo } = require("../../config/cron");

// Tạo lớp học mới
exports.createClass = async (req, res) => {
  try {
    const { course_id, code, max_students, start_date, end_date } = req.body;

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
      max_students,
      status,
      start_date,
      end_date,
    });

    await classInfo.save();
    await classInfo.populate("course_id", "code");

    res.status(201).json(classInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách lớp học
exports.getAllClasses = async (req, res) => {
  try {
    const classes = await ClassInfo.find().populate({
      path: "course_id",
      select: "code name department_id",
      populate: {
        path: "department_id",
        select: "name",
      },
    }).sort({ start_date: -1 });
    // Lấy thông tin số lượng sinh viên và tutors cho mỗi lớp
    const classesWithDetails = await Promise.all(
      classes.map(async (classInfo) => {
        // Đếm số lượng sinh viên
        const enrollmentCount = await Enrollment.countDocuments({
          classInfo_id: classInfo._id,
        });
        // Đếm số lượng tutors
        const tutorCount = await ClassTutor.countDocuments({
          classInfo_id: classInfo._id,
        });
        // Đếm số lượng giảng viên chính
        const primaryTutorCount = await ClassTutor.countDocuments({
          classInfo_id: classInfo._id,
          is_primary: true,
        });
        // Lấy danh sách tutors
        const tutors = await ClassTutor.find({
          classInfo_id: classInfo._id,
        }).populate({
          path: "tutor_id",
          select: "tutor_code",
          populate: {
            path: "user_id",
            select: "first_name last_name email phone_number",
          },
        });

        return {
          ...classInfo.toObject(),
          current_students: enrollmentCount,
          tutors: tutors,
          current_tutors: tutorCount,
          current_primary_tutors: primaryTutorCount,
        };
      })
    );

    res.status(200).json(classesWithDetails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy chi tiết lớp học
exports.getClassById = async (req, res) => {
  try {
    const classInfo = await ClassInfo.findById(req.params.id).populate({
      path: "course_id",
      select: "code name department_id",
      populate: {
        path: "department_id",
        select: "name",
      },
    });

    if (!classInfo) {
      return res.status(404).json({ error: "Class not found" });
    }

    // Lấy danh sách sinh viên đã đăng ký
    const enrollments = await Enrollment.find({ classInfo_id: req.params.id })
      .populate({
        path: "student_id",
        select: "student_code",
        populate: {
          path: "user_id",
          select: "-password",
        },
      })
      .sort({ createdAt: -1 });

    // Lấy thông tin giảng viên của lớp
    const tutors = await ClassTutor.find({ classInfo_id: req.params.id })
      .populate({
        path: "tutor_id",
        select: "tutor_code",
        populate: {
          path: "user_id",
          select: "-password",
        },
      })
      .select("is_primary");

    // Lấy danh sách lịch học của lớp
    const schedules = await ClassSchedule.find({ classInfo_id: req.params.id })
    .select({
      start_time: 1,
      end_time: 1,
      is_online: 1,
      online_link: 1,
      location: 1,
      status: 1,
    })
    .sort({ start_time: 1 });

    // Lấy danh sách nội dung của lớp
    const contents = await ClassContent.find({ classInfo_id: req.params.id })
    .select({
      title: 1,
      description: 1,
      content_type: 1,
      duedate: 1,
      attachments: {
        file_name: 1,
        file_path: 1,
        file_type: 1,
        file_size: 1,
      },
      createdAt: 1,
      updatedAt: 1,
    })
    .sort({ createdAt: -1 });

    const result = {
      ...classInfo.toObject(),
      enrollments,
      tutors,
      schedules,
      contents
    };

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
