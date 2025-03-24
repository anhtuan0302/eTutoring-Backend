const express = require('express');
const userController = require('../../controllers/auth/user');
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');
const router = express.Router();

router.get('/me', auth, userController.getCurrentUser);

router.patch('/me', auth, userController.updateUser);

router.get('/login-history', auth, userController.getLoginHistory);

router.patch('/role-info', auth, userController.updateRoleInfo);

router.get('/', auth, userController.getAllUsers);

module.exports = router;