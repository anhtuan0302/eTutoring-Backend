const express = require('express');
const router = express.Router();
const postCommentController = require('../../controllers/blog/postComment');
const auth = require('../../middleware/auth');

router.get('/post/:post_id', auth, postCommentController.getComments);

router.post('/post/:post_id', auth, postCommentController.createComment);

router.patch('/:id', auth, postCommentController.updateComment);

router.delete('/:id', auth, postCommentController.deleteComment);

module.exports = router;