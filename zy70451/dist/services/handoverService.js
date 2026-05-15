"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handoverService = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
const fileStore_1 = require("../store/fileStore");
class HandoverService {
    generateFormNo() {
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `HJ${dateStr}${random}`;
    }
    now() {
        return new Date().toISOString();
    }
    addHistoryRecord(resourceType, resourceId, resourceRange, action, reason, operator, beforeChange, afterChange) {
        const record = {
            id: (0, uuid_1.v4)(),
            resourceType,
            resourceId,
            resourceRange,
            action,
            reason,
            operator,
            beforeChange,
            afterChange,
            createdAt: this.now()
        };
        fileStore_1.fileStore.addHistoryRecord(record);
    }
    createHandoverForm(request) {
        const serviceRecords = request.serviceRecords.map(sr => ({
            ...sr,
            id: (0, uuid_1.v4)(),
            status: sr.status || types_1.ServiceStatus.PENDING,
            materialSummaries: sr.materialSummaries || [],
            remarks: sr.remarks || [],
            systemConclusion: sr.systemConclusion || '',
            createdAt: this.now(),
            updatedAt: this.now()
        }));
        const form = {
            id: (0, uuid_1.v4)(),
            formNo: this.generateFormNo(),
            tenantId: request.tenantId,
            tenantName: request.tenantName,
            handler: request.handler,
            status: types_1.RecordStatus.PENDING,
            serviceRecords,
            createdAt: this.now(),
            updatedAt: this.now()
        };
        fileStore_1.fileStore.saveHandoverForm(form);
        this.addHistoryRecord('handover_form', form.id, `tenant:${request.tenantId}`, 'create', '创建交接单', request.handler);
        return form;
    }
    getHandoverForm(id) {
        return fileStore_1.fileStore.getHandoverFormById(id);
    }
    getAllHandoverForms() {
        return fileStore_1.fileStore.getHandoverForms();
    }
    validateVersionConsistency(serviceRecord) {
        const hasMismatch = serviceRecord.versions.some(v => !v.isMatch);
        const updatedRecord = { ...serviceRecord };
        if (hasMismatch) {
            updatedRecord.status = types_1.ServiceStatus.ABNORMAL;
            const mismatchedServices = serviceRecord.versions
                .filter(v => !v.isMatch)
                .map(v => `${v.serviceName}(期望:${v.expectedVersion},实际:${v.actualVersion})`)
                .join('; ');
            updatedRecord.systemConclusion = `版本不一致: ${mismatchedServices}`;
        }
        else {
            updatedRecord.status = types_1.ServiceStatus.NORMAL;
            updatedRecord.systemConclusion = '所有服务版本校验通过';
        }
        updatedRecord.updatedAt = this.now();
        return updatedRecord;
    }
    processHandoverForm(formId) {
        const form = fileStore_1.fileStore.getHandoverFormById(formId);
        if (!form) {
            throw new Error(`交接单不存在: ${formId}`);
        }
        const beforeChange = { status: form.status, serviceRecords: form.serviceRecords };
        const processedRecords = form.serviceRecords.map(sr => this.validateVersionConsistency(sr));
        const allNormal = processedRecords.every(sr => sr.status === types_1.ServiceStatus.NORMAL);
        const allAbnormal = processedRecords.every(sr => sr.status === types_1.ServiceStatus.ABNORMAL);
        let status;
        if (allNormal) {
            status = types_1.RecordStatus.SUCCESS;
        }
        else if (allAbnormal) {
            status = types_1.RecordStatus.FAILED;
        }
        else {
            status = types_1.RecordStatus.PARTIAL_SUCCESS;
        }
        const updatedForm = {
            ...form,
            serviceRecords: processedRecords,
            status,
            updatedAt: this.now()
        };
        fileStore_1.fileStore.saveHandoverForm(updatedForm);
        this.addHistoryRecord('handover_form', formId, `tenant:${form.tenantId}`, 'process', '处理交接单，执行版本一致性校验', form.handler, beforeChange, { status: updatedForm.status, serviceRecords: processedRecords });
        return updatedForm;
    }
    manualFix(formId, request) {
        const form = fileStore_1.fileStore.getHandoverFormById(formId);
        if (!form) {
            throw new Error(`交接单不存在: ${formId}`);
        }
        const serviceRecordIndex = form.serviceRecords.findIndex(sr => sr.id === request.serviceRecordId);
        if (serviceRecordIndex === -1) {
            throw new Error(`服务记录不存在: ${request.serviceRecordId}`);
        }
        const beforeChange = { ...form.serviceRecords[serviceRecordIndex] };
        const updatedRecords = [...form.serviceRecords];
        const targetRecord = { ...updatedRecords[serviceRecordIndex] };
        const remark = {
            id: (0, uuid_1.v4)(),
            content: request.remark,
            operator: request.operator,
            createdAt: this.now()
        };
        targetRecord.remarks = [...targetRecord.remarks, remark];
        targetRecord.manualConclusion = request.manualConclusion;
        targetRecord.status = types_1.ServiceStatus.MANUAL_FIXED;
        targetRecord.updatedAt = this.now();
        updatedRecords[serviceRecordIndex] = targetRecord;
        const updatedForm = {
            ...form,
            serviceRecords: updatedRecords,
            updatedAt: this.now()
        };
        fileStore_1.fileStore.saveHandoverForm(updatedForm);
        this.addHistoryRecord('service_record', request.serviceRecordId, `tenant:${form.tenantId},form:${formId}`, 'manual_fix', request.remark, request.operator, beforeChange, targetRecord);
        return updatedForm;
    }
    addMaterialSummary(formId, serviceRecordId, type, content) {
        const form = fileStore_1.fileStore.getHandoverFormById(formId);
        if (!form) {
            throw new Error(`交接单不存在: ${formId}`);
        }
        const serviceRecordIndex = form.serviceRecords.findIndex(sr => sr.id === serviceRecordId);
        if (serviceRecordIndex === -1) {
            throw new Error(`服务记录不存在: ${serviceRecordId}`);
        }
        const summary = {
            id: (0, uuid_1.v4)(),
            type,
            content,
            createdAt: this.now()
        };
        const updatedRecords = [...form.serviceRecords];
        const targetRecord = { ...updatedRecords[serviceRecordIndex] };
        targetRecord.materialSummaries = [...targetRecord.materialSummaries, summary];
        targetRecord.updatedAt = this.now();
        updatedRecords[serviceRecordIndex] = targetRecord;
        const updatedForm = {
            ...form,
            serviceRecords: updatedRecords,
            updatedAt: this.now()
        };
        fileStore_1.fileStore.saveHandoverForm(updatedForm);
        return updatedForm;
    }
    getHistoryByResourceRange(resourceRange) {
        const allHistory = fileStore_1.fileStore.getHistoryRecords();
        return allHistory.filter(h => h.resourceRange.includes(resourceRange));
    }
    getAllHistory() {
        return fileStore_1.fileStore.getHistoryRecords();
    }
}
exports.handoverService = new HandoverService();
