const express = require('express');
const router = express.Router();
const chatConversationController = require('../../controllers/communication/chatConversation');
const auth = require('../../middleware/auth');

router.post('/', auth, chatConversationController.createConversation);

router.get('/', auth, chatConversationController.getConversations);

router.delete('/:id', auth, chatConversationController.deleteConversation);

module.exports = router;