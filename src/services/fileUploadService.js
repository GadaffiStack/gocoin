const multer = require('multer');

const storage = multer.memoryStorage(); // keeps file in memory buffer
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png') cb(null, true);
    else cb(new AppError('Only PNG images are allowed', 400));
  },
});

module.exports = upload;
