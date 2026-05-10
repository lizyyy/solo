const express = require('express');
const router = express.Router();
const claimService = require('../services/claimService');

router.post('/:reportId/claims', (req, res) => {
    try {
        const { reportId } = req.params;
        const { body } = req;
        const operator = req.headers['x-operator'] || 'system';
        
        const claim = claimService.createClaim(reportId, body, operator);
        
        res.status(201).json({
            success: true,
            data: claim
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/:reportId/claims', (req, res) => {
    try {
        const { reportId } = req.params;
        const claims = claimService.getClaimsByReportId(reportId);
        
        res.json({
            success: true,
            data: claims
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/claims/:claimId/approve', (req, res) => {
    try {
        const { claimId } = req.params;
        const { actual_amount } = req.body;
        const operator = req.headers['x-operator'] || 'system';
        
        const claim = claimService.approveClaim(claimId, actual_amount, operator);
        
        res.json({
            success: true,
            data: claim
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
