const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const exportService = require('../services/exportService');

router.get('/export/reports', (req, res) => {
    try {
        const { status, crop_type, disaster_type, format } = req.query;
        const filters = {};
        
        if (status) filters.status = status;
        if (crop_type) filters.crop_type = crop_type;
        if (disaster_type) filters.disaster_type = disaster_type;
        
        const data = exportService.exportReportsForReview(filters);
        
        if (format === 'csv') {
            const fields = [
                '报案编号', '农户姓名', '农户身份证', '联系电话', '保单号',
                '作物类型', '灾害类型', '灾害发生时间', '当前状态',
                '地块数量', '天气证据数量', '照片数量',
                '查勘员', '查勘状态', '查勘时间',
                '估算赔付金额', '实际赔付金额', '受损面积', '受损比例',
                '创建时间', '最后更新时间',
                '地块信息', '天气证据', '照片信息', '状态变更历史'
            ];
            
            const json2csvParser = new Parser({ fields });
            const csv = json2csvParser.parse(data);
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename=reports_review.csv');
            res.send('\uFEFF' + csv);
        } else {
            res.json({
                success: true,
                data: data
            });
        }
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/export/summary', (req, res) => {
    try {
        const { crop_type, disaster_type, format } = req.query;
        const filters = {};
        
        if (crop_type) filters.crop_type = crop_type;
        if (disaster_type) filters.disaster_type = disaster_type;
        
        const summary = exportService.exportSummary(filters);
        
        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
