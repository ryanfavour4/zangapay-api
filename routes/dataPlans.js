const express = require('express');
const { storeDataNetworks, fetchDataPlans, getMobileNetworkPlans } = require('../controllers/bills');

const router = express.Router();

router.post('/data/plans/store', storeDataNetworks);

router.get('/data/plans/get/:provider', fetchDataPlans);

router.get('/data/api/get', getMobileNetworkPlans)



module.exports = router;
