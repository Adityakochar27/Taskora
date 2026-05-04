const router = require('express').Router();
const ctrl = require('../controllers/teamController');
const { protect } = require('../middlewares/authMiddleware');
const { restrictTo } = require('../middlewares/roleMiddleware');

router.use(protect);

router.get('/', ctrl.listTeams);
router.post('/', restrictTo('Admin', 'HOD'), ctrl.createTeam);
router.get('/:id', ctrl.getTeam);
router.put('/:id', restrictTo('Admin', 'HOD'), ctrl.updateTeam);
router.delete('/:id', restrictTo('Admin', 'HOD'), ctrl.deleteTeam);

module.exports = router;
