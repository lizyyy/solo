const express = require('express');
const router = express.Router();
const dispatchService = require('../services/dispatchService');
const reportService = require('../services/reportService');

router.post('/:reportId/dispatches', (req, res) => {
    try {
        const { reportId } = req.params;
        const { body } = req;
        const operator = req.headers['x-operator'] || 'system';
        
        const dispatch = dispatchService.createDispatch(reportId, body, operator);
        
        reportService.transitionStatus(reportId, 'DISPATCHED', operator, `派工给: ${body.inspector_name}`);
        
        res.status(201).json({
            success: true,
            data: dispatch
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/:reportId/dispatches', (req, res) => {
    try {
        const { reportId } = req.params;
        const dispatches = dispatchService.getDispatchesByReportId(reportId);
        
        res.json({
            success: true,
            data: dispatches
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.put('/dispatches/:dispatchId', (req, res) => {
    try {
        const { dispatchId } = req.params;
        const { body } = req;
        const operator = req.headers['x-operator'] || 'system';
        
        const dispatch = dispatchService.updateDispatch(dispatchId, body);
        
        if (body.status === 'COMPLETED') {
            reportService.transitionStatus(dispatch.report_id, 'INSPECTED', operator, '查勘完成');
        }
        
        res.json({
            success: true,
            data: dispatch
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
