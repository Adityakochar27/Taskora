const router = require('express').Router();
const ctrl = require('../controllers/whatsappController');
const { protect } = require('../middlewares/authMiddleware');
const { restrictTo } = require('../middlewares/roleMiddleware');
const { validateTwilioSignature } = require('../middlewares/twilioSignature');

// Twilio webhook — signature is verified when TWILIO_AUTH_TOKEN is set;
// otherwise validation is skipped (dev convenience).
router.post('/inbound', validateTwilioSignature, ctrl.inbound);

// Diagnostic — admin only.
router.post('/test/parse', protect, restrictTo('Admin'), ctrl.testParse);

module.exports = router;
