const express = require('express');
const router = express.Router();
const historyController = require('../controllers/historyController');

router.get('/contract/:contractId/full', historyController.getContractFullHistory);

router.get('/contract/:contractId/versions', historyController.getAllVersions);

router.get('/contract/:contractId/versions/frozen', historyController.getFrozenVersions);

router.get('/contract/:contractId/versions/:version', historyController.getVersionDetails);

router.get('/contract/:contractId/versions/compare/:version1/:version2', historyController.compareVersions);

router.get('/contract/:contractId/version-timeline', historyController.getVersionTimeline);

router.get('/contract/:contractId/state-transitions', historyController.getStateTransitionHistory);

router.get('/contract/:contractId/callbacks', historyController.getCallbackHistory);

router.get('/contract/:contractId/party/:partyId', historyController.getPartySigningHistory);

router.get('/contract/:contractId/compensations', historyController.getCompensationHistory);

module.exports = router;
