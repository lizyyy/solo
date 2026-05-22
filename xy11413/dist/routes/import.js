"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const importService_1 = require("../services/importService");
const router = (0, express_1.Router)();
router.post('/:sourceType', auth_1.authenticate, (0, auth_1.requirePermission)('import'), async (req, res) => {
    try {
        const sourceType = req.params.sourceType;
        const { fileName, records } = req.body;
        const importedBy = req.user?.username || 'system';
        if (!['order', 'waste', 'price', 'supplement'].includes(sourceType)) {
            res.status(400).json({ error: '无效的数据源类型', code: 'INVALID_SOURCE_TYPE' });
            return;
        }
        if (!fileName || !records || !Array.isArray(records)) {
            res.status(400).json({ error: '缺少必要参数', code: 'MISSING_PARAMS' });
            return;
        }
        const fileContent = JSON.stringify(records);
        const sourceId = await (0, importService_1.createImportSource)(fileName, fileContent, sourceType, importedBy);
        let result;
        switch (sourceType) {
            case 'order':
                result = await (0, importService_1.importOrderItems)(sourceId, records, fileName);
                break;
            case 'waste':
                result = await (0, importService_1.importWasteRecords)(sourceId, records, fileName);
                break;
            case 'price':
                result = await (0, importService_1.importHeadquarterPrices)(sourceId, records, fileName);
                break;
            case 'supplement':
                result = await (0, importService_1.importSupplementRecords)(sourceId, records, fileName);
                break;
        }
        res.json({
            success: true,
            data: {
                ...result,
                sourceType,
                fileName,
                importedBy
            }
        });
    }
    catch (error) {
        console.error('导入失败:', error);
        res.status(500).json({
            error: '导入失败',
            code: 'IMPORT_FAILED',
            message: error instanceof Error ? error.message : '未知错误'
        });
    }
});
exports.default = router;
