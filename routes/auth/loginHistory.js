const express = require("express");
const router = express.Router();
const loginHistoryController = require("../../controllers/auth/loginHistory");
const auth = require("../../middleware/auth");
const roleCheck = require("../../middleware/roleCheck");

// Lưu lịch sử đăng nhập (không cần auth, được gọi từ hàm đăng nhập)
router.post('/', loginHistoryController.createLoginHistory);

// Lấy thống kê đăng nhập (chỉ admin)
router.get('/statistics', 
  auth, 
  roleCheck(['admin']), 
  loginHistoryController.getLoginStatistics
);

// Lấy lịch sử đăng nhập của người dùng (yêu cầu đăng nhập)
router.get('/user/:userId', auth, loginHistoryController.getUserLoginHistory);

// Xóa lịch sử đăng nhập của người dùng (yêu cầu người dùng hoặc admin)
router.delete('/user/:userId', auth, loginHistoryController.clearUserLoginHistory);

// Xóa một lịch sử đăng nhập cụ thể
router.delete('/:historyId', auth, loginHistoryController.deleteLoginHistory);


module.exports = router;