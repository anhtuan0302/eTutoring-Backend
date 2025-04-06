const express = require('express');
const router = express.Router();
const postReactionController = require('../../controllers/blog/postReaction');
const auth = require('../../middleware/auth');


router.get('/post/:post_id', auth, postReactionController.getAllReactions);

router.post('/post/:post_id', auth, postReactionController.createReaction);

router.get('/post/:post_id/me', auth, postReactionController.getUserReaction);

module.exports = router;