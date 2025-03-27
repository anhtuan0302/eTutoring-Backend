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

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

      const user = await User.findById(decoded._id);
      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      socket.user = user;
      socket.token = token;
      socket.tokenDoc = tokenDoc;

      next();
    } catch (error) {
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

    // Cập nhật trạng thái online
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

    // Join conversation room
    socket.on("join:conversation", (conversationId) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`User ${socket.user.username} joined conversation ${conversationId}`);
    });

    // Leave conversation room
    socket.on("leave:conversation", (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`User ${socket.user.username} left conversation ${conversationId}`);
    });

    // Handle typing status
    socket.on("typing:start", async (data) => {
      try {
        const { conversation_id } = data;
        const conversation = await ChatConversation.findOne({
          _id: conversation_id,
          $or: [
            { user1_id: socket.user._id },
            { user2_id: socket.user._id }
          ],
          is_deleted: false
        });

        if (!conversation) return;

        const receiverId = conversation.user1_id.toString() === socket.user._id.toString()
          ? conversation.user2_id
          : conversation.user1_id;

        sendToUser(receiverId, "user:typing", {
          conversation_id,
          userId: socket.user._id,
          isTyping: true
        });
      } catch (error) {
        console.error("Error handling typing event:", error);
      }
    });

    // Handle typing end
    socket.on("typing:end", async (data) => {
      try {
        const { conversation_id } = data;
        const conversation = await ChatConversation.findOne({
          _id: conversation_id,
          $or: [
            { user1_id: socket.user._id },
            { user2_id: socket.user._id }
          ],
          is_deleted: false
        });

        if (!conversation) return;

        const receiverId = conversation.user1_id.toString() === socket.user._id.toString()
          ? conversation.user2_id
          : conversation.user1_id;

        sendToUser(receiverId, "user:typing", {
          conversation_id,
          userId: socket.user._id,
          isTyping: false
        });
      } catch (error) {
        console.error("Error handling typing end event:", error);
      }
    });

    // Handle message read
    socket.on("message:read", async (data) => {
      try {
        const { conversation_id } = data;
        
        // Đánh dấu tin nhắn đã đọc
        await Message.updateMany(
          {
            conversation_id,
            sender_id: { $ne: socket.user._id },
            is_read: false
          },
          {
            is_read: true,
            read_at: new Date()
          }
        );

        // Thông báo cho người gửi
        const conversation = await ChatConversation.findById(conversation_id);
        if (conversation) {
          const senderId = conversation.user1_id.toString() === socket.user._id.toString()
            ? conversation.user2_id
            : conversation.user1_id;

          sendToUser(senderId, "message:read", {
            conversation_id,
            read_by: socket.user._id,
            read_at: new Date()
          });
        }
      } catch (error) {
        console.error("Error handling message read event:", error);
      }
    });

    // Handle disconnect
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
  });

  return io;
};

// Hàm kiểm tra xem một user có đang online hay không
const isUserOnline = (userId) => {
  return userSockets.has(userId.toString()) && userSockets.get(userId.toString()).size > 0;
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

// Hàm gửi tin nhắn tới một conversation
const sendToConversation = (conversationId, event, data) => {
  if (io) {
    io.to(`conversation:${conversationId}`).emit(event, data);
    return true;
  }
  return false;
};

module.exports = {
  setupSocketServer,
  isUserOnline,
  sendToUser,
  sendToConversation,
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io not initialized');
    }
    return io;
  }
};