const LoginHistory = require('../../models/auth/loginHistory');
const User = require('../../models/auth/user');
const Token = require('../../models/auth/token');

// Lưu lịch sử đăng nhập
exports.createLoginHistory = async (req, res) => {
  try {
    const { user, ipaddress, browser, device, os } = req.body;
    
    // Kiểm tra user có tồn tại không
    const userExists = await User.findById(user);
    if (!userExists) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }
    
    const loginHistory = new LoginHistory({
      user,
      ipaddress,
      browser,
      device,
      os,
      history_time: new Date()
    });
    
    await loginHistory.save();
    
    res.status(201).json(loginHistory);
  } catch (error) {
    console.error('Error creating login history:', error);
    res.status(500).json({ error: error.message });
  }
};

// Lấy lịch sử đăng nhập của người dùng
exports.getUserLoginHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Kiểm tra user có tồn tại không
    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }
    
    const loginHistories = await LoginHistory.find({ user: userId })
      .sort({ history_time: -1 })
      .limit(10); // Chỉ lấy 10 lịch sử gần nhất
    
    res.status(200).json(loginHistories);
  } catch (error) {
    console.error('Error getting user login history:', error);
    res.status(500).json({ error: error.message });
  }
};

// Xóa một lịch sử đăng nhập và token của thiết bị
exports.deleteLoginHistory = async (req, res) => {
  try {
    const { historyId } = req.params;
    
    const loginHistory = await LoginHistory.findById(historyId);
    if (!loginHistory) {
      return res.status(404).json({ error: 'Không tìm thấy lịch sử đăng nhập' });
    }
    
    // Chỉ cho phép người dùng xóa lịch sử của chính mình hoặc admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== loginHistory.user.toString()) {
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
    }

    // Thu hồi token của thiết bị này
    await Token.updateMany(
      {
        user_id: loginHistory.user,
        created_by_ip: loginHistory.ipaddress,
        is_revoked: false
      },
      {
        is_revoked: true,
        revoked_at: new Date()
      }
    );
    
    // Xóa lịch sử đăng nhập
    await LoginHistory.findByIdAndDelete(historyId);
    
    res.status(200).json({ message: 'Đã xóa lịch sử đăng nhập và đăng xuất thiết bị thành công' });
  } catch (error) {
    console.error('Error deleting login history:', error);
    res.status(500).json({ error: error.message });
  }
};

// Xóa tất cả lịch sử đăng nhập và token của một user
exports.clearUserLoginHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Kiểm tra user có tồn tại không
    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }
    
    // Chỉ cho phép người dùng xóa lịch sử của chính mình hoặc admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
    }
    
    // Thu hồi tất cả token của user
    await Token.updateMany(
      {
        user_id: userId,
        is_revoked: false
      },
      {
        is_revoked: true,
        revoked_at: new Date()
      }
    );

    // Xóa tất cả lịch sử đăng nhập
    await LoginHistory.deleteMany({ user: userId });
    
    res.status(200).json({ message: 'Đã xóa tất cả lịch sử đăng nhập và đăng xuất tất cả thiết bị thành công' });
  } catch (error) {
    console.error('Error clearing user login history:', error);
    res.status(500).json({ error: error.message });
  }
};

// Lấy thống kê đăng nhập (chỉ cho admin)
exports.getLoginStatistics = async (req, res) => {
  try {
    // Kiểm tra quyền admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
    }
    
    // Đếm số lượng đăng nhập trong 7 ngày gần đây
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const dailyStats = await LoginHistory.aggregate([
      {
        $match: {
          history_time: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$history_time" },
            month: { $month: "$history_time" },
            day: { $dayOfMonth: "$history_time" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
      }
    ]);
    
    // Thống kê theo thiết bị
    const deviceStats = await LoginHistory.aggregate([
      {
        $group: {
          _id: "$device",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    // Thống kê theo trình duyệt
    const browserStats = await LoginHistory.aggregate([
      {
        $group: {
          _id: "$browser",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    res.status(200).json({
      dailyStats,
      deviceStats,
      browserStats
    });
  } catch (error) {
    console.error('Error getting login statistics:', error);
    res.status(500).json({ error: error.message });
  }
};