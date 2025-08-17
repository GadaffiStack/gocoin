const catchAsync = require('../utils/catchAsync');
const activityService = require('../services/activityService');

exports.getWeeklyActivities = async (req, res, next) => {
  const data = await activityService.getUserWeeklyActivities(req.user._id);

  res.status(200).json({
    status: 'success',
    data
  });
};
