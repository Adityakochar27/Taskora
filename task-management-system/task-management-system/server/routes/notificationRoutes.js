const router = require('express').Router();
const ctrl = require('../controllers/notificationController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/', ctrl.list);
router.put('/read-all', ctrl.markAllRead);
router.put('/:id/read', ctrl.markRead);
router.delete('/:id', ctrl.remove);

module.exports = router;
