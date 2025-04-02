const cron = require('node-cron');
const ClassInfo = require('../models/education/classInfo');

const calculateStatusClassInfo = (startDate, endDate) => {
  const now = new Date();
  
  if (!startDate || !endDate) return 'open';
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (now < start) return 'open';
  if (now > end) return 'closed';
  return 'in progress';
};

// Khởi tạo cron jobs
const initCronJobs = () => {
  // Cập nhật status của lớp học mỗi giờ
  cron.schedule('0 * * * *', async () => {
    try {
      const classes = await ClassInfo.find();
      let updatedCount = 0;
      
      for (const classInfo of classes) {
        const newStatus = calculateStatusClassInfo(classInfo.start_date, classInfo.end_date);
        
        if (newStatus !== classInfo.status) {
          classInfo.status = newStatus;
          await classInfo.save();
          updatedCount++;
        }
      }
      
      console.log(`[${new Date().toISOString()}] Updated status for ${updatedCount} classes`);
    } catch (error) {
      console.error('Error updating class statuses:', error);
    }
  });

  console.log('Class status update cron job initialized');
};

module.exports = {
  initCronJobs,
  calculateStatusClassInfo
};