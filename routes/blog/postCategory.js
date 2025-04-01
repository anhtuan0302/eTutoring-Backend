const express = require('express');
const router = express.Router();
const postCategoryController = require('../../controllers/blog/postCategory');
const auth = require('../../middleware/auth');
const roleCheck = require('../../middleware/roleCheck');

router.get('/', auth, postCategoryController.getAllCategories);

router.post('/', auth, roleCheck(['admin', 'staff']), postCategoryController.createCategory);

router.patch('/:id', auth, roleCheck(['admin', 'staff']), postCategoryController.updateCategory);

router.delete('/:id', auth, roleCheck(['admin', 'staff']), postCategoryController.deleteCategory);

module.exports = router;