const router = require('express').Router();
const ctrl = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');
const { restrictTo } = require('../middlewares/roleMiddleware');

router.use(protect);

// Picker — contacts by default, full org behind ?all=true.
// Available to all roles; backend enforces what each role can see.
router.get('/picker', ctrl.picker);

router.get('/', restrictTo('Admin', 'HOD'), ctrl.listUsers);
router.post('/', restrictTo('Admin'), ctrl.createUser);

router.get('/:id', ctrl.getUser);
router.put('/:id', ctrl.updateUser);
router.delete('/:id', restrictTo('Admin'), ctrl.deleteUser);

// Contacts (per-user "people I work with" list)
router.get('/:id/contacts', ctrl.listContacts);
router.post('/:id/contacts', ctrl.addContacts);
router.delete('/:id/contacts/:contactId', ctrl.removeContact);

module.exports = router;
