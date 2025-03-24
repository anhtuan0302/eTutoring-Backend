const express = require('express');
const router = express.Router();

const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');

const studentController = require('../../controllers/organization/student');

router.get('/', auth, studentController.getAllStudents);

router.get('/:id', auth, studentController.getStudentById);

router.post('/', auth, roleCheck(['admin', 'staff']), studentController.createStudent);

router.patch('/:id', auth, roleCheck(['admin', 'staff']), studentController.updateStudent);

router.delete('/:id', auth, roleCheck(['admin', 'staff']), studentController.deleteStudent);

module.exports = router;