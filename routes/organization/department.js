const express = require('express');
const router = express.Router();

const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');

const departmentController = require('../../controllers/organization/department');

router.get('/', auth, departmentController.getAllDepartments);

router.get('/:id', auth, departmentController.getDepartmentById);

router.post('/', auth, roleCheck(['admin', 'staff']), departmentController.createDepartment);

router.patch('/:id', auth, roleCheck(['admin', 'staff']), departmentController.updateDepartment);

router.delete('/:id', auth, roleCheck(['admin', 'staff']), departmentController.deleteDepartment);

module.exports = router;

