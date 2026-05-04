const router = require('express').Router();
const ctrl = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');
const { restrictTo } = require('../middlewares/roleMiddleware');

router.use(protect);

router.get('/', restrictTo('Admin', 'HOD'), ctrl.listUsers);
router.post('/', restrictTo('Admin'), ctrl.createUser);

router.get('/:id', ctrl.getUser);
router.put('/:id', ctrl.updateUser);
router.delete('/:id', restrictTo('Admin'), ctrl.deleteUser);

module.exports = router;
