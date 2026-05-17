import { v4 as uuidv4 } from 'uuid';
import {
  RepairPartReturn,
  RepairPartReturnStatus,
  RepairPartReturnHistory,
  CreateReturnRequest,
  SparePart,
  RepairOrder,
  ShipRequest,
  ReceiveRequest,
  InspectionRequest,
  StockInRequest
} from '../types';

class RepairPartReturnStore {
  private returns: Map<string, RepairPartReturn> = new Map();
  private histories: Map<string, RepairPartReturnHistory[]> = new Map();
  private returnNoCounter = 1;

  create(request: CreateReturnRequest): RepairPartReturn {
    const now = new Date().toISOString();
    const id = uuidv4();
    const returnNo = `RPR${String(this.returnNoCounter++).padStart(6, '0')}`;
    
    const sparePart: SparePart = {
      ...request.sparePart,
      partId: uuidv4()
    };
    
    const repairOrder: RepairOrder = {
      ...request.repairOrder,
      repairOrderId: uuidv4()
    };

    const repairReturn: RepairPartReturn = {
      id,
      returnNo,
      sparePart,
      repairOrder,
      status: RepairPartReturnStatus.PENDING_SHIP,
      stockRecovered: false,
      remark: request.remark,
      createTime: now,
      updateTime: now,
      operatorId: request.operatorId,
      operatorName: request.operatorName,
      idempotentKey: request.idempotentKey
    };

    this.returns.set(id, repairReturn);
    this.histories.set(id, []);
    
    this.addHistory(id, {
      newStatus: RepairPartReturnStatus.PENDING_SHIP,
      operatorId: request.operatorId,
      operatorName: request.operatorName,
      remark: '创建返厂单'
    });

    return repairReturn;
  }

  findById(id: string): RepairPartReturn | undefined {
    return this.returns.get(id);
  }

  findByReturnNo(returnNo: string): RepairPartReturn | undefined {
    return Array.from(this.returns.values()).find(r => r.returnNo === returnNo);
  }

  findByIdempotentKey(idempotentKey: string): RepairPartReturn | undefined {
    return Array.from(this.returns.values()).find(r => r.idempotentKey === idempotentKey);
  }

  list(page: number = 1, pageSize: number = 20, status?: RepairPartReturnStatus): { list: RepairPartReturn[], total: number } {
    let list = Array.from(this.returns.values());
    
    if (status) {
      list = list.filter(r => r.status === status);
    }
    
    list.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
    
    const total = list.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    return {
      list: list.slice(start, end),
      total
    };
  }

  updateStatus(id: string, newStatus: RepairPartReturnStatus, operatorId: string, operatorName: string, remark?: string): RepairPartReturn {
    const repairReturn = this.returns.get(id)!;
    const oldStatus = repairReturn.status;
    
    repairReturn.status = newStatus;
    repairReturn.updateTime = new Date().toISOString();
    repairReturn.operatorId = operatorId;
    repairReturn.operatorName = operatorName;
    if (remark) {
      repairReturn.remark = remark;
    }

    this.addHistory(id, {
      oldStatus,
      newStatus,
      operatorId,
      operatorName,
      remark
    });

    return repairReturn;
  }

  ship(id: string, request: ShipRequest): RepairPartReturn {
    const repairReturn = this.returns.get(id)!;
    const now = new Date().toISOString();
    
    repairReturn.shippingInfo = {
      carrier: request.carrier,
      trackingNo: request.trackingNo,
      shipTime: now
    };
    
    return this.updateStatus(
      id,
      RepairPartReturnStatus.IN_TRANSIT,
      request.operatorId,
      request.operatorName,
      request.remark || '已寄出'
    );
  }

  receive(id: string, request: ReceiveRequest): RepairPartReturn {
    const repairReturn = this.returns.get(id)!;
    const now = new Date().toISOString();
    
    if (repairReturn.shippingInfo) {
      repairReturn.shippingInfo.receiveTime = now;
      repairReturn.shippingInfo.receiverName = request.receiverName;
    }
    
    return this.updateStatus(
      id,
      RepairPartReturnStatus.PENDING_INSPECTION,
      request.operatorId,
      request.operatorName,
      request.remark || '已签收，待检测'
    );
  }

  inspect(id: string, request: InspectionRequest, stockRecovered: boolean): RepairPartReturn {
    const repairReturn = this.returns.get(id)!;
    const now = new Date().toISOString();
    
    repairReturn.inspectionConclusion = {
      inspectorId: request.inspectorId,
      inspectorName: request.inspectorName,
      inspectionTime: now,
      result: request.result,
      remark: request.remark,
      defectDescription: request.defectDescription,
      repairSuggestion: request.repairSuggestion,
      requiredMaterials: request.requiredMaterials
    };
    repairReturn.stockRecovered = stockRecovered;
    
    return this.updateStatus(
      id,
      RepairPartReturnStatus.INSPECTED,
      request.inspectorId,
      request.inspectorName,
      request.remark || '检测完成'
    );
  }

  setNextStepHint(id: string, hint: string): void {
    const repairReturn = this.returns.get(id);
    if (repairReturn) {
      repairReturn.nextStepHint = hint;
    }
  }

  stockIn(id: string, request: StockInRequest): RepairPartReturn {
    return this.updateStatus(
      id,
      RepairPartReturnStatus.STOCKED,
      request.operatorId,
      request.operatorName,
      request.remark || '已入库'
    );
  }

  reject(id: string, operatorId: string, operatorName: string, remark?: string): RepairPartReturn {
    return this.updateStatus(
      id,
      RepairPartReturnStatus.REJECTED,
      operatorId,
      operatorName,
      remark || '驳回'
    );
  }

  getHistories(returnId: string): RepairPartReturnHistory[] {
    return this.histories.get(returnId) || [];
  }

  private addHistory(returnId: string, history: Omit<RepairPartReturnHistory, 'id' | 'returnId' | 'createTime'>): void {
    const histories = this.histories.get(returnId) || [];
    histories.push({
      ...history,
      id: uuidv4(),
      returnId,
      createTime: new Date().toISOString()
    });
    this.histories.set(returnId, histories);
  }

  getAll(): RepairPartReturn[] {
    return Array.from(this.returns.values());
  }
}

export const repairPartReturnStore = new RepairPartReturnStore();
