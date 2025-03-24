const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/auth/user");
const Token = require("../models/auth/token");
const Message = require("../models/communication/message");
const ChatConversation = require("../models/communication/chatConversation");

// Lưu trữ kết nối socket theo userId
const userSockets = new Map();
let io = null;

const setupSocketServer = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Middleware xác thực token
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("Authentication error: Token required"));
      }

      // Giải mã token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Tìm token trong database
      const tokenDoc = await Token.findOne({
        user_id: decoded._id,
        value: token,
        type: "access",
        is_revoked: false,
        expires_at: { $gt: new Date() },
      });

      if (!tokenDoc) {
        return next(new Error("Authentication error: Invalid token"));
      }

      // Tìm user
      const user = await User.findById(decoded._id);

      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      // Lưu thông tin user vào socket
      socket.user = user;
      socket.token = token;
      socket.tokenDoc = tokenDoc;

      next();
    } catch (error) {
      console.error("Socket authentication error:", error.message);
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", async (socket) => {
    console.log(`User connected: ${socket.user.username}`);

    // Lưu socket theo userId
    const userId = socket.user._id.toString();
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Cập nhật trạng thái thành online
    if (socket.user.status !== "online") {
      socket.user.status = "online";
      socket.user.lastActive = new Date();
      await socket.user.save();

      io.emit("user:status", {
        userId: socket.user._id,
        status: "online",
        username: socket.user.username,
      });
    }

    // === CHAT EVENTS ===

    socket.on("join:conversation", (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("leave:conversation", (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on("typing:start", async (data) => {
      try {
        const { conversation_id } = data;
        const conversation = await ChatConversation.findOne({
          _id: conversation_id,
          $or: [{ user1_id: socket.user._id }, { user2_id: socket.user._id }],
          is_deleted: false,
        });

        if (!conversation) return;

        const receiverId =
          conversation.user1_id.toString() === socket.user._id.toString()
            ? conversation.user2_id
            : conversation.user1_id;

        sendToUser(receiverId, "user:typing", {
          conversation_id,
          userId: socket.user._id,
          isTyping: true,
        });
      } catch (error) {
        console.error("Error handling typing event:", error);
      }
    });

    // === BLOG EVENTS ===

    // Join post room để nhận updates
    socket.on("join:post", (postId) => {
      socket.join(`post:${postId}`);
      console.log(`User ${socket.user.username} joined post ${postId}`);
    });

    // Leave post room
    socket.on("leave:post", (postId) => {
      socket.leave(`post:${postId}`);
      console.log(`User ${socket.user.username} left post ${postId}`);
    });

    // Xử lý disconnect
    socket.on("disconnect", async () => {
      console.log(`User disconnected: ${socket.user.username}`);

      const userSocketSet = userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          userSockets.delete(userId);

          socket.user.status = "offline";
          socket.user.lastActive = new Date();
          await socket.user.save();

          io.emit("user:status", {
            userId: socket.user._id,
            status: "offline",
            username: socket.user.username,
          });
        }
      }
    });

    // === EDUCATION EVENTS ===

    // Join class room để nhận thông báo
    socket.on("join:class", (classId) => {
      socket.join(`class:${classId}`);
      console.log(`User ${socket.user.username} joined class ${classId}`);
    });

    // Leave class room
    socket.on("leave:class", (classId) => {
      socket.leave(`class:${classId}`);
      console.log(`User ${socket.user.username} left class ${classId}`);
    });
  });

  return io;
};

// Hàm kiểm tra xem một user có đang online hay không
const isUserOnline = (userId) => {
  return (
    userSockets.has(userId.toString()) &&
    userSockets.get(userId.toString()).size > 0
  );
};

// Hàm gửi tin nhắn tới một user cụ thể
const sendToUser = (userId, event, data) => {
  const userSocketSet = userSockets.get(userId.toString());
  if (userSocketSet && userSocketSet.size > 0 && io) {
    for (const socketId of userSocketSet) {
      io.to(socketId).emit(event, data);
    }
    return true;
  }
  return false;
};

// Các events được emit trong hệ thống:

// Blog events:
// - post:pending - Khi có bài viết mới cần duyệt
//   data: { post_id, title, author }
//
// - post:moderated - Khi bài viết được duyệt/từ chối
//   data: { post_id, status, reason }
//
// - post:updated - Khi bài viết được cập nhật
//   data: { post_id, title, content, status }
//
// - post:deleted - Khi bài viết bị xóa
//   data: { post_id }
//
// - post:view_updated - Khi có người xem bài viết
//   data: { post_id, view_count }
//
// - comment:created - Khi có comment mới
//   data: { comment_id, post_id, content, user }
//
// - comment:updated - Khi comment được cập nhật
//   data: { comment_id, post_id, content }
//
// - comment:deleted - Khi comment bị xóa
//   data: { comment_id, post_id }
//
// - reaction:updated - Khi có thay đổi về reaction
//   data: { post_id, reactions: [{type, count}], latest_reaction }

// Các events được emit trong hệ thống:

// === USER STATUS EVENTS ===
// - user:status - Khi user online/offline
//   data: {
//     userId: String,
//     status: 'online' | 'offline',
//     username: String
//   }
//
// - online:users - Gửi danh sách users đang online
//   data: {
//     users: [{ _id, username, status, lastActive }]
//   }

// === CHAT EVENTS ===
// - user:typing - Khi user đang nhập tin nhắn
//   data: {
//     conversation_id: String,
//     userId: String,
//     isTyping: Boolean
//   }
//
// - message:sent - Khi tin nhắn được gửi
//   data: {
//     message: {
//       _id: String,
//       conversation_id: String,
//       sender_id: String,
//       content: String,
//       attachment: Object,
//       createdAt: Date
//     }
//   }
//
// - message:read - Khi tin nhắn được đọc
//   data: {
//     message_id: String,
//     conversation_id: String,
//     read_by: String,
//     read_at: Date
//   }

// === BLOG POST EVENTS ===
// - post:pending - Khi có bài viết mới cần duyệt
//   data: {
//     post_id: String,
//     title: String,
//     author: {
//       _id: String,
//       username: String
//     }
//   }
//
// - post:moderated - Khi bài viết được duyệt/từ chối
//   data: {
//     post_id: String,
//     status: 'approved' | 'rejected',
//     reason: String,
//     moderated_by: {
//       _id: String,
//       username: String
//     }
//   }
//
// - post:updated - Khi bài viết được cập nhật
//   data: {
//     post_id: String,
//     title: String,
//     content: String,
//     status: String,
//     updated_by: {
//       _id: String,
//       username: String
//     }
//   }
//
// - post:deleted - Khi bài viết bị xóa
//   data: {
//     post_id: String,
//     deleted_by: {
//       _id: String,
//       username: String
//     }
//   }
//
// - post:view_updated - Khi có người xem bài viết
//   data: {
//     post_id: String,
//     view_count: Number,
//     viewer: {
//       _id: String,
//       username: String
//     }
//   }

// === BLOG COMMENT EVENTS ===
// - comment:created - Khi có comment mới
//   data: {
//     comment: {
//       _id: String,
//       post_id: String,
//       content: String,
//       user: {
//         _id: String,
//         username: String,
//         avatar_path: String
//       },
//       createdAt: Date
//     }
//   }
//
// - comment:updated - Khi comment được cập nhật
//   data: {
//     comment_id: String,
//     post_id: String,
//     content: String,
//     updated_at: Date
//   }
//
// - comment:deleted - Khi comment bị xóa
//   data: {
//     comment_id: String,
//     post_id: String,
//     deleted_by: {
//       _id: String,
//       username: String
//     }
//   }

// === BLOG REACTION EVENTS ===
// - reaction:updated - Khi có thay đổi về reaction
//   data: {
//     post_id: String,
//     reactions: [
//       {
//         type: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry',
//         count: Number
//       }
//     ],
//     latest_reaction: {
//       user_id: String,
//       username: String,
//       reaction_type: String
//     }
//   }

// === NOTIFICATION EVENTS ===
// - notification:post - Thông báo liên quan đến bài viết
//   data: {
//     type: 'post_approved' | 'post_rejected' | 'post_commented' | 'post_reacted',
//     post_id: String,
//     title: String,
//     user: {
//       _id: String,
//       username: String
//     },
//     createdAt: Date
//   }

// === EDUCATION EVENTS ===
// - class:schedule_updated - Khi có cập nhật lịch học
//   data: { 
//     schedule_id: String,
//     class_id: String,
//     start_time: Date,
//     end_time: Date,
//     status: String
//   }
//
// - class:content_updated - Khi có nội dung mới hoặc cập nhật
//   data: {
//     content_id: String,
//     class_id: String,
//     title: String,
//     content_type: String,
//     duedate: Date
//   }
//
// - attendance:created - Khi có điểm danh mới
//   data: {
//     attendance_id: String,
//     student_id: String,
//     status: String
//   }
//
// - attendance:updated - Khi cập nhật điểm danh
//   data: {
//     attendance_id: String,
//     student_id: String,
//     status: String
//   }
//
// - attendance:bulk_updated - Khi cập nhật điểm danh hàng loạt
//   data: {
//     class_schedule_id: String,
//     count: Number
//   }
//
// - enrollment:created - Khi có sinh viên đăng ký lớp
//   data: {
//     enrollment_id: String,
//     class_id: String,
//     student_id: String
//   }
//
// - enrollment:deleted - Khi sinh viên rút khỏi lớp
//   data: {
//     enrollment_id: String,
//     class_id: String,
//     student_id: String
//   }
//
// - submission:created - Khi có bài nộp mới hoặc cập nhật
//   data: {
//     submission_id: String,
//     assignment_id: String,
//     student_id: String,
//     is_new: Boolean,
//     version: Number,
//     is_late: Boolean
//   }
//
// - submission:graded - Khi bài nộp được chấm điểm
//   data: {
//     submission_id: String,
//     assignment_id: String,
//     student_id: String,
//     score: Number
//   }

module.exports = {
  setupSocketServer,
  isUserOnline,
  sendToUser,
};
