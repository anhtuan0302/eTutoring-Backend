const express = require('express');
const router = express.Router();
const postController = require('../../controllers/blog/post');
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');

router.get('/', auth, postController.getAllPosts);

router.get('/:id', auth, postController.getPostById);

router.post('/', postController.upload.array('attachments'), auth, postController.createPost);

router.patch('/:id', postController.upload.array('attachments'), auth, postController.updatePost);

router.delete('/:id', auth, postController.deletePost);

router.patch('/:id/moderate', auth, roleCheck(['admin', 'staff', 'tutor']), postController.moderatePost);

router.delete('/:id/attachments/:attachmentId', auth, postController.removeAttachment);

router.post('/:id/view', auth, postController.addView);

router.get('/:id/viewers', auth, postController.getViewers);

module.exports = router;