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

// Accept up to 10 files in a single request via field name "files".
// Single-file uploads can use field name "file" too — multer handles both.
router.post(
  '/:id/attachments',
  upload.fields([
    { name: 'files', maxCount: 10 },
    { name: 'file', maxCount: 1 },
  ]),
  (req, _res, next) => {
    // Normalise: collapse fields() output into req.files array.
    const out = [];
    if (req.files?.files) out.push(...req.files.files);
    if (req.files?.file) out.push(...req.files.file);
    req.files = out;
    next();
  },
  ctrl.uploadAttachment
);

router.delete('/:id/attachments/:attachmentId', ctrl.deleteAttachment);

router.post('/:id/delegate', ctrl.delegateTask);

module.exports = router;
