const express = require('express');
const { storeBankDetails, getBankDetails, listNigerianBanks, verifyBankAccountDetails } = require('../controllers/banks');

const router = express.Router();


const authMiddleware = require('../middlewares/authMiddleware');


router.post('/banks/store', authMiddleware('email'), storeBankDetails);

router.get('/banks/get', authMiddleware('email'), getBankDetails);

router.get('/banks/list', listNigerianBanks)

router.post('/banks/verify/details', verifyBankAccountDetails)


module.exports = router;
