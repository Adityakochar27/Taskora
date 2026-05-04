const router = require('express').Router();
const ctrl = require('../controllers/dashboardController');
const { protect } = require('../middlewares/authMiddleware');
const { restrictTo } = require('../middlewares/roleMiddleware');

router.use(protect);

router.get('/summary', ctrl.summary);
router.get('/productivity', restrictTo('Admin', 'HOD'), ctrl.productivity);
router.get('/activity', ctrl.activity);

module.exports = router;
