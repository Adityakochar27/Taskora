const router = require('express').Router();
const ctrl = require('../controllers/departmentController');
const { protect } = require('../middlewares/authMiddleware');
const { restrictTo } = require('../middlewares/roleMiddleware');

router.use(protect);

router.get('/', ctrl.listDepartments);
router.post('/', restrictTo('Admin'), ctrl.createDepartment);
router.get('/:id', ctrl.getDepartment);
router.put('/:id', restrictTo('Admin'), ctrl.updateDepartment);
router.delete('/:id', restrictTo('Admin'), ctrl.deleteDepartment);

module.exports = router;
