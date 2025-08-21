const multer = require('multer');

const storage = multer.memoryStorage(); // keeps file in memory buffer
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PNG and JPG images are allowed', 400));
  },
});

module.exports = upload;
