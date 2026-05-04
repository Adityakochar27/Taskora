const router = require('express').Router();
const ctrl = require('../controllers/taskController');
const { protect } = require('../middlewares/authMiddleware');
const { restrictTo } = require('../middlewares/roleMiddleware');
const { upload } = require('../middlewares/uploadMiddleware');

router.use(protect);

router.get('/', ctrl.listTasks);
router.post('/', restrictTo('Admin', 'HOD'), ctrl.createTask);

router.get('/:id', ctrl.getTask);
router.put('/:id', ctrl.updateTask);
router.delete('/:id', ctrl.deleteTask);

router.post('/:id/comments', ctrl.addComment);
router.post('/:id/attachments', upload.single('file'), ctrl.uploadAttachment);

module.exports = router;
