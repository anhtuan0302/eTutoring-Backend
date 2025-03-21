require("dotenv").config();
const express = require("express");
const { connectMongoose } = require("./config");
const departmentRoutes = require('./routes/organization/department');

const app = express();

connectMongoose();

app.use('/api/department', departmentRoutes);

app.listen(process.env.PORT, () => {
    console.log(`🚀 Server is running on port ${process.env.PORT}`);
});