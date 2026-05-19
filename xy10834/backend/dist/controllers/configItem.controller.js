"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConfigItem = createConfigItem;
exports.getConfigItems = getConfigItems;
exports.getConfigItem = getConfigItem;
exports.updateConfigItem = updateConfigItem;
exports.deleteConfigItem = deleteConfigItem;
const configItem_service_1 = __importDefault(require("../services/configItem.service"));
async function createConfigItem(req, res, next) {
    try {
        const result = await configItem_service_1.default.create(req.body);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function getConfigItems(req, res, next) {
    try {
        const result = await configItem_service_1.default.findAll({
            page: parseInt(req.query.page) || 1,
            pageSize: parseInt(req.query.pageSize) || 20,
            status: req.query.status,
            key: req.query.key,
        });
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function getConfigItem(req, res, next) {
    try {
        const result = await configItem_service_1.default.findById(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function updateConfigItem(req, res, next) {
    try {
        const result = await configItem_service_1.default.update(req.params.id, req.body);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function deleteConfigItem(req, res, next) {
    try {
        const result = await configItem_service_1.default.delete(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
