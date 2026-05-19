"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServiceInstance = createServiceInstance;
exports.getServiceInstances = getServiceInstances;
exports.getServiceInstance = getServiceInstance;
exports.heartbeat = heartbeat;
exports.updateInstanceStatus = updateInstanceStatus;
exports.deleteServiceInstance = deleteServiceInstance;
const serviceInstance_service_1 = __importDefault(require("../services/serviceInstance.service"));
async function createServiceInstance(req, res, next) {
    try {
        const result = await serviceInstance_service_1.default.create(req.body);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function getServiceInstances(req, res, next) {
    try {
        const result = await serviceInstance_service_1.default.findAll({
            page: parseInt(req.query.page) || 1,
            pageSize: parseInt(req.query.pageSize) || 20,
            serviceName: req.query.serviceName,
            env: req.query.env,
            status: req.query.status,
        });
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function getServiceInstance(req, res, next) {
    try {
        const result = await serviceInstance_service_1.default.findById(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function heartbeat(req, res, next) {
    try {
        const result = await serviceInstance_service_1.default.heartbeat(req.body.instanceId, req.body.env);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function updateInstanceStatus(req, res, next) {
    try {
        const result = await serviceInstance_service_1.default.updateStatus(req.params.id, req.body.status);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function deleteServiceInstance(req, res, next) {
    try {
        const result = await serviceInstance_service_1.default.delete(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
