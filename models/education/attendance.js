const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    class_schedule_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "classSchedule",
      required: true,
    },
    student_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "student",
      required: true,
    },
    status: {
      type: String,
      enum: ["present", "absent", "late"],
      default: "absent",
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

attendanceSchema.index({ class_schedule_id: 1, student_id: 1 }, { unique: true });

module.exports = mongoose.model("attendance", attendanceSchema);
