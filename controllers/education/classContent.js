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
    const { classInfo_id, title, description, content_type } = req.body;
    // Support both duedate and due_date parameters
    const dueDateValue = req.body.duedate || req.body.due_date;
    
    // Kiểm tra lớp học tồn tại
    const classInfo = await ClassInfo.findById(classInfo_id);
    if (!classInfo) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Xử lý files nếu có
    const attachments = req.files?.map(file => ({
      file_name: file.originalname,
      file_path: file.path,
      file_type: file.mimetype,
      file_size: file.size
    })) || [];
    
    // Create a new content object
    const contentData = {
      classInfo_id,
      title,
      description,
      content_type,
      attachments
    };
    
    // Handle duedate for assignments
    if (content_type === 'assignment' && dueDateValue) {
      try {
        // Handle different date formats that might be sent
        contentData.duedate = new Date(dueDateValue);
      } catch (err) {
        return res.status(400).json({ error: 'Invalid date format for duedate' });
      }
    }
    
    const classContent = new ClassContent(contentData);
    
    await classContent.save();

    const populatedClassContent = await ClassContent.findById(classContent._id)
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

    res.status(201).json(populatedClassContent);
  } catch (error) {
    console.error('Error creating content:', error);
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }
      });
    }
    res.status(500).json({ error: error.message });
  }
};

// Lấy danh sách nội dung
exports.getContentsByClassId = async (req, res) => {
  try {
    const { classInfo_id } = req.params;
    const { content_type } = req.query;
    
    const filter = { classInfo_id };
    if (content_type) filter.content_type = content_type;
    
    const contents = await ClassContent.find(filter)
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
      .sort({ createdAt: -1 });
      
    res.status(200).json(contents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lấy chi tiết nội dung
exports.getContentById = async (req, res) => {
  try {
    const content = await ClassContent.findById(req.params.id)
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
    const { title, description } = req.body;
    // Support both duedate and due_date
    const dueDateValue = req.body.duedate || req.body.due_date;
    
    const content = await ClassContent.findById(req.params.id);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    // Process new files if any
    if (req.files?.length > 0) {
      const newAttachments = req.files.map(file => ({
        file_name: file.originalname,
        file_path: file.path,
        file_type: file.mimetype,
        file_size: file.size
      }));
      content.attachments.push(...newAttachments);
    }
    
    // Update information
    if (title) content.title = title;
    if (description) content.description = description;
    if (content.content_type === 'assignment' && dueDateValue) {
      try {
        content.duedate = new Date(dueDateValue);
      } catch (err) {
        return res.status(400).json({ error: 'Invalid date format for duedate' });
      }
    }
    
    await content.save();
    
    const updatedContent = await ClassContent.findById(content._id)
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
    
    res.status(200).json(updatedContent);
  } catch (error) {
    // Delete files if error
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }
      });
    }
    res.status(500).json({ error: error.message });
  }
};

// Xóa attachment
exports.removeAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    
    const content = await ClassContent.findById(id);
    if (!content) {
      return res.status(404).json({ error: 'Không tìm thấy nội dung' });
    }
    
    // Tìm attachment
    const attachment = content.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Không tìm thấy file đính kèm' });
    }
    
    // Xóa file vật lý
    fs.unlinkSync(attachment.file_path);
    
    // Xóa từ database
    content.attachments.pull(attachmentId);
    await content.save();
    
    res.status(200).json({ message: 'Đã xóa file đính kèm' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete content
exports.deleteContent = async (req, res) => {
  try {
    const content = await ClassContent.findById(req.params.id);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Delete attached files
    if (content.attachments && content.attachments.length > 0) {
      for (const attachment of content.attachments) {
        try {
          if (fs.existsSync(attachment.file_path)) {
            fs.unlinkSync(attachment.file_path);
          }
        } catch (err) {
          console.error(`Error deleting file ${attachment.file_path}:`, err);
        }
      }
    }

    // Delete the content from database
    await ClassContent.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ 
      message: 'Content deleted successfully',
      content_type: content.content_type,
      title: content.title
    });
  } catch (error) {
    console.error('Error deleting content:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to delete content. Please try again.'
    });
  }
};

// Download attachment
exports.downloadAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    
    const content = await ClassContent.findById(id);
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