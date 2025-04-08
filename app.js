const express = require("express");
const cors = require('cors');
const path = require('path');
const { initCronJobs } = require('./config/cron');

require("dotenv").config();
const connectMongoose = require('./config/mongoose');
const initAdmin = require('./config/initAdmin');
const { firebase } = require('./config/firebase');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

connectMongoose();
initAdmin();
initCronJobs();

// Nạp routes
app.use('/', express.static(path.join(__dirname)));

const userRoutes = require('./routes/auth/user');
const tokenRoutes = require('./routes/auth/token');
const pendingUserRoutes = require('./routes/auth/pendingUser');
const loginHistoryRoutes = require('./routes/auth/loginHistory');

const departmentRoutes = require('./routes/organization/department');   
const staffRoutes = require('./routes/organization/staff');
const studentRoutes = require('./routes/organization/student');
const tutorRoutes = require('./routes/organization/tutor');

const chatConversationRoutes = require('./routes/communication/chatConversation');
const messageRoutes = require('./routes/communication/message');
const notificationRoutes = require('./routes/communication/notification');

const postRoutes = require('./routes/blog/post');
const postCommentRoutes = require('./routes/blog/postComment');
const postReactionRoutes = require('./routes/blog/postReaction');

const attendanceRoutes = require('./routes/education/attendance');
const classContentRoutes = require('./routes/education/classContent');
const classInfoRoutes = require('./routes/education/classInfo');
const classScheduleRoutes = require('./routes/education/classSchedule');
const classTutorRoutes = require('./routes/education/classTutor');
const courseRoutes = require('./routes/education/course');
const enrollmentRoutes = require('./routes/education/enrollment');
const submissionRoutes = require('./routes/education/submission');

app.use('/api/user', userRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/pendingUser', pendingUserRoutes);
app.use('/api/loginHistory', loginHistoryRoutes);

app.use('/api/department', departmentRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/tutor', tutorRoutes);

app.use('/api/chat/conversation', chatConversationRoutes);
app.use('/api/chat/message', messageRoutes);
app.use('/api/notification', notificationRoutes);

app.use('/api/blog/post', postRoutes);
app.use('/api/blog/postComment', postCommentRoutes);
app.use('/api/blog/postReaction', postReactionRoutes);

app.use('/api/education/attendance', attendanceRoutes);
app.use('/api/education/classContent', classContentRoutes);
app.use('/api/education/classInfo', classInfoRoutes);
app.use('/api/education/classSchedule', classScheduleRoutes);
app.use('/api/education/classTutor', classTutorRoutes);
app.use('/api/education/course', courseRoutes);
app.use('/api/education/enrollment', enrollmentRoutes);
app.use('/api/education/submission', submissionRoutes);

// Middleware xử lý lỗi
app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).send({ error: 'Đã xảy ra lỗi máy chủ.' });
});

app.listen(process.env.PORT, () => {
    console.log(`🚀 Server is running on port ${process.env.PORT}`);
});