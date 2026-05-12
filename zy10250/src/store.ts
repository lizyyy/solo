import { v4 as uuidv4 } from 'uuid';
import {
  SaleOrder,
  SyncBatch,
  Inventory,
  MemberPointsLog,
  ExceptionOrder,
  SaleStatus,
  BatchStatus,
  ExceptionType
} from './types';

class DataStore {
  private saleOrders: Map<string, SaleOrder> = new Map();
  private syncBatches: Map<string, SyncBatch> = new Map();
  private inventories: Map<string, Inventory> = new Map();
  private memberPointsLogs: MemberPointsLog[] = [];
  private exceptionOrders: ExceptionOrder[] = [];

  constructor() {
    this.initInventory();
  }

  private initInventory() {
    const initialInventory: Inventory[] = [
      { sku: 'SKU001', name: '农夫山泉550ml', quantity: 100, warehouse: '001', lastUpdated: new Date().toISOString() },
      { sku: 'SKU002', name: '康师傅红烧牛肉面', quantity: 50, warehouse: '001', lastUpdated: new Date().toISOString() },
      { sku: 'SKU003', name: '可口可乐330ml', quantity: 80, warehouse: '001', lastUpdated: new Date().toISOString() },
      { sku: 'SKU004', name: '乐事薯片原味', quantity: 30, warehouse: '001', lastUpdated: new Date().toISOString() },
      { sku: 'SKU005', name: '士力架花生夹心', quantity: 45, warehouse: '001', lastUpdated: new Date().toISOString() },
    ];
    initialInventory.forEach(item => this.inventories.set(item.sku, item));
  }

  async saveSaleOrder(order: SaleOrder): Promise<void> {
    this.saleOrders.set(order.orderNo, order);
  }

  async getSaleOrder(orderNo: string): Promise<SaleOrder | undefined> {
    return this.saleOrders.get(orderNo);
  }

  async getSaleOrdersByBatch(batchId: string): Promise<SaleOrder[]> {
    return Array.from(this.saleOrders.values()).filter(o => o.batchId === batchId);
  }

  async getAllSaleOrders(): Promise<SaleOrder[]> {
    return Array.from(this.saleOrders.values());
  }

  async saveSyncBatch(batch: SyncBatch): Promise<void> {
    this.syncBatches.set(batch.batchId, batch);
  }

  async getSyncBatch(batchId: string): Promise<SyncBatch | undefined> {
    return this.syncBatches.get(batchId);
  }

  async getAllSyncBatches(): Promise<SyncBatch[]> {
    return Array.from(this.syncBatches.values());
  }

  async getInventory(sku: string): Promise<Inventory | undefined> {
    return this.inventories.get(sku);
  }

  async updateInventory(sku: string, quantityDelta: number): Promise<boolean> {
    const inventory = this.inventories.get(sku);
    if (!inventory) return false;
    
    const newQuantity = inventory.quantity + quantityDelta;
    if (newQuantity < 0) return false;
    
    inventory.quantity = newQuantity;
    inventory.lastUpdated = new Date().toISOString();
    return true;
  }

  async getAllInventory(): Promise<Inventory[]> {
    return Array.from(this.inventories.values());
  }

  async addMemberPointsLog(log: Omit<MemberPointsLog, 'logId' | 'createdAt'>): Promise<void> {
    this.memberPointsLogs.push({
      ...log,
      logId: uuidv4(),
      createdAt: new Date().toISOString()
    });
  }

  async getMemberPointsLogs(memberId: string, orderNo?: string): Promise<MemberPointsLog[]> {
    return this.memberPointsLogs.filter(log => 
      log.memberId === memberId && (!orderNo || log.orderNo === orderNo)
    );
  }

  async getAllMemberPointsLogs(): Promise<MemberPointsLog[]> {
    return this.memberPointsLogs;
  }

  async addExceptionOrder(exception: Omit<ExceptionOrder, 'exceptionId' | 'createdAt' | 'resolved'>): Promise<void> {
    this.exceptionOrders.push({
      ...exception,
      exceptionId: uuidv4(),
      createdAt: new Date().toISOString(),
      resolved: false
    });
  }

  async getExceptionOrders(orderNo?: string, batchId?: string): Promise<ExceptionOrder[]> {
    return this.exceptionOrders.filter(e =>
      (!orderNo || e.orderNo === orderNo) && (!batchId || e.batchId === batchId)
    );
  }

  async getAllExceptionOrders(): Promise<ExceptionOrder[]> {
    return this.exceptionOrders;
  }

  async resolveException(exceptionId: string): Promise<boolean> {
    const exception = this.exceptionOrders.find(e => e.exceptionId === exceptionId);
    if (!exception) return false;
    exception.resolved = true;
    exception.resolvedAt = new Date().toISOString();
    return true;
  }
}

export const store = new DataStore();
