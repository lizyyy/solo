"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultImporter = exports.DataImporter = void 0;
const fs_1 = __importDefault(require("fs"));
const store_1 = require("../storage/store");
const rules_1 = require("../engine/rules");
class DataImporter {
    constructor(store = store_1.defaultStore, engine = rules_1.defaultEngine) {
        this.store = store;
        this.engine = engine;
    }
    importFromJSONFile(filePath, type, operator = "system") {
        const content = fs_1.default.readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);
        return this.importData(data, type, operator);
    }
    importData(data, type, operator = "system") {
        const result = {
            success: true,
            imported: 0,
            skipped: 0,
            errors: [],
            details: [],
        };
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
            try {
                const detail = this.importSingleItem(item, type, operator);
                result.details.push(detail);
                if (detail.action === "created") {
                    result.imported++;
                }
                else if (detail.action === "skipped") {
                    result.skipped++;
                }
                else {
                    result.errors.push(detail.reason || "未知错误");
                    result.success = false;
                }
            }
            catch (error) {
                result.errors.push(error.message);
                result.success = false;
            }
        }
        this.engine.validateAll();
        return result;
    }
    importSingleItem(item, type, operator) {
        switch (type) {
            case "contract":
                return this.importContract(item, operator);
            case "milestone":
                return this.importMilestone(item, operator);
            case "delivery":
                return this.importDeliveryProof(item, operator);
            case "acceptance":
                return this.importAcceptanceForm(item, operator);
            case "invoice":
                return this.importInvoice(item, operator);
            case "payment":
                return this.importPaymentRecord(item, operator);
            default:
                throw new Error(`未知的导入类型: ${type}`);
        }
    }
    importContract(item, operator) {
        const contractNo = item.contractNo;
        const existing = this.store.getContractByNo(contractNo);
        if (existing) {
            this.store.addOperation({
                entityType: "contract",
                entityId: existing.id,
                operation: "import",
                operator,
                description: `导入合同 ${contractNo} - 已存在，跳过`,
                success: true,
            });
            return {
                type: "contract",
                id: existing.id,
                no: contractNo,
                action: "skipped",
                reason: "合同已存在",
            };
        }
        const contract = this.store.addContract({
            contractNo,
            name: item.name,
            client: item.client,
            startDate: item.startDate,
            endDate: item.endDate,
            totalAmount: Number(item.totalAmount),
            status: item.status || "active",
        });
        this.store.addOperation({
            entityType: "contract",
            entityId: contract.id,
            operation: "import",
            operator,
            description: `导入合同 ${contractNo}`,
            success: true,
        });
        return {
            type: "contract",
            id: contract.id,
            no: contractNo,
            action: "created",
        };
    }
    importMilestone(item, operator) {
        const milestoneNo = item.milestoneNo;
        const contractNo = item.contractNo;
        const existing = this.store.getMilestoneByNo(milestoneNo);
        if (existing) {
            this.store.addOperation({
                entityType: "milestone",
                entityId: existing.id,
                operation: "import",
                operator,
                description: `导入里程碑 ${milestoneNo} - 已存在，跳过`,
                success: true,
            });
            return {
                type: "milestone",
                id: existing.id,
                no: milestoneNo,
                action: "skipped",
                reason: "里程碑已存在",
            };
        }
        const contract = this.store.getContractByNo(contractNo);
        if (!contract) {
            return {
                type: "milestone",
                id: "",
                no: milestoneNo,
                action: "error",
                reason: `合同 ${contractNo} 不存在`,
            };
        }
        const milestone = this.store.addMilestone({
            contractId: contract.id,
            milestoneNo,
            name: item.name,
            amount: Number(item.amount),
            expectedDeliveryDate: item.expectedDeliveryDate,
            description: item.description || "",
            status: "not_started",
        });
        this.store.addOperation({
            entityType: "milestone",
            entityId: milestone.id,
            operation: "import",
            operator,
            description: `导入里程碑 ${milestoneNo}`,
            success: true,
        });
        return {
            type: "milestone",
            id: milestone.id,
            no: milestoneNo,
            action: "created",
        };
    }
    importDeliveryProof(item, operator) {
        const proofNo = item.proofNo;
        const milestoneNo = item.milestoneNo;
        const existing = this.engine.checkDuplicateDelivery(proofNo);
        if (existing) {
            this.store.addOperation({
                entityType: "deliveryProof",
                entityId: existing.id,
                operation: "import",
                operator,
                description: `导入交付证明 ${proofNo} - 已存在，跳过`,
                success: true,
            });
            return {
                type: "delivery",
                id: existing.id,
                no: proofNo,
                action: "skipped",
                reason: "交付证明已存在",
            };
        }
        const milestone = this.store.getMilestoneByNo(milestoneNo);
        if (!milestone) {
            return {
                type: "delivery",
                id: "",
                no: proofNo,
                action: "error",
                reason: `里程碑 ${milestoneNo} 不存在`,
            };
        }
        const proof = this.store.addDeliveryProof({
            milestoneId: milestone.id,
            proofNo,
            deliveryDate: item.deliveryDate,
            description: item.description || "",
            filePath: item.filePath,
            status: item.status || "submitted",
        });
        this.store.addOperation({
            entityType: "deliveryProof",
            entityId: proof.id,
            operation: "import",
            operator,
            description: `导入交付证明 ${proofNo}`,
            success: true,
        });
        return {
            type: "delivery",
            id: proof.id,
            no: proofNo,
            action: "created",
        };
    }
    importAcceptanceForm(item, operator) {
        const formNo = item.formNo;
        const milestoneNo = item.milestoneNo;
        const existing = this.engine.checkDuplicateAcceptance(formNo);
        if (existing) {
            this.store.addOperation({
                entityType: "acceptanceForm",
                entityId: existing.id,
                operation: "import",
                operator,
                description: `导入验收单 ${formNo} - 已存在，跳过`,
                success: true,
            });
            return {
                type: "acceptance",
                id: existing.id,
                no: formNo,
                action: "skipped",
                reason: "验收单已存在",
            };
        }
        const milestone = this.store.getMilestoneByNo(milestoneNo);
        if (!milestone) {
            return {
                type: "acceptance",
                id: "",
                no: formNo,
                action: "error",
                reason: `里程碑 ${milestoneNo} 不存在`,
            };
        }
        const form = this.store.addAcceptanceForm({
            milestoneId: milestone.id,
            formNo,
            acceptanceDate: item.acceptanceDate,
            acceptedAmount: Number(item.acceptedAmount),
            description: item.description || "",
            filePath: item.filePath,
            status: item.status || "submitted",
        });
        this.store.addOperation({
            entityType: "acceptanceForm",
            entityId: form.id,
            operation: "import",
            operator,
            description: `导入验收单 ${formNo}`,
            success: true,
        });
        return {
            type: "acceptance",
            id: form.id,
            no: formNo,
            action: "created",
        };
    }
    importInvoice(item, operator) {
        const invoiceNo = item.invoiceNo;
        const milestoneNo = item.milestoneNo;
        const existing = this.engine.checkDuplicateInvoice(invoiceNo);
        if (existing) {
            this.store.addOperation({
                entityType: "invoice",
                entityId: existing.id,
                operation: "import",
                operator,
                description: `导入发票 ${invoiceNo} - 已存在，跳过`,
                success: true,
            });
            return {
                type: "invoice",
                id: existing.id,
                no: invoiceNo,
                action: "skipped",
                reason: "发票已存在",
            };
        }
        const milestone = this.store.getMilestoneByNo(milestoneNo);
        if (!milestone) {
            return {
                type: "invoice",
                id: "",
                no: invoiceNo,
                action: "error",
                reason: `里程碑 ${milestoneNo} 不存在`,
            };
        }
        const invoice = this.store.addInvoice({
            milestoneId: milestone.id,
            invoiceNo,
            invoiceDate: item.invoiceDate,
            amount: Number(item.amount),
            taxRate: item.taxRate ? Number(item.taxRate) : undefined,
            filePath: item.filePath,
            status: item.status || "issued",
        });
        this.store.addOperation({
            entityType: "invoice",
            entityId: invoice.id,
            operation: "import",
            operator,
            description: `导入发票 ${invoiceNo}`,
            success: true,
        });
        return {
            type: "invoice",
            id: invoice.id,
            no: invoiceNo,
            action: "created",
        };
    }
    importPaymentRecord(item, operator) {
        const paymentNo = item.paymentNo;
        const invoiceNo = item.invoiceNo;
        const milestoneNo = item.milestoneNo;
        const contractNo = item.contractNo;
        const existing = this.engine.checkDuplicatePayment(paymentNo);
        if (existing) {
            this.store.addOperation({
                entityType: "paymentRecord",
                entityId: existing.id,
                operation: "import",
                operator,
                description: `导入收款流水 ${paymentNo} - 已存在，跳过`,
                success: true,
            });
            return {
                type: "payment",
                id: existing.id,
                no: paymentNo,
                action: "skipped",
                reason: "收款流水已存在",
            };
        }
        let invoiceId;
        let milestoneId;
        let contractId;
        let status = "unmatched";
        if (invoiceNo) {
            const invoice = this.store.getInvoiceByNo(invoiceNo);
            if (invoice) {
                invoiceId = invoice.id;
                milestoneId = invoice.milestoneId;
                const milestone = this.store.getMilestoneById(milestoneId);
                if (milestone) {
                    contractId = milestone.contractId;
                }
                status = "matched";
            }
        }
        else if (milestoneNo) {
            const milestone = this.store.getMilestoneByNo(milestoneNo);
            if (milestone) {
                milestoneId = milestone.id;
                contractId = milestone.contractId;
                status = "matched";
            }
        }
        else if (contractNo) {
            const contract = this.store.getContractByNo(contractNo);
            if (contract) {
                contractId = contract.id;
                status = "matched";
            }
        }
        const payment = this.store.addPaymentRecord({
            invoiceId,
            milestoneId,
            contractId,
            paymentNo,
            paymentDate: item.paymentDate,
            amount: Number(item.amount),
            payer: item.payer,
            remark: item.remark,
            status,
        });
        this.store.addOperation({
            entityType: "paymentRecord",
            entityId: payment.id,
            operation: "import",
            operator,
            description: `导入收款流水 ${paymentNo} - ${status === "matched" ? "已匹配" : "待匹配"}`,
            success: true,
        });
        return {
            type: "payment",
            id: payment.id,
            no: paymentNo,
            action: "created",
        };
    }
}
exports.DataImporter = DataImporter;
exports.defaultImporter = new DataImporter();
//# sourceMappingURL=importer.js.map