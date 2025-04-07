# eTutoring Backend

The backend server for the eTutoring platform, providing RESTful APIs and real-time communication features.

## 🚀 Technologies Used

- **Node.js**: JavaScript runtime environment
- **Express.js**: Web application framework
- **MongoDB**: NoSQL database
- **Mongoose**: MongoDB object modeling
- **Socket.IO**: Real-time bidirectional communication
- **Firebase Admin**: Authentication and cloud services
- **JWT**: JSON Web Tokens for authentication
- **Multer**: File upload handling
- **Nodemailer**: Email service integration
- **Node-cron**: Task scheduling
- **Bcrypt**: Password hashing

## 📁 Project Structure

```
backend/
├── config/         # Configuration files
├── controllers/    # Request handlers
├── middleware/     # Custom middleware
├── models/         # Database models
├── routes/         # API routes
│   ├── auth/       # Authentication routes
│   ├── organization/ # Organization management
│   ├── communication/ # Chat and messaging
│   ├── blog/       # Blog and social features
│   └── education/  # Educational features
├── uploads/        # File uploads directory
└── app.js          # Main application file
```

## 🛠️ Installation and Running

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create .env file**
   Create a `.env` file in the root directory with the following variables:
   ```
   PORT=5000
   MONGODB_URI=your_mongodb_uri
   JWT_SECRET=your_jwt_secret
   FIREBASE_CREDENTIALS=your_firebase_credentials
   EMAIL_SERVICE=your_email_service
   EMAIL_USER=your_email_user
   EMAIL_PASS=your_email_password
   ```

3. **Run development server**
   ```bash
   npm start
   ```

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- CORS protection
- Firebase authentication integration
- Role-based access control

## 📡 API Endpoints

### Authentication
- `/api/user` - User management
- `/api/token` - Token operations
- `/api/pendingUser` - Pending user management
- `/api/loginHistory` - Login tracking

### Organization
- `/api/department` - Department management
- `/api/staff` - Staff management
- `/api/student` - Student management
- `/api/tutor` - Tutor management

### Communication
- `/api/chat/conversation` - Chat conversations
- `/api/chat/message` - Chat messages

### Blog
- `/api/blog/post` - Blog posts
- `/api/blog/postComment` - Post comments
- `/api/blog/postReaction` - Post reactions

### Education
- `/api/education/attendance` - Attendance tracking
- `/api/education/classContent` - Class content
- `/api/education/classInfo` - Class information
- `/api/education/classSchedule` - Class scheduling
- `/api/education/classTutor` - Tutor assignments
- `/api/education/course` - Course management
- `/api/education/enrollment` - Student enrollment
- `/api/education/submission` - Assignment submissions

## 🔄 Real-time Features

- Real-time chat using Socket.IO
- Live notifications
- Instant updates for class activities

## 📧 Email Services

- User registration verification
- Password reset
- Notification emails
- Automated reminders

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
