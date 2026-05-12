import fs from "fs";
import { DataStore, defaultStore } from "../storage/store";
import { BusinessRulesEngine, defaultEngine } from "../engine/rules";
import {
  Contract,
  Milestone,
  DeliveryProof,
  AcceptanceForm,
  Invoice,
  PaymentRecord,
} from "../models/types";

export type ImportType =
  | "contract"
  | "milestone"
  | "delivery"
  | "acceptance"
  | "invoice"
  | "payment";

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  details: {
    type: ImportType;
    id: string;
    no: string;
    action: "created" | "skipped" | "error";
    reason?: string;
  }[];
}

export class DataImporter {
  private store: DataStore;
  private engine: BusinessRulesEngine;

  constructor(store: DataStore = defaultStore, engine: BusinessRulesEngine = defaultEngine) {
    this.store = store;
    this.engine = engine;
  }

  importFromJSONFile(filePath: string, type: ImportType, operator: string = "system"): ImportResult {
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    return this.importData(data, type, operator);
  }

  importData(data: unknown, type: ImportType, operator: string = "system"): ImportResult {
    const result: ImportResult = {
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
        } else if (detail.action === "skipped") {
          result.skipped++;
        } else {
          result.errors.push(detail.reason || "未知错误");
          result.success = false;
        }
      } catch (error) {
        result.errors.push((error as Error).message);
        result.success = false;
      }
    }

    this.engine.validateAll();

    return result;
  }

  private importSingleItem(item: Record<string, unknown>, type: ImportType, operator: string) {
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

  private importContract(item: Record<string, unknown>, operator: string) {
    const contractNo = item.contractNo as string;
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
        type: "contract" as ImportType,
        id: existing.id,
        no: contractNo,
        action: "skipped" as const,
        reason: "合同已存在",
      };
    }

    const contract = this.store.addContract({
      contractNo,
      name: item.name as string,
      client: item.client as string,
      startDate: item.startDate as string,
      endDate: item.endDate as string,
      totalAmount: Number(item.totalAmount),
      status: (item.status as Contract["status"]) || "active",
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
      type: "contract" as ImportType,
      id: contract.id,
      no: contractNo,
      action: "created" as const,
    };
  }

  private importMilestone(item: Record<string, unknown>, operator: string) {
    const milestoneNo = item.milestoneNo as string;
    const contractNo = item.contractNo as string;
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
        type: "milestone" as ImportType,
        id: existing.id,
        no: milestoneNo,
        action: "skipped" as const,
        reason: "里程碑已存在",
      };
    }

    const contract = this.store.getContractByNo(contractNo);
    if (!contract) {
      return {
        type: "milestone" as ImportType,
        id: "",
        no: milestoneNo,
        action: "error" as const,
        reason: `合同 ${contractNo} 不存在`,
      };
    }

    const milestone = this.store.addMilestone({
      contractId: contract.id,
      milestoneNo,
      name: item.name as string,
      amount: Number(item.amount),
      expectedDeliveryDate: item.expectedDeliveryDate as string,
      description: (item.description as string) || "",
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
      type: "milestone" as ImportType,
      id: milestone.id,
      no: milestoneNo,
      action: "created" as const,
    };
  }

  private importDeliveryProof(item: Record<string, unknown>, operator: string) {
    const proofNo = item.proofNo as string;
    const milestoneNo = item.milestoneNo as string;
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
        type: "delivery" as ImportType,
        id: existing.id,
        no: proofNo,
        action: "skipped" as const,
        reason: "交付证明已存在",
      };
    }

    const milestone = this.store.getMilestoneByNo(milestoneNo);
    if (!milestone) {
      return {
        type: "delivery" as ImportType,
        id: "",
        no: proofNo,
        action: "error" as const,
        reason: `里程碑 ${milestoneNo} 不存在`,
      };
    }

    const proof = this.store.addDeliveryProof({
      milestoneId: milestone.id,
      proofNo,
      deliveryDate: item.deliveryDate as string,
      description: (item.description as string) || "",
      filePath: item.filePath as string | undefined,
      status: (item.status as DeliveryProof["status"]) || "submitted",
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
      type: "delivery" as ImportType,
      id: proof.id,
      no: proofNo,
      action: "created" as const,
    };
  }

  private importAcceptanceForm(item: Record<string, unknown>, operator: string) {
    const formNo = item.formNo as string;
    const milestoneNo = item.milestoneNo as string;
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
        type: "acceptance" as ImportType,
        id: existing.id,
        no: formNo,
        action: "skipped" as const,
        reason: "验收单已存在",
      };
    }

    const milestone = this.store.getMilestoneByNo(milestoneNo);
    if (!milestone) {
      return {
        type: "acceptance" as ImportType,
        id: "",
        no: formNo,
        action: "error" as const,
        reason: `里程碑 ${milestoneNo} 不存在`,
      };
    }

    const form = this.store.addAcceptanceForm({
      milestoneId: milestone.id,
      formNo,
      acceptanceDate: item.acceptanceDate as string,
      acceptedAmount: Number(item.acceptedAmount),
      description: (item.description as string) || "",
      filePath: item.filePath as string | undefined,
      status: (item.status as AcceptanceForm["status"]) || "submitted",
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
      type: "acceptance" as ImportType,
      id: form.id,
      no: formNo,
      action: "created" as const,
    };
  }

  private importInvoice(item: Record<string, unknown>, operator: string) {
    const invoiceNo = item.invoiceNo as string;
    const milestoneNo = item.milestoneNo as string;
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
        type: "invoice" as ImportType,
        id: existing.id,
        no: invoiceNo,
        action: "skipped" as const,
        reason: "发票已存在",
      };
    }

    const milestone = this.store.getMilestoneByNo(milestoneNo);
    if (!milestone) {
      return {
        type: "invoice" as ImportType,
        id: "",
        no: invoiceNo,
        action: "error" as const,
        reason: `里程碑 ${milestoneNo} 不存在`,
      };
    }

    const invoice = this.store.addInvoice({
      milestoneId: milestone.id,
      invoiceNo,
      invoiceDate: item.invoiceDate as string,
      amount: Number(item.amount),
      taxRate: item.taxRate ? Number(item.taxRate) : undefined,
      filePath: item.filePath as string | undefined,
      status: (item.status as Invoice["status"]) || "issued",
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
      type: "invoice" as ImportType,
      id: invoice.id,
      no: invoiceNo,
      action: "created" as const,
    };
  }

  private importPaymentRecord(item: Record<string, unknown>, operator: string) {
    const paymentNo = item.paymentNo as string;
    const invoiceNo = item.invoiceNo as string | undefined;
    const milestoneNo = item.milestoneNo as string | undefined;
    const contractNo = item.contractNo as string | undefined;
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
        type: "payment" as ImportType,
        id: existing.id,
        no: paymentNo,
        action: "skipped" as const,
        reason: "收款流水已存在",
      };
    }

    let invoiceId: string | undefined;
    let milestoneId: string | undefined;
    let contractId: string | undefined;
    let status: PaymentRecord["status"] = "unmatched";

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
    } else if (milestoneNo) {
      const milestone = this.store.getMilestoneByNo(milestoneNo);
      if (milestone) {
        milestoneId = milestone.id;
        contractId = milestone.contractId;
        status = "matched";
      }
    } else if (contractNo) {
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
      paymentDate: item.paymentDate as string,
      amount: Number(item.amount),
      payer: item.payer as string,
      remark: item.remark as string | undefined,
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
      type: "payment" as ImportType,
      id: payment.id,
      no: paymentNo,
      action: "created" as const,
    };
  }
}

export const defaultImporter = new DataImporter();
