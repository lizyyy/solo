"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyChangeController = void 0;
const DependencyChangeDAO_1 = require("../models/DependencyChangeDAO");
class DependencyChangeController {
    static createChange(req, res) {
        try {
            const { dependencyName, oldVersion, newVersion, changeReason, requester } = req.body;
            const change = DependencyChangeDAO_1.DependencyChangeDAO.create({
                dependencyName,
                oldVersion,
                newVersion,
                changeReason,
                requester,
                status: 'pending'
            });
            res.status(201).json({ success: true, data: change });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static getChange(req, res) {
        try {
            const { id } = req.params;
            const change = DependencyChangeDAO_1.DependencyChangeDAO.getById(id);
            if (!change) {
                return res.status(404).json({ success: false, error: '变更记录不存在' });
            }
            res.json({ success: true, data: change });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static getAllChanges(req, res) {
        try {
            const { status } = req.query;
            const changes = DependencyChangeDAO_1.DependencyChangeDAO.getAll(status);
            res.json({ success: true, data: changes });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static approveChange(req, res) {
        try {
            const { id } = req.params;
            const approver = req.headers['x-user'] || 'system';
            const change = DependencyChangeDAO_1.DependencyChangeDAO.approve(id, approver);
            if (!change) {
                return res.status(404).json({ success: false, error: '变更记录不存在' });
            }
            res.json({ success: true, data: change });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    static rejectChange(req, res) {
        try {
            const { id } = req.params;
            const approver = req.headers['x-user'] || 'system';
            const change = DependencyChangeDAO_1.DependencyChangeDAO.reject(id, approver);
            if (!change) {
                return res.status(404).json({ success: false, error: '变更记录不存在' });
            }
            res.json({ success: true, data: change });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
}
exports.DependencyChangeController = DependencyChangeController;
//# sourceMappingURL=DependencyChangeController.js.map