"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleController = void 0;
const RuleVersionDAO_1 = require("../models/RuleVersionDAO");
const RuleEngineService_1 = require("../services/RuleEngineService");
class RuleController {
    static createRule(req, res) {
        try {
            const { version, name, description, rules, effectiveFrom } = req.body;
            const createdBy = req.headers['x-user'] || 'system';
            const rule = RuleEngineService_1.RuleEngineService.createNewRuleVersion(version, name, description, rules, new Date(effectiveFrom), createdBy);
            res.status(201).json({ success: true, data: rule });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static getRule(req, res) {
        try {
            const { id } = req.params;
            const rule = RuleVersionDAO_1.RuleVersionDAO.getById(id);
            if (!rule) {
                return res.status(404).json({ success: false, error: '规则不存在' });
            }
            res.json({ success: true, data: rule });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static getActiveRule(req, res) {
        try {
            const rule = RuleVersionDAO_1.RuleVersionDAO.getActiveRule();
            res.json({ success: true, data: rule });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static getAllRules(req, res) {
        try {
            const rules = RuleVersionDAO_1.RuleVersionDAO.getAll();
            res.json({ success: true, data: rules });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static getRuleByDate(req, res) {
        try {
            const { date } = req.query;
            const rule = RuleVersionDAO_1.RuleVersionDAO.getByDate(new Date(date));
            res.json({ success: true, data: rule });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
}
exports.RuleController = RuleController;
//# sourceMappingURL=RuleController.js.map