const express = require('express');
const router = express.Router();
const postCommentController = require('../../controllers/blog/postComment');
const auth = require('../../middleware/auth');

router.get('/post/:post_id', auth, postCommentController.getAllComments);

router.post('/post/:post_id', auth, postCommentController.createComment);

router.patch('/post/:post_id/:comment_id', auth, postCommentController.updateComment);

router.delete('/post/:post_id/:comment_id', auth, postCommentController.deleteComment);

module.exports = router;