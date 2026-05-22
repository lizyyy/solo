"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchController = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const matchService_1 = require("../services/matchService");
const batchService_1 = require("../services/batchService");
const fileParser_1 = require("../utils/fileParser");
exports.matchController = {
    async uploadAndMatch(req, res) {
        try {
            const files = req.files;
            if (!files || files.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '请上传至少一个文件'
                });
            }
            const duplicateCheck = batchService_1.batchService.checkDuplicate(files);
            if (duplicateCheck.isDuplicate && duplicateCheck.existingBatch) {
                return res.status(400).json({
                    success: false,
                    message: '检测到重复批次',
                    duplicateError: batchService_1.batchService.createDuplicateError(duplicateCheck.existingBatch)
                });
            }
            let passengers = [];
            let drivers = [];
            let warehouses = [];
            let routeShifts = [];
            let imageIndexes = [];
            for (const file of files) {
                const ext = path.extname(file.originalname).toLowerCase();
                if (ext === '.json') {
                    const jsonContent = await (0, fileParser_1.parseJSON)(file.path);
                    const isArray = Array.isArray(jsonContent);
                    const items = isArray ? jsonContent : [jsonContent];
                    if (file.originalname.includes('route') || file.originalname.includes('线路') || file.originalname.includes('班次')) {
                        routeShifts = items.map(fileParser_1.transformRouteShift);
                    }
                    else if (file.originalname.includes('image') || file.originalname.includes('图片')) {
                        imageIndexes = items.map(fileParser_1.transformImageIndex);
                    }
                    else {
                        if (items.length > 0) {
                            const firstItem = items[0];
                            if ('shiftTime' in firstItem || '发车时间' in firstItem) {
                                routeShifts = items.map(fileParser_1.transformRouteShift);
                            }
                            else if ('imagePath' in firstItem || '图片路径' in firstItem) {
                                imageIndexes = items.map(fileParser_1.transformImageIndex);
                            }
                        }
                    }
                }
                else if (ext === '.csv') {
                    const fileContent = await (0, fileParser_1.parseCSV)(file.path);
                    if (file.originalname.includes('passenger') || file.originalname.includes('乘客')) {
                        passengers = fileContent.map(fileParser_1.transformPassengerRecord);
                    }
                    else if (file.originalname.includes('driver') || file.originalname.includes('司机')) {
                        drivers = fileContent.map(fileParser_1.transformDriverRecord);
                    }
                    else if (file.originalname.includes('warehouse') || file.originalname.includes('仓库')) {
                        warehouses = fileContent.map(fileParser_1.transformWarehouseRecord);
                    }
                    else {
                        if (fileContent.length > 0) {
                            const firstRow = fileContent[0];
                            if ('乘客姓名' in firstRow || 'passengerName' in firstRow) {
                                passengers = fileContent.map(fileParser_1.transformPassengerRecord);
                            }
                            else if ('司机姓名' in firstRow || 'driverName' in firstRow) {
                                drivers = fileContent.map(fileParser_1.transformDriverRecord);
                            }
                            else if ('存放位置' in firstRow || 'storageLocation' in firstRow) {
                                warehouses = fileContent.map(fileParser_1.transformWarehouseRecord);
                            }
                        }
                    }
                }
            }
            if (passengers.length === 0 && drivers.length === 0 && warehouses.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '未能识别任何有效数据，请检查文件格式'
                });
            }
            matchService_1.matchService.setData(passengers, drivers, warehouses, routeShifts, imageIndexes);
            const result = matchService_1.matchService.process();
            batchService_1.batchService.registerBatch(result.batchId, files);
            batchService_1.batchService.markBatchProcessed(result.batchId);
            for (const file of files) {
                try {
                    fs.unlinkSync(file.path);
                }
                catch (e) {
                    console.warn('删除临时文件失败:', file.path);
                }
            }
            res.json({
                success: true,
                data: {
                    batchId: result.batchId,
                    processDate: result.processDate,
                    statistics: result.statistics,
                    metadata: {
                        routeShiftsCount: routeShifts.length,
                        imageIndexesCount: imageIndexes.length
                    },
                    normalItems: {
                        count: result.normalItems.length,
                        description: '匹配度高，可直接确认认领',
                        items: result.normalItems
                    },
                    pendingItems: {
                        count: result.pendingItems.length,
                        description: '需要人工确认或缺少关联记录',
                        items: result.pendingItems
                    },
                    failedItems: {
                        count: result.failedItems.length,
                        description: '匹配失败或不符合规则，保留原始数据和处理建议',
                        items: result.failedItems
                    }
                }
            });
        }
        catch (error) {
            console.error('处理失败:', error);
            res.status(500).json({
                success: false,
                message: '处理失败',
                error: error instanceof Error ? error.message : '未知错误'
            });
        }
    },
    async getBatchHistory(req, res) {
        try {
            const history = batchService_1.batchService.getBatchHistory();
            res.json({
                success: true,
                data: history
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: '获取历史记录失败'
            });
        }
    },
    async healthCheck(req, res) {
        res.json({
            success: true,
            message: '失物匹配系统运行正常',
            timestamp: new Date().toISOString(),
            features: [
                '乘客报失-司机上交-仓库入库三方匹配',
                '同名物品智能识别',
                '逾期物品自动检测',
                '敏感信息自动脱敏',
                '重复批次防重机制',
                '线路班次数据验证',
                '图片索引关联支持',
                'CSV/JSON 混合格式支持'
            ]
        });
    }
};
