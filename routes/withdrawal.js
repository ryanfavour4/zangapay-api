const express = require('express');
const { withdrawalWithFlutterwave, withdrawalWithPaystack, verifyTransferOtp } = require('../controllers/withdrawal');

const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');

router.post("/withdraw/paystack", authMiddleware('email'), withdrawalWithPaystack);



module.exports = router;
