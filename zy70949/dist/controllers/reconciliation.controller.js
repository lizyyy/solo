"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconciliationController = void 0;
const fileParser_service_1 = require("../services/fileParser.service");
const processing_service_1 = require("../services/processing.service");
class ReconciliationController {
    constructor() {
        this.fileParserService = new fileParser_service_1.FileParserService();
        this.processingService = new processing_service_1.ProcessingService();
    }
    async processFiles(req, res) {
        try {
            const files = req.files;
            if (!files || (Array.isArray(files) && files.length === 0)) {
                res.status(400).json({ error: '未上传任何文件，请上传至少一个加项 CSV 文件' });
                return;
            }
            let addItemsPath;
            let packagesPath;
            let unitAgreementPath;
            let couponsPath;
            const filePaths = [];
            if (Array.isArray(files)) {
                files.forEach(file => {
                    const fieldName = file.fieldname;
                    filePaths.push(file.path);
                    if (fieldName === 'addItems')
                        addItemsPath = file.path;
                    else if (fieldName === 'packages')
                        packagesPath = file.path;
                    else if (fieldName === 'unitAgreements')
                        unitAgreementPath = file.path;
                    else if (fieldName === 'coupons')
                        couponsPath = file.path;
                });
            }
            else {
                Object.entries(files).forEach(([fieldName, fileArr]) => {
                    const file = fileArr[0];
                    filePaths.push(file.path);
                    if (fieldName === 'addItems')
                        addItemsPath = file.path;
                    else if (fieldName === 'packages')
                        packagesPath = file.path;
                    else if (fieldName === 'unitAgreements')
                        unitAgreementPath = file.path;
                    else if (fieldName === 'coupons')
                        couponsPath = file.path;
                });
            }
            if (!addItemsPath) {
                res.status(400).json({ error: '缺少加项 CSV 文件，请使用 addItems 字段名上传' });
                return;
            }
            const parsedData = await this.fileParserService.parseAllFiles(addItemsPath, packagesPath, unitAgreementPath, couponsPath);
            const result = await this.processingService.processBatch(parsedData, filePaths);
            res.json({
                success: true,
                message: result.warnings.length > 0 ? '处理完成，有警告信息' : '处理完成',
                data: result,
            });
        }
        catch (error) {
            console.error('处理文件时出错:', error);
            res.status(500).json({
                success: false,
                error: '文件处理失败',
                details: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async processInlineData(req, res) {
        try {
            const { addItems, packages, unitAgreements, coupons, batchId } = req.body;
            if (!addItems || !Array.isArray(addItems) || addItems.length === 0) {
                res.status(400).json({ error: '缺少加项数据 addItems，请在请求体中传入加项记录数组' });
                return;
            }
            const parsedData = {
                addItems: addItems.map(item => this.fileParserService['mapToAddItemRecord'](item)),
                packages: packages || [],
                unitAgreements: unitAgreements || [],
                coupons: coupons || [],
            };
            const result = await this.processingService.processBatch(parsedData);
            res.json({
                success: true,
                message: '处理完成',
                data: result,
            });
        }
        catch (error) {
            console.error('处理数据时出错:', error);
            res.status(500).json({
                success: false,
                error: '数据处理失败',
                details: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async getHealthCheck(req, res) {
        res.json({
            status: 'ok',
            service: '体检中心财务对账 API',
            version: '1.0.0',
            description: '用于解决加项、优惠券和单位结算账单导入混乱问题',
            endpoints: {
                'POST /api/reconciliation/upload': '上传文件进行批量对账处理',
                'POST /api/reconciliation/process': '直接提交 JSON 数据进行对账处理',
                'GET /api/reconciliation/rules': '查看当前支持的业务规则列表',
            },
        });
    }
    async getRules(req, res) {
        res.json({
            rules: [
                {
                    category: '套餐验证',
                    rules: [
                        { code: 'PACKAGE_NOT_FOUND', name: '套餐不存在', severity: 'pending' },
                        { code: 'ITEM_ALREADY_INCLUDED', name: '项目已包含在套餐中', severity: 'failed' },
                        { code: 'ITEM_NOT_ADDABLE', name: '项目不在允许加项范围内', severity: 'pending' },
                    ],
                },
                {
                    category: '退项冲正',
                    rules: [
                        { code: 'REFUND_WITHOUT_ORIGINAL', name: '退项缺少原始记录ID', severity: 'failed' },
                        { code: 'REFUND_ORIGINAL_NOT_FOUND', name: '原始记录未找到', severity: 'pending' },
                        { code: 'REFUND_OF_REFUND', name: '禁止二次冲正', severity: 'failed' },
                        { code: 'REFUND_ITEM_MISMATCH', name: '退项项目与原始不一致', severity: 'pending' },
                        { code: 'REFUND_EXCEEDS_ORIGINAL', name: '退项金额超过原始', severity: 'failed' },
                        { code: 'REFUND_CUMULATIVE_EXCEEDED', name: '累计退项超出原始', severity: 'failed' },
                    ],
                },
                {
                    category: '优惠券叠加',
                    rules: [
                        { code: 'COUPON_NOT_FOUND', name: '优惠券不存在', severity: 'pending' },
                        { code: 'COUPON_NOT_YET_VALID', name: '优惠券尚未生效', severity: 'failed' },
                        { code: 'COUPON_EXPIRED', name: '优惠券已过期', severity: 'failed' },
                        { code: 'COUPON_NOT_APPLICABLE', name: '优惠券不适用于该项目', severity: 'failed' },
                        { code: 'COUPON_MIN_NOT_MET', name: '未达最低消费', severity: 'failed' },
                        { code: 'COUPON_STACK_LIMIT', name: '优惠券叠加已达上限', severity: 'failed' },
                        { code: 'COUPON_CASH_EXCEEDED', name: '现金券抵扣超额', severity: 'failed' },
                    ],
                },
                {
                    category: '单位限额',
                    rules: [
                        { code: 'UNIT_NOT_FOUND', name: '单位协议不存在', severity: 'pending' },
                        { code: 'UNIT_AGREEMENT_EXPIRED', name: '单位协议过期', severity: 'failed' },
                        { code: 'EMPLOYEE_NOT_ELIGIBLE', name: '客户不在员工名单', severity: 'pending' },
                        { code: 'PACKAGE_NOT_ALLOWED', name: '套餐不在协议范围', severity: 'failed' },
                        { code: 'UNIT_QUOTA_EXCEEDED', name: '单位额度不足', severity: 'failed' },
                    ],
                },
            ],
        });
    }
}
exports.ReconciliationController = ReconciliationController;
