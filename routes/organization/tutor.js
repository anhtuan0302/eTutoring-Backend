const express = require('express');
const router = express.Router();

const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');

const tutorController = require('../../controllers/organization/tutor');

router.get('/', auth, tutorController.getAllTutors);

router.get('/:id', auth, tutorController.getTutorById);

router.post('/', auth, roleCheck(['admin', 'staff']), tutorController.createTutor);

router.patch('/:id', auth, roleCheck(['admin', 'staff']), tutorController.updateTutor);

router.delete('/:id', auth, roleCheck(['admin', 'staff']), tutorController.deleteTutor);

module.exports = router;