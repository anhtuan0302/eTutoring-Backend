const ClassContent = require('../../models/education/classContent');
const ClassInfo = require('../../models/education/classInfo');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Cấu hình multer cho upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/classContent';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

exports.upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Loại file không được hỗ trợ'));
    }
  }
});

// Tạo nội dung mới
exports.createContent = async (req, res) => {
  try {
    const { class_id, title, description, content_type, duedate, order } = req.body;
    
    // Kiểm tra lớp học tồn tại
    const classInfo = await ClassInfo.findOne({ _id: class_id, is_deleted: false });
    if (!classInfo) {
      return res.status(404).json({ error: 'Không tìm thấy lớp học' });
    }
    
    // Xử lý files nếu có
    const attachments = req.files?.map(file => ({
      file_name: file.originalname,
      file_path: file.path,
      file_type: file.mimetype,
      file_size: file.size
    })) || [];
    
    const classContent = new ClassContent({
      class_id,
      title,
      description,
      content_type,
      duedate: content_type === 'assignment' ? duedate : undefined,
      order: order || 0,
      is_visible: true,
      attachments
    });
    
    await classContent.save();
    
    // Thông báo về nội dung mới
    if (req.io && content_type === 'assignment') {
      req.io.to(`class:${class_id}`).emit('content:new_assignment', {
        content_id: classContent._id,
        class_id,
        title,
        duedate
      });
    }
    
    res.status(201).json(classContent);
  } catch (error) {
    // Xóa files nếu có lỗi
    if (req.files) {
      req.files.forEach(file => fs.unlinkSync(file.path));
    }
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách nội dung
exports.getContentsByClass = async (req, res) => {
  try {
    const { class_id } = req.params;
    const { content_type } = req.query;
    
    const filter = { class_id, is_deleted: false };
    if (content_type) filter.content_type = content_type;
    
    const contents = await ClassContent.find(filter)
      .sort({ order: 1, createdAt: 1 });
      
    res.status(200).json(contents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy chi tiết nội dung
exports.getContentById = async (req, res) => {
  try {
    const content = await ClassContent.findOne({
      _id: req.params.id,
      is_deleted: false
    }).populate('class_id', 'code name');
    
    if (!content) {
      return res.status(404).json({ error: 'Không tìm thấy nội dung' });
    }
    
    res.status(200).json(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cập nhật nội dung
exports.updateContent = async (req, res) => {
  try {
    const { title, description, duedate, is_visible, order } = req.body;
    
    const content = await ClassContent.findOne({
      _id: req.params.id,
      is_deleted: false
    });
    
    if (!content) {
      return res.status(404).json({ error: 'Không tìm thấy nội dung' });
    }
    
    // Xử lý files mới nếu có
    if (req.files?.length > 0) {
      const newAttachments = req.files.map(file => ({
        file_name: file.originalname,
        file_path: file.path,
        file_type: file.mimetype,
        file_size: file.size
      }));
      content.attachments.push(...newAttachments);
    }
    
    // Cập nhật thông tin
    content.title = title || content.title;
    content.description = description || content.description;
    content.is_visible = is_visible !== undefined ? is_visible : content.is_visible;
    content.order = order !== undefined ? order : content.order;
    
    // Chỉ cập nhật duedate cho assignment
    if (content.content_type === 'assignment' && duedate) {
      content.duedate = duedate;
    }
    
    await content.save();
    
    // Thông báo về cập nhật
    if (req.io && content.content_type === 'assignment') {
      req.io.to(`class:${content.class_id}`).emit('content:updated', {
        content_id: content._id,
        class_id: content.class_id,
        title: content.title,
        duedate: content.duedate
      });
    }
    
    res.status(200).json(content);
  } catch (error) {
    // Xóa files nếu có lỗi
    if (req.files) {
      req.files.forEach(file => fs.unlinkSync(file.path));
    }
    res.status(500).json({ error: error.message });
  }
};

// Xóa attachment
exports.removeAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    
    const content = await ClassContent.findOne({
      _id: id,
      is_deleted: false
    });
    
    if (!content) {
      return res.status(404).json({ error: 'Không tìm thấy nội dung' });
    }
    
    // Tìm attachment
    const attachment = content.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Không tìm thấy file đính kèm' });
    }
    
    // Xóa file
    fs.unlinkSync(attachment.file_path);
    
    // Xóa từ mảng
    content.attachments.pull(attachmentId);
    await content.save();
    
    res.status(200).json({ message: 'Đã xóa file đính kèm' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Xóa nội dung
exports.deleteContent = async (req, res) => {
  try {
    const content = await ClassContent.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      { is_deleted: true },
      { new: true }
    );
    
    if (!content) {
      return res.status(404).json({ error: 'Không tìm thấy nội dung' });
    }
    
    res.status(200).json({ message: 'Đã xóa nội dung thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Download attachment
exports.downloadAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    
    const content = await ClassContent.findOne({
      _id: id,
      is_deleted: false
    });
    
    if (!content) {
      return res.status(404).json({ error: 'Không tìm thấy nội dung' });
    }
    
    // Tìm attachment
    const attachment = content.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Không tìm thấy file đính kèm' });
    }
    
    const filePath = path.join(__dirname, '../../', attachment.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File không tồn tại' });
    }
    
    res.download(filePath, attachment.file_name);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};