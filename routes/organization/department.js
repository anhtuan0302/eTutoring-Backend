const express = require('express');
const router = express.Router();

const DepartmentModel = require('../../models/organization/department');

router.post('/create', async (req, res) => {
    try {
        const { name, description } = req.body;
        const department = await DepartmentModel.create({ name, description });
        res.status(201).json(department);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const departments = await DepartmentModel.find();
        res.status(200).json(departments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

