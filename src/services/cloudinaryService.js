const cloudinary = require('cloudinary').v2;

// cloud_name = dzsgfbjry
// api_key = 944916638512926
// api_secret =  dDX4kmgkYOH_-UxqLPsRkGkdzQw
cloudinary.config({
  cloud_name: dzsgfbjry,
  api_key: 944916638512926,
  api_secret: dDX4kmgkYOH_-UxqLPsRkGkdzQw,
});

exports.submitTask = async (req, res, next) => {
  const { id: taskId } = req.params;
  const userId = req.user._id;
  let submissionData;

  if (req.file) {
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload_stream(
      { resource_type: "image", folder: "task_submissions" },
      async (error, uploaded) => {
        if (error) return next(new AppError("Upload failed", 500));

        submissionData = uploaded.secure_url;

        // then save like before
        await taskService.submitTask(userId, taskId, submissionData);
        res.status(200).json({ status: "success", message: "Screenshot submitted successfully!" });
      }
    );

    // Pipe file buffer to cloudinary
    streamifier.createReadStream(req.file.buffer).pipe(result);
  } else {
    submissionData = req.body.submissionData; // For link submissions
    await taskService.submitTask(userId, taskId, submissionData);
    res.status(200).json({ status: "success", message: "Link submitted successfully!" });
  }
};
