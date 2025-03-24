const express = require('express');
const router = express.Router();
const messageController = require('../../controllers/communication/message');
const auth = require('../../middleware/auth');

router.post('/', auth, messageController.upload.single('attachment'), messageController.sendMessage);

router.get('/:conversation_id', auth, messageController.getMessages);

router.patch('/:id', auth, messageController.updateMessage);

router.delete('/:id', auth, messageController.deleteMessage);

router.get('/attachment/:id', auth, messageController.checkAttachment);

router.get('/attachment/download/:id', auth, messageController.downloadAttachment);

module.exports = router;