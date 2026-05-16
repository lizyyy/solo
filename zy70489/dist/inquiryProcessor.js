"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InquiryProcessor = void 0;
class InquiryProcessor {
    constructor(db) {
        this.db = db;
    }
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    findOriginalPermissionTicket(conclusions, inquiry) {
        const sortedConclusions = [...conclusions].sort((a, b) => a.createdAt - b.createdAt);
        for (const conclusion of sortedConclusions) {
            if (conclusion.previousPermissionTicket &&
                !conclusion.previousPermissionTicket.includes('CONCURRENT')) {
                return conclusion.previousPermissionTicket;
            }
        }
        return inquiry.permissionTicket || '未知';
    }
    async generateMockData() {
        const now = Date.now();
        const inquiries = [
            {
                id: this.generateId(),
                inquiryNo: 'XJ-2024-001',
                supplier: '深圳市华星电子科技有限公司',
                materialName: '服务器CPU Intel Xeon Gold 6330',
                quantity: 50,
                unitPrice: 12500,
                totalPrice: 625000,
                status: 'pending',
                permissionTicket: 'PERM-2024-0515-001',
                createdAt: now,
                updatedAt: now
            },
            {
                id: this.generateId(),
                inquiryNo: 'XJ-2024-002',
                supplier: '北京创新精密部件有限公司',
                materialName: 'DDR4 32GB ECC 服务器内存',
                quantity: 200,
                unitPrice: 1800,
                totalPrice: 360000,
                status: 'approved',
                permissionTicket: 'PERM-2024-0515-002',
                createdAt: now - 3600000,
                updatedAt: now - 3600000
            },
            {
                id: this.generateId(),
                inquiryNo: 'XJ-2024-003',
                supplier: '上海科创信息技术有限公司',
                materialName: '2TB NVMe SSD 企业级固态硬盘',
                quantity: 100,
                unitPrice: 3200,
                totalPrice: 320000,
                status: 'pending',
                permissionTicket: 'PERM-2024-0515-003',
                createdAt: now - 7200000,
                updatedAt: now - 7200000
            },
            {
                id: this.generateId(),
                inquiryNo: 'XJ-2024-004',
                supplier: '广州市鑫科网络设备有限公司',
                materialName: '万兆以太网交换机 48口',
                quantity: 20,
                unitPrice: 8500,
                totalPrice: 170000,
                status: 'rejected',
                permissionTicket: 'PERM-2024-0515-004',
                createdAt: now - 10800000,
                updatedAt: now - 10800000
            },
            {
                id: this.generateId(),
                inquiryNo: 'XJ-2024-005',
                supplier: '杭州云存储技术有限公司',
                materialName: '企业级路由器 40Gbps',
                quantity: 10,
                unitPrice: 25000,
                totalPrice: 250000,
                status: 'pending',
                permissionTicket: 'PERM-2024-0515-005',
                createdAt: now - 14400000,
                updatedAt: now - 14400000
            }
        ];
        await this.db.resetAllInquiryData();
        for (const inquiry of inquiries) {
            await this.db.insertPurchaseInquiry(inquiry);
        }
        return inquiries;
    }
    async simulateConcurrentWrite(inquiryId, concurrentCount = 3) {
        const inquiry = await this.db.getPurchaseInquiry(inquiryId);
        if (!inquiry) {
            throw new Error('询价单不存在');
        }
        const promises = [];
        for (let i = 0; i < concurrentCount; i++) {
            promises.push((async () => {
                const currentInquiry = await this.db.getPurchaseInquiry(inquiryId);
                if (currentInquiry) {
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
                    const updatedInquiry = { ...currentInquiry };
                    const previousPermissionTicket = currentInquiry.permissionTicket;
                    const newPermissionTicket = `PERM-CONCURRENT-${i}`;
                    updatedInquiry.status = i === 0 ? 'approved' : i === 1 ? 'rejected' : 'pending';
                    updatedInquiry.permissionTicket = newPermissionTicket;
                    updatedInquiry.updatedAt = Date.now();
                    await this.db.updatePurchaseInquiry(updatedInquiry);
                    const conclusion = {
                        id: this.generateId(),
                        inquiryId: inquiryId,
                        conclusion: i === 0 ? 'pass' : i === 1 ? 'fail' : 'review',
                        reason: `并发写入测试 - 实例${i + 1}`,
                        isManualCorrection: false,
                        previousPermissionTicket,
                        newPermissionTicket,
                        createdAt: Date.now()
                    };
                    await this.db.insertProcessingConclusion(conclusion);
                }
            })());
        }
        await Promise.all(promises);
    }
    async processInquiry(inquiryId, conclusion, reason) {
        const inquiry = await this.db.getPurchaseInquiry(inquiryId);
        if (!inquiry) {
            throw new Error('询价单不存在');
        }
        const processingConclusion = {
            id: this.generateId(),
            inquiryId,
            conclusion,
            reason,
            isManualCorrection: false,
            previousPermissionTicket: inquiry.permissionTicket,
            createdAt: Date.now()
        };
        await this.db.insertProcessingConclusion(processingConclusion);
        inquiry.status = conclusion === 'pass' ? 'approved' : conclusion === 'fail' ? 'rejected' : 'pending';
        inquiry.updatedAt = Date.now();
        await this.db.updatePurchaseInquiry(inquiry);
        return processingConclusion;
    }
    async manualCorrect(inquiryId, newConclusion, newReason, operator, remark, newPermissionTicket) {
        const inquiry = await this.db.getPurchaseInquiry(inquiryId);
        if (!inquiry) {
            throw new Error('询价单不存在');
        }
        const conclusions = await this.db.getProcessingConclusions(inquiryId);
        const lastConclusion = conclusions[0];
        const previousPermissionTicket = inquiry.permissionTicket;
        const correctionConclusion = {
            id: this.generateId(),
            inquiryId,
            conclusion: newConclusion,
            reason: newReason,
            operator,
            isManualCorrection: true,
            correctionRemark: remark,
            previousConclusion: lastConclusion?.conclusion,
            previousReason: lastConclusion?.reason,
            previousPermissionTicket,
            newPermissionTicket,
            createdAt: Date.now()
        };
        await this.db.insertProcessingConclusion(correctionConclusion);
        inquiry.status = newConclusion === 'pass' ? 'approved' : newConclusion === 'fail' ? 'rejected' : 'pending';
        if (newPermissionTicket !== undefined) {
            inquiry.permissionTicket = newPermissionTicket;
        }
        inquiry.updatedAt = Date.now();
        await this.db.updatePurchaseInquiry(inquiry);
        return correctionConclusion;
    }
    async generateSummary(inquiryId) {
        const inquiry = await this.db.getPurchaseInquiry(inquiryId);
        if (!inquiry) {
            throw new Error('询价单不存在');
        }
        const conclusions = await this.db.getProcessingConclusions(inquiryId);
        const existingSummary = await this.db.getMaterialSummary(inquiryId);
        const hasConcurrentIssue = conclusions.length > 1;
        let summary = `【采购询价单摘要\n`;
        summary += `询价单号: ${inquiry.inquiryNo}\n`;
        summary += `供应商: ${inquiry.supplier}\n`;
        summary += `材料名称: ${inquiry.materialName}\n`;
        summary += `数量: ${inquiry.quantity}\n`;
        summary += `单价: ${inquiry.unitPrice.toFixed(2)}\n`;
        summary += `总价: ${inquiry.totalPrice.toFixed(2)}\n`;
        summary += `当前状态: ${inquiry.status}\n`;
        summary += `处理记录数: ${conclusions.length}\n`;
        if (hasConcurrentIssue) {
            summary += `⚠️ 注意: 存在并发写入记录\n`;
        }
        let permissionTicketChanges = undefined;
        if (inquiry.permissionTicket) {
            const manualCorrections = conclusions.filter(c => c.isManualCorrection);
            const hasPermissionTicketCorrection = manualCorrections.some(c => c.previousPermissionTicket !== undefined || c.newPermissionTicket !== undefined);
            if (hasConcurrentIssue || hasPermissionTicketCorrection) {
                const ticketBefore = this.findOriginalPermissionTicket(conclusions, inquiry);
                const ticketAfter = inquiry.permissionTicket;
                const wasTicketCorrected = manualCorrections.some(c => c.newPermissionTicket !== undefined);
                const isTicketStillConcurrent = ticketAfter.includes('CONCURRENT');
                let correctionConclusion = '';
                if (wasTicketCorrected && !isTicketStillConcurrent) {
                    correctionConclusion = '已修正，权限票已恢复正常';
                }
                else if (wasTicketCorrected && isTicketStillConcurrent) {
                    correctionConclusion = '已修正，但权限票仍为并发测试值';
                }
                else {
                    correctionConclusion = '未修正，权限票仍为并发覆盖状态';
                }
                permissionTicketChanges = {
                    before: ticketBefore,
                    after: ticketAfter,
                    exception: '权限临时票在并发写入时被覆盖，导致权限验证失败',
                    correction: wasTicketCorrected ? '已执行人工修正权限票状态' : '尚未执行人工修正',
                    conclusion: correctionConclusion
                };
                summary += `\n【权限临时票变更记录:\n`;
                summary += `  - 变更前: ${permissionTicketChanges.before}\n`;
                summary += `  - 变更后: ${permissionTicketChanges.after}\n`;
                summary += `  - 异常: ${permissionTicketChanges.exception}\n`;
                summary += `  - 修正: ${permissionTicketChanges.correction}\n`;
                summary += `  - 结论: ${permissionTicketChanges.conclusion}\n`;
            }
        }
        const materialSummary = {
            id: this.generateId(),
            inquiryId,
            summary,
            permissionTicketChanges,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        if (existingSummary) {
            materialSummary.id = existingSummary.id;
            await this.db.updateMaterialSummary(materialSummary);
        }
        else {
            await this.db.insertMaterialSummary(materialSummary);
        }
        return materialSummary;
    }
    async getAllInquiries() {
        return this.db.getAllPurchaseInquiries();
    }
    async getConclusions(inquiryId) {
        return this.db.getProcessingConclusions(inquiryId);
    }
    async getAllSummaries() {
        return this.db.getAllMaterialSummaries();
    }
    async getInquiryFullHistory(inquiryId) {
        const inquiry = await this.db.getPurchaseInquiry(inquiryId);
        const conclusions = await this.db.getProcessingConclusions(inquiryId);
        const summary = await this.db.getMaterialSummary(inquiryId);
        return { inquiry, conclusions, summary };
    }
    async getAllInquiriesWithStatus() {
        const inquiries = await this.db.getAllPurchaseInquiries();
        const results = [];
        for (const inquiry of inquiries) {
            const conclusions = await this.db.getProcessingConclusions(inquiry.id);
            const summary = await this.db.getMaterialSummary(inquiry.id);
            const hasManualCorrection = conclusions.some(c => c.isManualCorrection);
            results.push({
                inquiry,
                conclusionsCount: conclusions.length,
                hasManualCorrection,
                hasSummary: !!summary
            });
        }
        return results;
    }
}
exports.InquiryProcessor = InquiryProcessor;
