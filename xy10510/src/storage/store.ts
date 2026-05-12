import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { Database, createEmptyDatabase, EntityName } from "../models/schemas";
import {
  Contract,
  Milestone,
  DeliveryProof,
  AcceptanceForm,
  Invoice,
  PaymentRecord,
  OperationRecord,
  ValidationIssue,
  EntityType,
} from "../models/types";

const DEFAULT_DATA_DIR = path.join(process.cwd(), ".cmp-data");
const DB_FILE = "database.json";

export class DataStore {
  private db: Database;
  private dataDir: string;
  private dbPath: string;

  constructor(dataDir: string = DEFAULT_DATA_DIR) {
    this.dataDir = dataDir;
    this.dbPath = path.join(dataDir, DB_FILE);
    this.db = createEmptyDatabase();
  }

  getDatabase(): Database {
    return this.db;
  }

  getDataDir(): string {
    return this.dataDir;
  }

  exists(): boolean {
    return fs.existsSync(this.dbPath);
  }

  initialize(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.db = createEmptyDatabase();
    this.save();
  }

  load(): boolean {
    if (!this.exists()) {
      return false;
    }
    try {
      const content = fs.readFileSync(this.dbPath, "utf-8");
      this.db = JSON.parse(content);
      return true;
    } catch (error) {
      throw new Error(`无法加载数据库: ${(error as Error).message}`);
    }
  }

  save(): void {
    this.db.lastUpdatedAt = new Date().toISOString();
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    fs.writeFileSync(this.dbPath, JSON.stringify(this.db, null, 2), "utf-8");
  }

  addContract(contract: Omit<Contract, "id" | "createdAt" | "updatedAt">): Contract {
    const now = new Date().toISOString();
    const newContract: Contract = {
      ...contract,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    this.db.contracts.push(newContract);
    this.save();
    return newContract;
  }

  addMilestone(milestone: Omit<Milestone, "id" | "createdAt" | "updatedAt">): Milestone {
    const now = new Date().toISOString();
    const newMilestone: Milestone = {
      ...milestone,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    this.db.milestones.push(newMilestone);
    this.save();
    return newMilestone;
  }

  addDeliveryProof(proof: Omit<DeliveryProof, "id" | "createdAt" | "updatedAt">): DeliveryProof {
    const now = new Date().toISOString();
    const newProof: DeliveryProof = {
      ...proof,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    this.db.deliveryProofs.push(newProof);
    this.save();
    return newProof;
  }

  addAcceptanceForm(form: Omit<AcceptanceForm, "id" | "createdAt" | "updatedAt">): AcceptanceForm {
    const now = new Date().toISOString();
    const newForm: AcceptanceForm = {
      ...form,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    this.db.acceptanceForms.push(newForm);
    this.save();
    return newForm;
  }

  addInvoice(invoice: Omit<Invoice, "id" | "createdAt" | "updatedAt">): Invoice {
    const now = new Date().toISOString();
    const newInvoice: Invoice = {
      ...invoice,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    this.db.invoices.push(newInvoice);
    this.save();
    return newInvoice;
  }

  addPaymentRecord(record: Omit<PaymentRecord, "id" | "createdAt" | "updatedAt">): PaymentRecord {
    const now = new Date().toISOString();
    const newRecord: PaymentRecord = {
      ...record,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    this.db.paymentRecords.push(newRecord);
    this.save();
    return newRecord;
  }

  addOperation(
    operation: Omit<OperationRecord, "id" | "timestamp">
  ): OperationRecord {
    const now = new Date().toISOString();
    const newOp: OperationRecord = {
      ...operation,
      id: uuidv4(),
      timestamp: now,
    };
    this.db.operations.push(newOp);
    this.save();
    return newOp;
  }

  addIssue(issue: Omit<ValidationIssue, "id" | "createdAt">): ValidationIssue {
    const now = new Date().toISOString();
    const newIssue: ValidationIssue = {
      ...issue,
      id: uuidv4(),
      createdAt: now,
    };
    this.db.issues.push(newIssue);
    this.save();
    return newIssue;
  }

  clearIssues(): void {
    this.db.issues = [];
    this.save();
  }

  getContractById(id: string): Contract | undefined {
    return this.db.contracts.find((c) => c.id === id);
  }

  getContractByNo(contractNo: string): Contract | undefined {
    return this.db.contracts.find((c) => c.contractNo === contractNo);
  }

  getMilestoneById(id: string): Milestone | undefined {
    return this.db.milestones.find((m) => m.id === id);
  }

  getMilestonesByContractId(contractId: string): Milestone[] {
    return this.db.milestones.filter((m) => m.contractId === contractId);
  }

  getMilestoneByNo(milestoneNo: string): Milestone | undefined {
    return this.db.milestones.find((m) => m.milestoneNo === milestoneNo);
  }

  getDeliveryProofById(id: string): DeliveryProof | undefined {
    return this.db.deliveryProofs.find((p) => p.id === id);
  }

  getDeliveryProofsByMilestoneId(milestoneId: string): DeliveryProof[] {
    return this.db.deliveryProofs.filter((p) => p.milestoneId === milestoneId);
  }

  getDeliveryProofByNo(proofNo: string): DeliveryProof | undefined {
    return this.db.deliveryProofs.find((p) => p.proofNo === proofNo);
  }

  getAcceptanceFormById(id: string): AcceptanceForm | undefined {
    return this.db.acceptanceForms.find((f) => f.id === id);
  }

  getAcceptanceFormsByMilestoneId(milestoneId: string): AcceptanceForm[] {
    return this.db.acceptanceForms.filter((f) => f.milestoneId === milestoneId);
  }

  getAcceptanceFormByNo(formNo: string): AcceptanceForm | undefined {
    return this.db.acceptanceForms.find((f) => f.formNo === formNo);
  }

  getInvoiceById(id: string): Invoice | undefined {
    return this.db.invoices.find((i) => i.id === id);
  }

  getInvoicesByMilestoneId(milestoneId: string): Invoice[] {
    return this.db.invoices.filter((i) => i.milestoneId === milestoneId);
  }

  getInvoiceByNo(invoiceNo: string): Invoice | undefined {
    return this.db.invoices.find((i) => i.invoiceNo === invoiceNo);
  }

  getPaymentRecordById(id: string): PaymentRecord | undefined {
    return this.db.paymentRecords.find((p) => p.id === id);
  }

  getPaymentRecordsByMilestoneId(milestoneId: string): PaymentRecord[] {
    return this.db.paymentRecords.filter((p) => p.milestoneId === milestoneId);
  }

  getPaymentRecordsByInvoiceId(invoiceId: string): PaymentRecord[] {
    return this.db.paymentRecords.filter((p) => p.invoiceId === invoiceId);
  }

  getPaymentRecordByNo(paymentNo: string): PaymentRecord | undefined {
    return this.db.paymentRecords.find((p) => p.paymentNo === paymentNo);
  }

  getOperationsByEntity(entityType: EntityType, entityId: string): OperationRecord[] {
    return this.db.operations
      .filter((op) => op.entityType === entityType && op.entityId === entityId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getIssuesByEntity(entityType: EntityType, entityId: string): ValidationIssue[] {
    return this.db.issues.filter(
      (issue) => issue.entityType === entityType && issue.entityId === entityId
    );
  }

  updateContract(id: string, updates: Partial<Contract>): Contract | undefined {
    const idx = this.db.contracts.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    this.db.contracts[idx] = {
      ...this.db.contracts[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.db.contracts[idx];
  }

  updateMilestone(id: string, updates: Partial<Milestone>): Milestone | undefined {
    const idx = this.db.milestones.findIndex((m) => m.id === id);
    if (idx === -1) return undefined;
    this.db.milestones[idx] = {
      ...this.db.milestones[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.db.milestones[idx];
  }

  updateDeliveryProof(id: string, updates: Partial<DeliveryProof>): DeliveryProof | undefined {
    const idx = this.db.deliveryProofs.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    this.db.deliveryProofs[idx] = {
      ...this.db.deliveryProofs[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.db.deliveryProofs[idx];
  }

  updateAcceptanceForm(id: string, updates: Partial<AcceptanceForm>): AcceptanceForm | undefined {
    const idx = this.db.acceptanceForms.findIndex((f) => f.id === id);
    if (idx === -1) return undefined;
    this.db.acceptanceForms[idx] = {
      ...this.db.acceptanceForms[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.db.acceptanceForms[idx];
  }

  updateInvoice(id: string, updates: Partial<Invoice>): Invoice | undefined {
    const idx = this.db.invoices.findIndex((i) => i.id === id);
    if (idx === -1) return undefined;
    this.db.invoices[idx] = {
      ...this.db.invoices[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.db.invoices[idx];
  }

  updatePaymentRecord(id: string, updates: Partial<PaymentRecord>): PaymentRecord | undefined {
    const idx = this.db.paymentRecords.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    this.db.paymentRecords[idx] = {
      ...this.db.paymentRecords[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.db.paymentRecords[idx];
  }

  getAllContracts(): Contract[] {
    return [...this.db.contracts];
  }

  getAllMilestones(): Milestone[] {
    return [...this.db.milestones];
  }

  getAllDeliveryProofs(): DeliveryProof[] {
    return [...this.db.deliveryProofs];
  }

  getAllAcceptanceForms(): AcceptanceForm[] {
    return [...this.db.acceptanceForms];
  }

  getAllInvoices(): Invoice[] {
    return [...this.db.invoices];
  }

  getAllPaymentRecords(): PaymentRecord[] {
    return [...this.db.paymentRecords];
  }

  getAllOperations(): OperationRecord[] {
    return [...this.db.operations];
  }

  getAllIssues(): ValidationIssue[] {
    return [...this.db.issues];
  }
}

export const defaultStore = new DataStore();
