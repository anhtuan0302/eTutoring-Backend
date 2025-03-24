const Attendance = require('../../models/education/attendance');
const ClassSchedule = require('../../models/education/classSchedule');
const Enrollment = require('../../models/education/enrollment');

// Tạo điểm danh mới
exports.createAttendance = async (req, res) => {
  try {
    const { class_schedule_id, student_id, status, note } = req.body;
    
    // Kiểm tra lịch học tồn tại
    const schedule = await ClassSchedule.findById(class_schedule_id);
    if (!schedule) {
      return res.status(404).json({ error: 'Không tìm thấy lịch học' });
    }
    
    // Kiểm tra sinh viên đã đăng ký lớp học chưa
    const enrollment = await Enrollment.findOne({ 
      class_id: schedule.class_id,
      student_id
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
      note,
      created_by: req.user._id
    });
    
    await attendance.save();
    
    // Thông báo realtime
    if (req.io) {
      req.io.to(`class:${schedule.class_id}`).emit('attendance:created', {
        attendance_id: attendance._id,
        student_id,
        status: attendance.status
      });
    }
    
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
      .populate('student_id', 'user_id')
      .populate({
        path: 'student_id',
        populate: { path: 'user_id', select: 'first_name last_name' }
      })
      .populate('created_by', 'username first_name last_name');
      
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
    const schedules = await ClassSchedule.find({ class_id });
    const scheduleIds = schedules.map(s => s._id);
    
    // Lấy điểm danh của sinh viên
    const attendances = await Attendance.find({
      class_schedule_id: { $in: scheduleIds },
      student_id
    }).populate('class_schedule_id');
    
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
    const { status, note } = req.body;
    
    const attendance = await Attendance.findByIdAndUpdate(
      req.params.id,
      { 
        status, 
        note,
        created_by: req.user._id
      },
      { new: true }
    );
    
    if (!attendance) {
      return res.status(404).json({ error: 'Không tìm thấy điểm danh' });
    }
    
    // Thông báo realtime
    if (req.io) {
      const schedule = await ClassSchedule.findById(attendance.class_schedule_id);
      req.io.to(`class:${schedule.class_id}`).emit('attendance:updated', {
        attendance_id: attendance._id,
        student_id: attendance.student_id,
        status: attendance.status
      });
    }
    
    res.status(200).json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Xóa điểm danh
exports.deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findByIdAndDelete(req.params.id);
    
    if (!attendance) {
      return res.status(404).json({ error: 'Không tìm thấy điểm danh' });
    }
    
    // Thông báo realtime
    if (req.io) {
      const schedule = await ClassSchedule.findById(attendance.class_schedule_id);
      req.io.to(`class:${schedule.class_id}`).emit('attendance:deleted', {
        attendance_id: attendance._id,
        student_id: attendance.student_id
      });
    }
    
    res.status(200).json({ message: 'Đã xóa điểm danh thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Điểm danh hàng loạt
exports.bulkAttendance = async (req, res) => {
  try {
    const { class_schedule_id, attendances } = req.body;
    
    // Kiểm tra lịch học tồn tại
    const schedule = await ClassSchedule.findById(class_schedule_id);
    if (!schedule) {
      return res.status(404).json({ error: 'Không tìm thấy lịch học' });
    }
    
    const results = [];
    const errors = [];
    
    // Xử lý từng sinh viên
    for (const item of attendances) {
      try {
        // Kiểm tra sinh viên đã đăng ký lớp học chưa
        const enrollment = await Enrollment.findOne({ 
          class_id: schedule.class_id,
          student_id: item.student_id
        });
        
        if (!enrollment) {
          errors.push({
            student_id: item.student_id,
            error: 'Sinh viên chưa đăng ký lớp học này'
          });
          continue;
        }
        
        // Cập nhật hoặc tạo mới điểm danh
        const existingAttendance = await Attendance.findOne({
          class_schedule_id,
          student_id: item.student_id
        });
        
        if (existingAttendance) {
          existingAttendance.status = item.status;
          existingAttendance.note = item.note;
          existingAttendance.created_by = req.user._id;
          await existingAttendance.save();
          results.push(existingAttendance);
        } else {
          const newAttendance = new Attendance({
            class_schedule_id,
            student_id: item.student_id,
            status: item.status,
            note: item.note,
            created_by: req.user._id
          });
          await newAttendance.save();
          results.push(newAttendance);
        }
      } catch (error) {
        errors.push({
          student_id: item.student_id,
          error: error.message
        });
      }
    }
    
    // Thông báo realtime về cập nhật điểm danh
    if (req.io) {
      req.io.to(`class:${schedule.class_id}`).emit('attendance:bulk_updated', {
        class_schedule_id,
        count: results.length
      });
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