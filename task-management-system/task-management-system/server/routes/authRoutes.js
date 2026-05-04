const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/signup', ctrl.signup);
router.post('/login', ctrl.login);
router.get('/me', protect, ctrl.me);
router.post('/fcm-token', protect, ctrl.registerFcmToken);
router.post('/fcm-token/remove', protect, ctrl.removeFcmToken);

module.exports = router;
