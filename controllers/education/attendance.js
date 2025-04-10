const Attendance = require("../../models/education/attendance");
const ClassSchedule = require("../../models/education/classSchedule");
const Enrollment = require("../../models/education/enrollment");
const ClassTutor = require("../../models/education/classTutor");

const checkAttendancePermission = async (userId, userRole, classInfoId, schedule) => {
  // Admin and staff always have permission
  if (userRole === 'admin' || userRole === 'staff') {
    return {
      hasPermission: true
    };
  }

  // For tutors, check if they are assigned to the class
  if (userRole === 'tutor') {
    // Ensure classInfoId is valid
    if (!classInfoId) {
      return {
        hasPermission: false,
        message: 'Class info not found'
      };
    }
    
    // Make sure we're using the string representation if it's an ObjectId
    const classInfoIdStr = classInfoId.toString();

    const isTutor = await ClassTutor.findOne({
      classInfo_id: classInfoId,
      tutor_id: userId
    });

    if (!isTutor) {
      return {
        hasPermission: false,
        message: 'You are not a tutor of this class'
      };
    }

    const now = new Date();
    const scheduleStartTime = new Date(schedule.start_time);
    const attendanceDeadline = new Date(scheduleStartTime);
    attendanceDeadline.setDate(attendanceDeadline.getDate() + 1);

    if (now > attendanceDeadline) {
      return {
        hasPermission: false,
        message: 'Attendance deadline has passed (1 day after the class)'
      };
    }

    return {
      hasPermission: true
    };
  }

  return {
    hasPermission: false,
    message: 'User does not have permission to take attendance'
  };
};

// Tạo điểm danh mới
exports.createAttendance = async (req, res) => {
  try {
    const { class_schedule_id, student_id, status } = req.body;
    
    // Kiểm tra lịch học tồn tại
    const schedule = await ClassSchedule.findById(class_schedule_id)
      .populate('classInfo_id');
    if (!schedule) {
      return res.status(404).json({ error: 'Không tìm thấy lịch học' });
    }

    // Kiểm tra quyền điểm danh
    const permissionCheck = await checkAttendancePermission(
      req.user._id,
      req.user.role,
      schedule.classInfo_id._id,
      schedule
    );

    if (!permissionCheck.hasPermission) {
      return res.status(403).json({ error: permissionCheck.message });
    }
    
    // Kiểm tra sinh viên đã đăng ký lớp học chưa
    const enrollment = await Enrollment.findOne({ 
      classInfo_id: schedule.classInfo_id._id,
      student_id: student_id
    });
    
    if (!enrollment) {
      return res.status(400).json({ error: 'Sinh viên chưa đăng ký lớp học này' });
    }
    
    // Kiểm tra đã có điểm danh chưa
    const existingAttendance = await Attendance.findOne({
      class_schedule_id,
      student_id
    });
    
    if (existingAttendance) {
      return res.status(400).json({ error: 'Sinh viên đã được điểm danh cho buổi học này' });
    }
    
    const attendance = new Attendance({
      class_schedule_id,
      student_id,
      status: status || 'absent',
      created_by: req.user._id
    });
    
    await attendance.save();
    
    // Populate thông tin chi tiết
    await attendance.populate([
      {
        path: 'student_id',
        populate: {
          path: "user_id",
          select: "-password",
        },
      },
      {
        path: "created_by",
        select: "-password",
      },
    ]);

    res.status(201).json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách điểm danh của buổi học
exports.getAttendanceBySchedule = async (req, res) => {
  try {
    const { schedule_id } = req.params;
    
    const attendances = await Attendance.find({ class_schedule_id: schedule_id })
      .populate({
        path: 'student_id',
        populate: { 
          path: "user_id",
          select: "-password",
        },
      })
      .populate("created_by", "-password");

    res.status(200).json(attendances);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy lịch sử điểm danh của sinh viên trong lớp
exports.getStudentAttendance = async (req, res) => {
  try {
    const { class_id, student_id } = req.params;
    
    const schedules = await ClassSchedule.find({ 
      classInfo_id: class_id,
      status: "completed"
    });
    
    const attendances = await Attendance.find({
      class_schedule_id: { $in: schedules.map(s => s._id) },
      student_id: student_id
    }).populate([
      {
        path: "class_schedule_id",
        select: "start_time end_time status"
      },
      {
        path: "created_by",
        select: "first_name last_name"
      }
    ]);

    // Thống kê chi tiết
    const stats = {
      totalSchedules: schedules.length, // Tổng số buổi học
      absentCount: attendances.filter(a => a.status === 'absent').length, // Số buổi vắng
      presentCount: attendances.filter(a => a.status === 'present').length, // Số buổi có mặt
      lateCount: attendances.filter(a => a.status === 'late').length, // Số buổi đi trễ
      notRecordedCount: schedules.length - attendances.length, // Số buổi chưa điểm danh
      absentRate: schedules.length > 0 
        ? Math.round(((attendances.filter(a => a.status === 'absent').length + (schedules.length - attendances.length)) / schedules.length) * 100)
        : 0 // Tỷ lệ vắng mặt (tính cả buổi chưa điểm danh là vắng)
    };
    
    res.status(200).json({
      attendances,
      stats
    });
  } catch (error) {
    console.error("Error in getStudentAttendance:", error);
    res.status(500).json({ error: error.message });
  }
};

// Cập nhật điểm danh
exports.updateAttendance = async (req, res) => {
  try {
    const { status } = req.body;
    
    // Tìm điểm danh và populate thông tin lịch học
    const attendance = await Attendance.findById(req.params.id)
      .populate({
        path: 'class_schedule_id',
        populate: 'classInfo_id'
      });
    
    if (!attendance) {
      return res.status(404).json({ error: 'Không tìm thấy điểm danh' });
    }

    // Kiểm tra quyền cập nhật điểm danh
    const permissionCheck = await checkAttendancePermission(
      req.user._id,
      req.user.role,
      attendance.class_schedule_id.classInfo_id._id,
      attendance.class_schedule_id
    );

    if (!permissionCheck.hasPermission) {
      return res.status(403).json({ error: permissionCheck.message });
    }
    
    // Cập nhật điểm danh
    attendance.status = status;
    attendance.created_by = req.user._id;
    await attendance.save();
    
    // Populate thông tin chi tiết
    await attendance.populate([
      {
        path: 'student_id',
        populate: {
          path: "user_id",
          select: "-password",
        },
      },
      {
        path: "created_by",
        select: "-password",
      },
    ]);

    res.status(200).json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Xóa điểm danh
exports.deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id)
      .populate({
        path: 'class_schedule_id',
        populate: 'classInfo_id'
      });
    
    if (!attendance) {
      return res.status(404).json({ error: 'Không tìm thấy điểm danh' });
    }

    // Kiểm tra quyền xóa điểm danh
    const permissionCheck = await checkAttendancePermission(
      req.user._id,
      req.user.role,
      attendance.class_schedule_id.classInfo_id._id,
      attendance.class_schedule_id
    );

    if (!permissionCheck.hasPermission) {
      return res.status(403).json({ error: permissionCheck.message });
    }
    
    await attendance.deleteOne();
    res.status(200).json({ message: 'Đã xóa điểm danh thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Điểm danh hàng loạt
exports.bulkAttendance = async (req, res) => {
  try {
    const { class_schedule_id, attendances, tutor_id } = req.body;
    
    // Check if schedule exists
    const schedule = await ClassSchedule.findById(class_schedule_id)
      .populate('classInfo_id');
    
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Make sure we have a valid classInfo_id
    if (!schedule.classInfo_id || (!schedule.classInfo_id._id && typeof schedule.classInfo_id !== 'string' && !schedule.classInfo_id.toString)) {
      return res.status(400).json({ error: 'Invalid class info in schedule' });
    }
    
    // Get the classInfo_id as an ObjectId or string
    const classInfoId = schedule.classInfo_id._id || schedule.classInfo_id;

    // Check attendance permission
    const permissionCheck = await checkAttendancePermission(
      tutor_id, // Use tutor_id from request instead of req.user._id
      req.user.role,
      classInfoId,
      schedule
    );

    if (!permissionCheck.hasPermission) {
      return res.status(403).json({ error: permissionCheck.message });
    }
    
    const results = [];
    const errors = [];
    
    // Process each student's attendance
    for (const item of attendances) {
      try {        
        // Check if student is enrolled in the class
        const enrollment = await Enrollment.findOne({ 
          classInfo_id: classInfoId,
          student_id: item.student_id
        });
        
        if (!enrollment) {
          errors.push({
            student_id: item.student_id,
            error: 'Student is not enrolled in this class'
          });
          continue;
        }

        // Create or update attendance
        const attendance = await Attendance.findOneAndUpdate(
          {
            class_schedule_id: class_schedule_id,
            student_id: item.student_id
          },
          {
            status: item.status,
            created_by: tutor_id // Use tutor_id from request
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true
          }
        );

        // Populate detailed information
        await attendance.populate([
          {
            path: 'student_id',
            populate: { 
              path: "user_id",
              select: "-password",
            },
          },
          {
            path: "created_by",
            select: "-password",
          },
        ]);
        
        results.push(attendance);
      } catch (error) {
        errors.push({
          student_id: item.student_id,
          error: error.message
        });
      }
    }
    
    res.status(200).json({
      success: results.length,
      errors,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};