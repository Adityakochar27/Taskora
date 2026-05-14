const router = require('express').Router();
const ctrl = require('../controllers/departmentController');
const { protect } = require('../middlewares/authMiddleware');
const { restrictTo } = require('../middlewares/roleMiddleware');

// Public route - MUST be declared before router.use(protect) below so it
// stays unauthenticated. Used by the signup page's department picker.
router.get('/public', ctrl.publicListDepartments);

// Everything below this line requires a valid token.
router.use(protect);

router.get('/', ctrl.listDepartments);
router.post('/', restrictTo('Admin'), ctrl.createDepartment);
router.get('/:id', ctrl.getDepartment);
router.put('/:id', restrictTo('Admin'), ctrl.updateDepartment);
router.delete('/:id', restrictTo('Admin'), ctrl.deleteDepartment);

module.exports = router;
