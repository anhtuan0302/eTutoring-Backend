const PostCategory = require('../../models/blog/postCategory');

exports.createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const category = new PostCategory({
      name,
      description
    });

    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await PostCategory.find({ is_deleted: false });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const category = await PostCategory.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      { name, description },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ error: 'Không tìm thấy danh mục' });
    }

    res.status(200).json(category);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await PostCategory.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      { is_deleted: true },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ error: 'Không tìm thấy danh mục' });
    }

    res.status(200).json({ message: 'Đã xóa danh mục' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};