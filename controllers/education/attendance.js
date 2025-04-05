const Attendance = require("../../models/education/attendance");
const ClassSchedule = require("../../models/education/classSchedule");
const Enrollment = require("../../models/education/enrollment");
const ClassTutor = require("../../models/education/classTutor");

const checkAttendancePermission = async (userId, userRole, classInfoId, schedule) => {
  // Admin và staff luôn có quyền
  if (userRole === 'admin' || userRole === 'staff') {
    return {
      hasPermission: true
    };
  }

  // Nếu là giảng viên, kiểm tra xem có phải giảng viên của lớp không
  if (userRole === 'tutor') {
    const isTutor = await ClassTutor.findOne({
      classInfo_id: classInfoId,
      tutor_id: userId
    });

    if (!isTutor) {
      return {
        hasPermission: false,
        message: 'Bạn không phải là giảng viên của lớp học này'
      };
    }

    const now = new Date();
    const scheduleStartTime = new Date(schedule.start_time);
    const attendanceDeadline = new Date(scheduleStartTime);
    attendanceDeadline.setDate(attendanceDeadline.getDate() + 1);

    if (now > attendanceDeadline) {
      return {
        hasPermission: false,
        message: 'Đã quá thời hạn điểm danh (1 ngày sau buổi học)'
      };
    }

    return {
      hasPermission: true
    };
  }

  return {
    hasPermission: false,
    message: 'Bạn không có quyền điểm danh'
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
    
    // Lấy tất cả lịch học của lớp
    const schedules = await ClassSchedule.find({ classInfo_id: class_id });
    const scheduleIds = schedules.map(s => s._id);
    
    // Lấy điểm danh của sinh viên
    const attendances = await Attendance.find({
      class_schedule_id: { $in: scheduleIds },
      student_id
    })
      .populate("class_schedule_id")
      .populate("created_by", "-password");

    // Thống kê
    const stats = {
      total: schedules.length,
      present: attendances.filter(a => a.status === 'present').length,
      absent: attendances.filter(a => a.status === 'absent').length,
      late: attendances.filter(a => a.status === 'late').length,
      not_recorded: schedules.length - attendances.length
    };
    
    res.status(200).json({
      attendances,
      stats
    });
  } catch (error) {
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
    const { class_schedule_id, attendances } = req.body;
    console.log('Processing bulk attendance:', {
      attendancesCount: attendances?.length,
      class_schedule_id
    });
    
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
    
    const results = [];
    const errors = [];
    
    // Xử lý từng sinh viên
    for (const item of attendances) {
      try {
        console.log('Processing attendance for student:', item.student_id);
        
        // Kiểm tra sinh viên đã đăng ký lớp học chưa
        const enrollment = await Enrollment.findOne({ 
          classInfo_id: schedule.classInfo_id._id,
          student_id: item.student_id
        });
        
        if (!enrollment) {
          console.log('Student not enrolled:', item.student_id);
          errors.push({
            student_id: item.student_id,
            error: 'Sinh viên chưa đăng ký lớp học này'
          });
          continue;
        }

        // Tạo hoặc cập nhật điểm danh
        const attendance = await Attendance.findOneAndUpdate(
          {
            class_schedule_id: class_schedule_id,
            student_id: item.student_id
          },
          {
            status: item.status,
            created_by: req.user._id
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true
          }
        );

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
        
        results.push(attendance);
        console.log('Successfully processed attendance for student:', item.student_id);
      } catch (error) {
        console.error('Error processing student:', item.student_id, error);
        errors.push({
          student_id: item.student_id,
          error: error.message
        });
      }
    }
    
    console.log(`Processed ${attendances.length} attendances:`, {
      success: results.length,
      errors: errors.length
    });
    
    res.status(200).json({
      success: results.length,
      errors,
      results
    });
  } catch (error) {
    console.error('Bulk attendance error:', error);
    res.status(500).json({ error: error.message });
  }
};