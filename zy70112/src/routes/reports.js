const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');
const businessRules = require('../utils/rules');

router.post('/', (req, res) => {
    try {
        const { body } = req;
        const operator = req.headers['x-operator'] || 'system';
        
        const report = reportService.createReport(body, operator);
        
        res.status(201).json({
            success: true,
            data: report
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/', (req, res) => {
    try {
        const { status, farmer_name, crop_type, disaster_type } = req.query;
        const filters = {};
        
        if (status) filters.status = status;
        if (farmer_name) filters.farmer_name = farmer_name;
        if (crop_type) filters.crop_type = crop_type;
        if (disaster_type) filters.disaster_type = disaster_type;
        
        const reports = reportService.listReports(filters);
        
        res.json({
            success: true,
            data: reports
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const report = reportService.getReportById(id);
        
        if (!report) {
            return res.status(404).json({
                success: false,
                error: '报案不存在'
            });
        }
        
        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { body } = req;
        
        const report = reportService.updateReport(id, body);
        
        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/:id/submit', (req, res) => {
    try {
        const { id } = req.params;
        const operator = req.headers['x-operator'] || 'system';
        const reason = req.body.reason || '提交报案';
        
        const report = reportService.transitionStatus(id, 'SUBMITTED', operator, reason);
        
        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/:id/status', (req, res) => {
    try {
        const { id } = req.params;
        const { to_status, reason } = req.body;
        const operator = req.headers['x-operator'] || 'system';
        
        if (!to_status) {
            return res.status(400).json({
                success: false,
                error: '目标状态不能为空'
            });
        }
        
        const report = reportService.transitionStatus(id, to_status, operator, reason || '状态变更');
        
        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/:id/check-readiness', (req, res) => {
    try {
        const { id } = req.params;
        const report = reportService.getReportById(id);
        
        if (!report) {
            return res.status(404).json({
                success: false,
                error: '报案不存在'
            });
        }
        
        const readiness = businessRules.isReportReadyForSubmit({
            plotCount: report.summary.plot_count,
            weatherCount: report.summary.weather_count
        }, report.photos);
        
        res.json({
            success: true,
            data: readiness
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
