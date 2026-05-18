"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quoteController = void 0;
const quoteService_1 = require("../services/quoteService");
function handleError(error, res) {
    const err = error;
    let response = { success: false };
    if (err.message.startsWith('QUOTE_NOT_FOUND')) {
        response.error = {
            code: 'QUOTE_NOT_FOUND',
            message: '报价记录不存在',
            suggestedAction: '请检查报价ID是否正确'
        };
        res.status(404);
    }
    else if (err.message.startsWith('INVALID_STATUS')) {
        response.error = {
            code: 'INVALID_STATUS',
            message: '当前报价状态不支持此操作',
            suggestedAction: '请检查报价当前状态是否允许执行此操作'
        };
        res.status(400);
    }
    else if (err.message.startsWith('QUOTE_REJECTED:')) {
        const reason = err.message.replace('QUOTE_REJECTED:', '');
        response.error = {
            code: 'QUOTE_REJECTED',
            message: reason,
            suggestedAction: '请根据错误提示修正报价信息后重新提交，或转人工审核'
        };
        res.status(400);
    }
    else if (err.message.startsWith('CHANGE_RECORD_NOT_FOUND')) {
        response.error = {
            code: 'CHANGE_RECORD_NOT_FOUND',
            message: '变更记录不存在',
            suggestedAction: '请检查变更记录ID是否正确'
        };
        res.status(404);
    }
    else {
        response.error = {
            code: 'INTERNAL_ERROR',
            message: '系统内部错误',
            suggestedAction: '请稍后重试或联系技术支持'
        };
        res.status(500);
    }
    res.json(response);
}
exports.quoteController = {
    async getAllQuotes(req, res) {
        try {
            const quotes = await quoteService_1.quoteService.getAllQuotes();
            const response = {
                success: true,
                data: {
                    quotes,
                    total: quotes.length
                }
            };
            res.json(response);
        }
        catch (error) {
            handleError(error, res);
        }
    },
    async getQuoteById(req, res) {
        try {
            const { id } = req.params;
            const quote = await quoteService_1.quoteService.getQuoteById(id);
            if (!quote) {
                const response = {
                    success: false,
                    error: {
                        code: 'QUOTE_NOT_FOUND',
                        message: '报价记录不存在',
                        suggestedAction: '请检查报价ID是否正确'
                    }
                };
                return res.status(404).json(response);
            }
            const response = {
                success: true,
                data: quote
            };
            res.json(response);
        }
        catch (error) {
            handleError(error, res);
        }
    },
    async getQuoteByNumber(req, res) {
        try {
            const { number } = req.params;
            const quote = await quoteService_1.quoteService.getQuoteByNumber(number);
            if (!quote) {
                const response = {
                    success: false,
                    error: {
                        code: 'QUOTE_NOT_FOUND',
                        message: '报价记录不存在',
                        suggestedAction: '请检查报价单号是否正确'
                    }
                };
                return res.status(404).json(response);
            }
            const response = {
                success: true,
                data: quote
            };
            res.json(response);
        }
        catch (error) {
            handleError(error, res);
        }
    },
    async createQuote(req, res) {
        try {
            const quote = await quoteService_1.quoteService.createQuote(req.body);
            const response = {
                success: true,
                data: quote
            };
            res.status(201).json(response);
        }
        catch (error) {
            handleError(error, res);
        }
    },
    async submitForApproval(req, res) {
        try {
            const { id } = req.params;
            const { operator } = req.body;
            const quote = await quoteService_1.quoteService.submitForApproval(id, operator);
            const response = {
                success: true,
                data: quote
            };
            res.json(response);
        }
        catch (error) {
            handleError(error, res);
        }
    },
    async customerAcceptQuote(req, res) {
        try {
            const { id } = req.params;
            const { customerName } = req.body;
            const quote = await quoteService_1.quoteService.customerAcceptQuote(id, customerName);
            const response = {
                success: true,
                data: quote
            };
            res.json(response);
        }
        catch (error) {
            handleError(error, res);
        }
    },
    async addHiddenFault(req, res) {
        try {
            const { id } = req.params;
            const { faultItem, partItems, reason, operator } = req.body;
            const result = await quoteService_1.quoteService.addHiddenFault(id, faultItem, partItems, reason, operator);
            const response = {
                success: true,
                data: result
            };
            res.json(response);
        }
        catch (error) {
            handleError(error, res);
        }
    },
    async reviewSupplement(req, res) {
        try {
            const { id, recordId } = req.params;
            const { approved, reviewer, notes } = req.body;
            const result = await quoteService_1.quoteService.reviewSupplement(id, recordId, approved, reviewer, notes);
            const response = {
                success: true,
                data: result
            };
            res.json(response);
        }
        catch (error) {
            handleError(error, res);
        }
    },
    async completeQuote(req, res) {
        try {
            const { id } = req.params;
            const { operator } = req.body;
            const quote = await quoteService_1.quoteService.completeQuote(id, operator);
            const response = {
                success: true,
                data: quote
            };
            res.json(response);
        }
        catch (error) {
            handleError(error, res);
        }
    },
    async getChangeRecords(req, res) {
        try {
            const { id } = req.params;
            const records = await quoteService_1.quoteService.getChangeRecords(id);
            const response = {
                success: true,
                data: {
                    records,
                    total: records.length
                }
            };
            res.json(response);
        }
        catch (error) {
            handleError(error, res);
        }
    }
};
