var mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

const connectMongoose = async () => {
    try {
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("✅ MongoDB connected!");
    } catch (error) {
        console.error("❌ MongoDB connection error:", error);
        process.exit(1);
    }
}

module.exports = connectMongoose;