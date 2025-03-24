const express = require('express');
const router = express.Router();

const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');

const staffController = require('../../controllers/organization/staff');

router.get('/', auth, staffController.getAllStaff);

router.get('/:id', auth, staffController.getStaffById);

router.post('/', auth, roleCheck(['admin', 'staff']), staffController.createStaff);

router.patch('/:id', auth, roleCheck(['admin', 'staff']), staffController.updateStaff);

router.delete('/:id', auth, roleCheck(['admin', 'staff']), staffController.deleteStaff);

module.exports = router;