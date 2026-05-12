"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultEngine = exports.BusinessRulesEngine = void 0;
const store_1 = require("../storage/store");
class BusinessRulesEngine {
    constructor(store = store_1.defaultStore) {
        this.store = store;
    }
    validateAll() {
        this.store.clearIssues();
        const issues = [];
        const milestones = this.store.getAllMilestones();
        for (const milestone of milestones) {
            const milestoneIssues = this.validateMilestone(milestone);
            issues.push(...milestoneIssues);
        }
        const payments = this.store.getAllPaymentRecords();
        for (const payment of payments) {
            if (payment.status === "unmatched") {
                issues.push({
                    id: "",
                    type: "warning",
                    entityType: "paymentRecord",
                    entityId: payment.id,
                    code: "PY001",
                    message: `收款流水 ${payment.paymentNo} 未匹配到任何发票或里程碑`,
                    severity: "high",
                    suggestion: "手动匹配该收款到对应的发票或里程碑",
                    createdAt: new Date().toISOString(),
                });
            }
        }
        for (const issue of issues) {
            this.store.addIssue(issue);
        }
        this.updateMilestoneStatuses();
        return issues;
    }
    validateMilestone(milestone) {
        const issues = [];
        const deliveryProofs = this.store.getDeliveryProofsByMilestoneId(milestone.id);
        const acceptanceForms = this.store.getAcceptanceFormsByMilestoneId(milestone.id);
        const invoices = this.store.getInvoicesByMilestoneId(milestone.id);
        const payments = this.store.getPaymentRecordsByMilestoneId(milestone.id);
        const approvedDelivery = deliveryProofs.find((p) => p.status === "approved");
        const signedAcceptance = acceptanceForms.find((f) => f.status === "signed");
        const issuedInvoices = invoices.filter((i) => i.status === "issued" || i.status === "received");
        const matchedPayments = payments.filter((p) => p.status === "matched" || p.status === "partially_matched");
        if (signedAcceptance && !approvedDelivery) {
            issues.push({
                id: "",
                type: "error",
                entityType: "milestone",
                entityId: milestone.id,
                code: "AC001",
                message: `里程碑 ${milestone.milestoneNo} 有验收单但无已批准的交付证明`,
                severity: "critical",
                suggestion: "先提交并获得交付证明的批准",
                createdAt: new Date().toISOString(),
            });
        }
        if (signedAcceptance && approvedDelivery) {
            const deliveryDate = new Date(approvedDelivery.deliveryDate);
            const acceptanceDate = new Date(signedAcceptance.acceptanceDate);
            if (acceptanceDate < deliveryDate) {
                issues.push({
                    id: "",
                    type: "error",
                    entityType: "acceptanceForm",
                    entityId: signedAcceptance.id,
                    code: "AC002",
                    message: `验收单 ${signedAcceptance.formNo} 验收日期早于交付日期`,
                    severity: "critical",
                    suggestion: "检查验收日期是否正确，验收日期应晚于或等于交付日期",
                    createdAt: new Date().toISOString(),
                });
            }
        }
        const totalInvoiced = issuedInvoices.reduce((sum, inv) => sum + inv.amount, 0);
        if (totalInvoiced > milestone.amount) {
            issues.push({
                id: "",
                type: "error",
                entityType: "invoice",
                entityId: issuedInvoices[0]?.id || milestone.id,
                code: "INV001",
                message: `里程碑 ${milestone.milestoneNo} 开票金额 ${totalInvoiced} 超过里程碑金额 ${milestone.amount}`,
                severity: "critical",
                suggestion: "检查发票是否重复录入或金额是否正确",
                createdAt: new Date().toISOString(),
            });
        }
        if (signedAcceptance) {
            if (signedAcceptance.acceptedAmount > milestone.amount) {
                issues.push({
                    id: "",
                    type: "error",
                    entityType: "acceptanceForm",
                    entityId: signedAcceptance.id,
                    code: "AC003",
                    message: `验收单 ${signedAcceptance.formNo} 验收金额 ${signedAcceptance.acceptedAmount} 超过里程碑金额 ${milestone.amount}`,
                    severity: "high",
                    suggestion: "检查验收金额是否正确",
                    createdAt: new Date().toISOString(),
                });
            }
            if (signedAcceptance.acceptedAmount < milestone.amount) {
                issues.push({
                    id: "",
                    type: "warning",
                    entityType: "acceptanceForm",
                    entityId: signedAcceptance.id,
                    code: "AC004",
                    message: `里程碑 ${milestone.milestoneNo} 部分验收: ${signedAcceptance.acceptedAmount}/${milestone.amount}`,
                    severity: "medium",
                    suggestion: "确认是否为部分验收，后续需要补充验收",
                    createdAt: new Date().toISOString(),
                });
            }
        }
        const totalPaid = matchedPayments.reduce((sum, p) => sum + p.amount, 0);
        if (signedAcceptance && totalPaid < signedAcceptance.acceptedAmount) {
            const today = new Date();
            const expectedPaymentDate = new Date(signedAcceptance.acceptanceDate);
            expectedPaymentDate.setDate(expectedPaymentDate.getDate() + 30);
            if (today > expectedPaymentDate) {
                issues.push({
                    id: "",
                    type: "error",
                    entityType: "milestone",
                    entityId: milestone.id,
                    code: "PY002",
                    message: `里程碑 ${milestone.milestoneNo} 已超期未收 (应收: ${signedAcceptance.acceptedAmount}, 已收: ${totalPaid})`,
                    severity: "high",
                    suggestion: "跟进客户付款",
                    createdAt: new Date().toISOString(),
                });
            }
        }
        return issues;
    }
    updateMilestoneStatuses() {
        const milestones = this.store.getAllMilestones();
        for (const milestone of milestones) {
            const deliveryProofs = this.store.getDeliveryProofsByMilestoneId(milestone.id);
            const acceptanceForms = this.store.getAcceptanceFormsByMilestoneId(milestone.id);
            const invoices = this.store.getInvoicesByMilestoneId(milestone.id);
            const payments = this.store.getPaymentRecordsByMilestoneId(milestone.id);
            const approvedDelivery = deliveryProofs.find((p) => p.status === "approved");
            const signedAcceptance = acceptanceForms.find((f) => f.status === "signed");
            const issuedInvoices = invoices.filter((i) => i.status === "issued" || i.status === "received");
            const matchedPayments = payments.filter((p) => p.status === "matched" || p.status === "partially_matched");
            const totalInvoiced = issuedInvoices.reduce((sum, inv) => sum + inv.amount, 0);
            const totalPaid = matchedPayments.reduce((sum, p) => sum + p.amount, 0);
            let newStatus = milestone.status;
            if (approvedDelivery) {
                newStatus = "delivered";
            }
            if (signedAcceptance) {
                newStatus = "accepted";
            }
            if (issuedInvoices.length > 0) {
                newStatus = "invoiced";
            }
            if (totalPaid >= milestone.amount) {
                newStatus = "paid";
            }
            else if (totalPaid > 0) {
                newStatus = "partially_paid";
            }
            if (signedAcceptance) {
                const today = new Date();
                const expectedPaymentDate = new Date(signedAcceptance.acceptanceDate);
                expectedPaymentDate.setDate(expectedPaymentDate.getDate() + 30);
                if (today > expectedPaymentDate && totalPaid < signedAcceptance.acceptedAmount && totalPaid < milestone.amount) {
                    newStatus = "overdue";
                }
            }
            if (newStatus !== milestone.status) {
                this.store.updateMilestone(milestone.id, { status: newStatus });
            }
        }
    }
    checkDuplicatePayment(paymentNo) {
        return this.store.getPaymentRecordByNo(paymentNo);
    }
    checkDuplicateInvoice(invoiceNo) {
        return this.store.getInvoiceByNo(invoiceNo);
    }
    checkDuplicateAcceptance(formNo) {
        return this.store.getAcceptanceFormByNo(formNo);
    }
    checkDuplicateDelivery(proofNo) {
        return this.store.getDeliveryProofByNo(proofNo);
    }
    calculateDashboardSummary() {
        const contracts = this.store.getAllContracts();
        const milestones = this.store.getAllMilestones();
        const payments = this.store.getAllPaymentRecords();
        const issues = this.store.getAllIssues();
        const totalAmount = contracts.reduce((sum, c) => sum + c.totalAmount, 0);
        let totalDelivered = 0;
        let totalAccepted = 0;
        let totalInvoiced = 0;
        let totalPaid = 0;
        let overdueCount = 0;
        let overdueAmount = 0;
        for (const milestone of milestones) {
            const deliveryProofs = this.store.getDeliveryProofsByMilestoneId(milestone.id);
            const acceptanceForms = this.store.getAcceptanceFormsByMilestoneId(milestone.id);
            const invoices = this.store.getInvoicesByMilestoneId(milestone.id);
            const milestonePayments = this.store.getPaymentRecordsByMilestoneId(milestone.id);
            const approvedDelivery = deliveryProofs.find((p) => p.status === "approved");
            const signedAcceptance = acceptanceForms.find((f) => f.status === "signed");
            const issuedInvoices = invoices.filter((i) => i.status === "issued" || i.status === "received");
            const matchedPayments = milestonePayments.filter((p) => p.status === "matched" || p.status === "partially_matched");
            if (approvedDelivery) {
                totalDelivered += milestone.amount;
            }
            if (signedAcceptance) {
                totalAccepted += signedAcceptance.acceptedAmount;
            }
            totalInvoiced += issuedInvoices.reduce((sum, inv) => sum + inv.amount, 0);
            totalPaid += matchedPayments.reduce((sum, p) => sum + p.amount, 0);
            if (milestone.status === "overdue") {
                overdueCount++;
                const unpaid = (signedAcceptance?.acceptedAmount || milestone.amount) - matchedPayments.reduce((sum, p) => sum + p.amount, 0);
                overdueAmount += Math.max(0, unpaid);
            }
        }
        const unmatchedPayments = payments.filter((p) => p.status === "unmatched").length;
        const issueCounts = {
            critical: issues.filter((i) => i.severity === "critical").length,
            high: issues.filter((i) => i.severity === "high").length,
            medium: issues.filter((i) => i.severity === "medium").length,
            low: issues.filter((i) => i.severity === "low").length,
        };
        return {
            totalContracts: contracts.length,
            totalAmount,
            totalDelivered,
            totalAccepted,
            totalInvoiced,
            totalPaid,
            overdueCount,
            overdueAmount,
            unmatchedPayments,
            issues: issueCounts,
        };
    }
    getNextActions() {
        const actions = [];
        const issues = this.store.getAllIssues();
        const summary = this.calculateDashboardSummary();
        const criticalIssues = issues.filter((i) => i.severity === "critical");
        const highIssues = issues.filter((i) => i.severity === "high");
        if (criticalIssues.length > 0) {
            actions.push(`[紧急] ${criticalIssues.length} 个严重问题需要立即处理`);
            for (const issue of criticalIssues.slice(0, 3)) {
                actions.push(`  - ${issue.message}`);
                if (issue.suggestion) {
                    actions.push(`    建议: ${issue.suggestion}`);
                }
            }
        }
        if (summary.overdueCount > 0) {
            actions.push(`[跟进] ${summary.overdueCount} 个里程碑已超期未收，金额 ${summary.overdueAmount.toFixed(2)}`);
        }
        if (summary.unmatchedPayments > 0) {
            actions.push(`[待处理] ${summary.unmatchedPayments} 笔收款流水待匹配`);
        }
        if (highIssues.length > 0) {
            actions.push(`[重要] ${highIssues.length} 个高优先级问题需要关注`);
        }
        if (actions.length === 0) {
            actions.push("所有业务状态正常，无需特别处理");
        }
        return actions;
    }
}
exports.BusinessRulesEngine = BusinessRulesEngine;
exports.defaultEngine = new BusinessRulesEngine();
//# sourceMappingURL=rules.js.map