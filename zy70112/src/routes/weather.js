const express = require('express');
const router = express.Router();
const weatherService = require('../services/weatherService');
const reportService = require('../services/reportService');

router.post('/:reportId/weather', (req, res) => {
    try {
        const { reportId } = req.params;
        const { body } = req;
        
        const evidence = weatherService.addWeatherEvidence(reportId, body);
        const report = reportService.getReportById(reportId);
        
        res.status(201).json({
            success: true,
            data: {
                evidence,
                report_summary: {
                    weather_count: report.summary.weather_count
                }
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/:reportId/weather', (req, res) => {
    try {
        const { reportId } = req.params;
        const evidences = weatherService.getWeatherByReportId(reportId);
        
        res.json({
            success: true,
            data: evidences
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.delete('/weather/:evidenceId', (req, res) => {
    try {
        const { evidenceId } = req.params;
        
        weatherService.deleteWeatherEvidence(evidenceId);
        
        res.json({
            success: true,
            message: '天气证据已删除'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
