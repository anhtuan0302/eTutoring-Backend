const ClassSchedule = require('../../models/education/classSchedule');
const ClassInfo = require('../../models/education/classInfo');

// Tạo lịch học mới
exports.createSchedule = async (req, res) => {
  try {
    const {
      classInfo_id, start_time, end_time,
      is_online, online_link, location,
    } = req.body;
    
    // Kiểm tra lớp học tồn tại
    const classInfo = await ClassInfo.findById(classInfo_id)
      .populate({
        path: 'course_id',
        populate: {
          path: 'department_id',
          select: 'name'
        }
      });

    if (!classInfo) {
      return res.status(404).json({ error: 'Không tìm thấy lớp học' });
    }

    const startDateTime = new Date(start_time);
    const endDateTime = new Date(end_time);
    const currentDateTime = new Date();
    const classStartDate = new Date(classInfo.start_date);
    const classEndDate = new Date(classInfo.end_date);

    if (startDateTime <= currentDateTime) {
      return res.status(400).json({ 
        error: 'Không thể tạo lịch học trong quá khứ. Thời gian bắt đầu phải sau thời điểm hiện tại' 
      });
    }
    
    // Kiểm tra thời gian bắt đầu và kết thúc
    if (startDateTime >= endDateTime) {
      return res.status(400).json({ error: 'Thời gian kết thúc phải sau thời gian bắt đầu' });
    }

    if (startDateTime < classStartDate || endDateTime > classEndDate) {
      return res.status(400).json({ 
        error: 'Thời gian lịch học phải nằm trong khoảng thời gian của lớp học' 
      });
    }

    const conflictSchedule = await ClassSchedule.findOne({
      classInfo_id,
      $or: [
        {
          start_time: { $lt: endDateTime },
          end_time: { $gt: startDateTime }
        }
      ]
    });

    if (conflictSchedule) {
      return res.status(400).json({ error: 'Đã có lịch học trong khoảng thời gian này' });
    }
    
    const classSchedule = new ClassSchedule({
      classInfo_id,
      start_time: startDateTime,
      end_time: endDateTime,
      is_online,
      online_link,
      location,
      status: 'scheduled',
    });
    
    await classSchedule.save();
    
    const populatedClassSchedule = await ClassSchedule.findById(classSchedule._id)
    .populate({
      path: 'classInfo_id',
      select: 'code',
      populate: {
        path: 'course_id',
        select: 'name code',
        populate: {
          path: 'department_id',
          select: 'name'
        }
      }
    });

    res.status(201).json(populatedClassSchedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách tất cả lịch học
exports.getAllSchedules = async (req, res) => {
  try {
    const schedules = await ClassSchedule.find()
    .populate({
      path: 'classInfo_id',
      select: 'code',
      populate: {
        path: 'course_id',
        select: 'name code',
        populate: {
          path: 'department_id',
          select: 'name'
        }
      }
    })
    .sort({ start_time: 1 });

    res.status(200).json(schedules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy thông tin một lịch học
exports.getScheduleById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const schedule = await ClassSchedule.findById(id)
      .populate({
        path: 'classInfo_id',
        populate: {
          path: 'course_id',
          select: 'name code'
        }
      });

    if (!schedule) {
      return res.status(404).json({ error: 'Không tìm thấy lịch học' });
    }

    console.log('Found schedule:', schedule);
    res.status(200).json(schedule);
  } catch (error) {
    console.error('Error in getScheduleById:', error);
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách lịch học
exports.getSchedulesByClass = async (req, res) => {
  try {
    const { classInfo_id } = req.params;
    
    const filter = { classInfo_id };
    
    const schedules = await ClassSchedule.find(filter)
      .populate({
        path: 'classInfo_id',
        populate: [
          { path: 'course_id', select: 'name code' },
          { path: 'enrollment_id', populate: { path: 'student_id', select: 'student_code user_id', populate: { path: 'user_id', select: '-password' } } },
          { path: 'tutor_id', select: 'tutor_code', populate: { path: 'user_id', select: '-password' } }
        ]
      })
      .sort({ start_time: 1 });
    res.status(200).json(schedules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cập nhật lịch học
exports.updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      start_time, end_time,
      is_online, online_link, location, status
    } = req.body;

    const schedule = await ClassSchedule.findById(id);
    if (!schedule) {
      return res.status(404).json({ error: 'Không tìm thấy lịch học' });
    }

    const classInfo = await ClassInfo.findById(schedule.classInfo_id);
    if (!classInfo) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin lớp học' });
    }

    let updateData = {
      is_online,
      online_link,
      location,
      status
    };

    // Kiểm tra thời gian nếu có cập nhật
    if (start_time || end_time) {
      const newStartTime = start_time ? new Date(start_time) : schedule.start_time;
      const newEndTime = end_time ? new Date(end_time) : schedule.end_time;
      const classStartDate = new Date(classInfo.start_date);
      const classEndDate = new Date(classInfo.end_date);

      if (newStartTime >= newEndTime) {
        return res.status(400).json({ error: 'Thời gian kết thúc phải sau thời gian bắt đầu' });
      }

      if (newStartTime < classStartDate || newEndTime > classEndDate) {
        return res.status(400).json({ 
          error: 'Thời gian lịch học phải nằm trong khoảng thời gian của lớp học' 
        });
      }

      // Kiểm tra trùng lịch
      const conflictSchedule = await ClassSchedule.findOne({
        _id: { $ne: id },
        classInfo_id: schedule.classInfo_id,
        $or: [
          {
            start_time: { $lt: newEndTime },
            end_time: { $gt: newStartTime }
          }
        ]
      });

      if (conflictSchedule) {
        return res.status(400).json({ error: 'Đã có lịch học trong khoảng thời gian này' });
      }

      updateData = {
        ...updateData,
        start_time: newStartTime,
        end_time: newEndTime
      };
    }
    
    const updatedSchedule = await ClassSchedule.findByIdAndUpdate(
      id,
      updateData,
      { new: true })
      .populate({
        path: 'classInfo_id',
        populate: [
          { path: 'course_id', select: 'name code' },
          { path: 'enrollment_id', populate: { path: 'student_id', select: 'student_code user_id', populate: { path: 'user_id', select: '-password' } } },
          { path: 'tutor_id', select: 'tutor_code', populate: { path: 'user_id', select: '-password' } }
        ]
      });

    res.status(200).json(updatedSchedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Xóa lịch học
exports.deleteSchedule = async (req, res) => {
  try {
    const schedule = await ClassSchedule.findById(req.params.id);
    
    if (!schedule) {
      return res.status(404).json({ error: 'Không tìm thấy lịch học' });
    }

    await schedule.deleteOne();
    
    res.status(200).json({ message: 'Đã xóa lịch học thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};