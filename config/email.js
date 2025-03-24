const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1) Tạo transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  // 2) Xác định các tùy chọn email
  const mailOptions = {
    from: `eTutoring <${process.env.EMAIL_FROM}>`,
    to: options.email,
    subject: options.subject,
    text: options.message
  };

  // 3) Gửi email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;