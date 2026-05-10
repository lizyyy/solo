const express = require('express');
const router = express.Router();
const plotService = require('../services/plotService');
const reportService = require('../services/reportService');

router.post('/:reportId/plots', (req, res) => {
    try {
        const { reportId } = req.params;
        const { body } = req;
        
        const plot = plotService.addPlot(reportId, body);
        const report = reportService.getReportById(reportId);
        
        res.status(201).json({
            success: true,
            data: {
                plot,
                report_summary: {
                    plot_count: report.summary.plot_count
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

router.get('/:reportId/plots', (req, res) => {
    try {
        const { reportId } = req.params;
        const plots = plotService.getPlotsByReportId(reportId);
        
        res.json({
            success: true,
            data: plots
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.delete('/plots/:plotId', (req, res) => {
    try {
        const { plotId } = req.params;
        
        plotService.deletePlot(plotId);
        
        res.json({
            success: true,
            message: '地块已删除'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
