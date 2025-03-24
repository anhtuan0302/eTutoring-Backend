const ClassSchedule = require('../../models/education/classSchedule');
const ClassInfo = require('../../models/education/classInfo');
const { sendToUser } = require('../../config/socket');

// Tạo lịch học mới
exports.createSchedule = async (req, res) => {
  try {
    const {
      class_id, description, start_time, end_time,
      is_online, online_link, location, session_number
    } = req.body;
    
    // Kiểm tra lớp học tồn tại
    const classInfo = await ClassInfo.findOne({ _id: class_id, is_deleted: false });
    if (!classInfo) {
      return res.status(404).json({ error: 'Không tìm thấy lớp học' });
    }
    
    // Kiểm tra thời gian bắt đầu và kết thúc
    if (new Date(start_time) >= new Date(end_time)) {
      return res.status(400).json({ error: 'Thời gian kết thúc phải sau thời gian bắt đầu' });
    }
    
    const classSchedule = new ClassSchedule({
      class_id,
      description,
      start_time,
      end_time,
      is_online,
      online_link,
      location,
      status: 'scheduled',
      session_number
    });
    
    await classSchedule.save();
    
    // Thông báo cho tất cả sinh viên và giảng viên của lớp
    // Có thể thực hiện ở đây bằng cách gọi req.io.to(`class:${class_id}`).emit()
    
    res.status(201).json(classSchedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách lịch học
exports.getSchedulesByClass = async (req, res) => {
  try {
    const { class_id } = req.params;
    const { from_date, to_date, status } = req.query;
    
    const filter = { class_id };
    
    // Lọc theo khoảng thời gian
    if (from_date || to_date) {
      filter.start_time = {};
      if (from_date) filter.start_time.$gte = new Date(from_date);
      if (to_date) filter.start_time.$lte = new Date(to_date);
    }
    
    // Lọc theo trạng thái
    if (status) filter.status = status;
    
    const schedules = await ClassSchedule.find(filter)
      .sort({ start_time: 1 });
      
    res.status(200).json(schedules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy chi tiết lịch học
exports.getScheduleById = async (req, res) => {
  try {
    const schedule = await ClassSchedule.findById(req.params.id)
      .populate('class_id', 'code name course_id')
      .populate({ path: 'class_id', populate: { path: 'course_id', select: 'name' } });
    
    if (!schedule) {
      return res.status(404).json({ error: 'Không tìm thấy lịch học' });
    }
    
    res.status(200).json(schedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cập nhật lịch học
exports.updateSchedule = async (req, res) => {
  try {
    const {
      description, start_time, end_time,
      is_online, online_link, location, status
    } = req.body;
    
    // Kiểm tra thời gian bắt đầu và kết thúc
    if (start_time && end_time && new Date(start_time) >= new Date(end_time)) {
      return res.status(400).json({ error: 'Thời gian kết thúc phải sau thời gian bắt đầu' });
    }
    
    const schedule = await ClassSchedule.findByIdAndUpdate(
      req.params.id,
      {
        description,
        start_time,
        end_time,
        is_online,
        online_link,
        location,
        status
      },
      { new: true }
    );
    
    if (!schedule) {
      return res.status(404).json({ error: 'Không tìm thấy lịch học' });
    }
    
    // Gửi thông báo cập nhật
    if (req.io) {
      req.io.to(`class:${schedule.class_id}`).emit('schedule:updated', {
        schedule_id: schedule._id,
        class_id: schedule.class_id,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        status: schedule.status
      });
    }
    
    res.status(200).json(schedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Xóa lịch học
exports.deleteSchedule = async (req, res) => {
  try {
    const schedule = await ClassSchedule.findByIdAndDelete(req.params.id);
    
    if (!schedule) {
      return res.status(404).json({ error: 'Không tìm thấy lịch học' });
    }
    
    // Gửi thông báo xóa
    if (req.io) {
      req.io.to(`class:${schedule.class_id}`).emit('schedule:deleted', {
        schedule_id: schedule._id,
        class_id: schedule.class_id
      });
    }
    
    res.status(200).json({ message: 'Đã xóa lịch học thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};