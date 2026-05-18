import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import {
  SnowboardEquipment,
  Customer,
  RentalRecord,
  AdjustmentRecord,
  InventoryLog,
  ReconciliationRecord,
  EquipmentBrand,
  EquipmentType,
  SnowboardLevel,
  RentalStatus,
  AdjustmentStatus,
  ReconciliationStatus
} from '../types';

class Database {
  private equipments: Map<string, SnowboardEquipment> = new Map();
  private customers: Map<string, Customer> = new Map();
  private rentalRecords: Map<string, RentalRecord> = new Map();
  private adjustmentRecords: Map<string, AdjustmentRecord> = new Map();
  private inventoryLogs: Map<string, InventoryLog> = new Map();
  private reconciliationRecords: Map<string, ReconciliationRecord> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const sampleEquipments: SnowboardEquipment[] = [
      {
        id: uuidv4(),
        equipmentCode: 'SB-BR-001',
        rfidTag: 'RFID-88001',
        brand: EquipmentBrand.BURTON,
        model: 'Custom X 2024',
        type: EquipmentType.SNOWBOARD,
        size: 'M',
        sizeCm: 154,
        level: SnowboardLevel.INTERMEDIATE,
        color: '黑色',
        purchaseDate: '2023-10-15',
        purchasePrice: 4580,
        currentStatus: RentalStatus.AVAILABLE,
        location: '云顶雪具大厅A区',
        rentalCount: 28,
        isNewArrival: false,
        warehouseZone: 'A-01',
        shelfNumber: 'SHELF-A-001',
        createdAt: moment().subtract(6, 'months').toISOString(),
        updatedAt: moment().toISOString()
      },
      {
        id: uuidv4(),
        equipmentCode: 'SB-SA-002',
        rfidTag: 'RFID-88002',
        brand: EquipmentBrand.SALOMON,
        model: 'Sight 2024',
        type: EquipmentType.SNOWBOARD,
        size: 'L',
        sizeCm: 158,
        level: SnowboardLevel.BEGINNER,
        color: '蓝色',
        purchaseDate: '2023-11-20',
        purchasePrice: 3200,
        currentStatus: RentalStatus.RENTED,
        location: '云顶雪具大厅A区',
        rentalCount: 15,
        isNewArrival: true,
        warehouseZone: 'A-01',
        shelfNumber: 'SHELF-A-002',
        createdAt: moment().subtract(5, 'months').toISOString(),
        updatedAt: moment().toISOString()
      },
      {
        id: uuidv4(),
        equipmentCode: 'SB-RO-003',
        rfidTag: 'RFID-88003',
        brand: EquipmentBrand.ROSSIGNOL,
        model: 'Experience 80',
        type: EquipmentType.SKI,
        size: 'L',
        sizeCm: 165,
        level: SnowboardLevel.ADVANCED,
        color: '红色',
        purchaseDate: '2023-09-10',
        purchasePrice: 5800,
        currentStatus: RentalStatus.AVAILABLE,
        location: '云顶雪具大厅B区',
        rentalCount: 35,
        isNewArrival: false,
        warehouseZone: 'B-02',
        shelfNumber: 'SHELF-B-001',
        createdAt: moment().subtract(8, 'months').toISOString(),
        updatedAt: moment().toISOString()
      },
      {
        id: uuidv4(),
        equipmentCode: 'BT-HE-004',
        rfidTag: 'RFID-88004',
        brand: EquipmentBrand.HEAD,
        model: 'Vector Evo',
        type: EquipmentType.BOOTS,
        size: '42',
        sizeCm: 27,
        level: SnowboardLevel.INTERMEDIATE,
        color: '白色',
        purchaseDate: '2023-12-01',
        purchasePrice: 2200,
        currentStatus: RentalStatus.AVAILABLE,
        location: '云顶雪具大厅C区',
        rentalCount: 22,
        isNewArrival: true,
        warehouseZone: 'C-01',
        shelfNumber: 'SHELF-C-003',
        createdAt: moment().subtract(4, 'months').toISOString(),
        updatedAt: moment().toISOString()
      },
      {
        id: uuidv4(),
        equipmentCode: 'SB-NI-005',
        rfidTag: 'RFID-88005',
        brand: EquipmentBrand.NITRO,
        model: 'T1 2024',
        type: EquipmentType.SNOWBOARD,
        size: 'XL',
        sizeCm: 162,
        level: SnowboardLevel.EXPERT,
        color: '迷彩',
        purchaseDate: '2024-01-15',
        purchasePrice: 5200,
        currentStatus: RentalStatus.MAINTENANCE,
        location: '云顶雪具大厅A区',
        rentalCount: 8,
        damageDescription: '板边轻微磨损',
        isNewArrival: true,
        warehouseZone: 'A-02',
        shelfNumber: 'SHELF-A-005',
        createdAt: moment().subtract(3, 'months').toISOString(),
        updatedAt: moment().toISOString()
      },
      {
        id: uuidv4(),
        equipmentCode: 'SB-CA-006',
        rfidTag: 'RFID-88006',
        brand: EquipmentBrand.CAPITA,
        model: 'Defenders of Awesome',
        type: EquipmentType.SNOWBOARD,
        size: 'M',
        sizeCm: 156,
        level: SnowboardLevel.ADVANCED,
        color: '绿色',
        purchaseDate: '2023-10-25',
        purchasePrice: 4800,
        currentStatus: RentalStatus.AVAILABLE,
        location: '云顶雪具大厅A区',
        rentalCount: 19,
        isNewArrival: false,
        warehouseZone: 'A-01',
        shelfNumber: 'SHELF-A-003',
        createdAt: moment().subtract(6, 'months').toISOString(),
        updatedAt: moment().toISOString()
      }
    ];

    sampleEquipments.forEach(eq => this.equipments.set(eq.id, eq));

    const sampleCustomers: Customer[] = [
      {
        id: uuidv4(),
        customerCode: 'CUST-2024001',
        name: '张三',
        phone: '13800138001',
        idCard: '110101199001011234',
        memberLevel: '黄金会员',
        heightCm: 175,
        weightKg: 70,
        shoeSize: 42,
        snowboardLevel: SnowboardLevel.INTERMEDIATE,
        totalRentalCount: 15,
        createdAt: moment().subtract(1, 'year').toISOString()
      },
      {
        id: uuidv4(),
        customerCode: 'CUST-2024002',
        name: '李四',
        phone: '13900139002',
        idCard: '110101199202022345',
        memberLevel: '普通会员',
        heightCm: 168,
        weightKg: 62,
        shoeSize: 40,
        snowboardLevel: SnowboardLevel.BEGINNER,
        totalRentalCount: 8,
        createdAt: moment().subtract(8, 'months').toISOString()
      },
      {
        id: uuidv4(),
        customerCode: 'CUST-2024003',
        name: '王五',
        phone: '13700137003',
        idCard: '110101198803033456',
        memberLevel: '钻石会员',
        heightCm: 182,
        weightKg: 80,
        shoeSize: 44,
        snowboardLevel: SnowboardLevel.EXPERT,
        totalRentalCount: 42,
        createdAt: moment().subtract(2, 'years').toISOString()
      }
    ];

    sampleCustomers.forEach(cust => this.customers.set(cust.id, cust));

    const customer1 = sampleCustomers[0];
    const equipment1 = sampleEquipments[0];
    const equipment2 = sampleEquipments[1];
    const equipment3 = sampleEquipments[2];

    const sampleRentals: RentalRecord[] = [
      {
        id: uuidv4(),
        rentalNo: 'RENT-20240501-001',
        customerId: customer1.id,
        customerCode: customer1.customerCode,
        customerName: customer1.name,
        equipmentId: equipment1.id,
        equipmentCode: equipment1.equipmentCode,
        equipmentType: equipment1.type,
        equipmentBrand: equipment1.brand,
        equipmentSize: equipment1.size,
        equipmentSizeCm: equipment1.sizeCm,
        rentalDate: moment().subtract(3, 'days').format('YYYY-MM-DD HH:mm:ss'),
        expectedReturnDate: moment().add(1, 'days').format('YYYY-MM-DD HH:mm:ss'),
        dailyRate: 180,
        depositAmount: 2000,
        status: 'RENTING',
        rentalPointCode: 'YD-001',
        rentalPointName: '云顶雪具租赁点',
        operatorId: 'OP-001',
        operatorName: '赵六',
        hasAdjustment: false,
        adjustmentCount: 0,
        reconciliationStatus: ReconciliationStatus.MATCHED,
        createdAt: moment().subtract(3, 'days').toISOString(),
        updatedAt: moment().toISOString()
      },
      {
        id: uuidv4(),
        rentalNo: 'RENT-20240501-002',
        customerId: customer1.id,
        customerCode: customer1.customerCode,
        customerName: customer1.name,
        equipmentId: equipment2.id,
        equipmentCode: equipment2.equipmentCode,
        equipmentType: equipment2.type,
        equipmentBrand: equipment2.brand,
        equipmentSize: equipment2.size,
        equipmentSizeCm: equipment2.sizeCm,
        rentalDate: moment().subtract(5, 'days').format('YYYY-MM-DD HH:mm:ss'),
        expectedReturnDate: moment().subtract(2, 'days').format('YYYY-MM-DD HH:mm:ss'),
        actualReturnDate: moment().subtract(2, 'days').format('YYYY-MM-DD HH:mm:ss'),
        dailyRate: 150,
        depositAmount: 1500,
        totalAmount: 450,
        status: 'RETURNED',
        rentalPointCode: 'YD-001',
        rentalPointName: '云顶雪具租赁点',
        operatorId: 'OP-001',
        operatorName: '赵六',
        hasAdjustment: true,
        adjustmentCount: 1,
        reconciliationStatus: ReconciliationStatus.PENDING,
        createdAt: moment().subtract(5, 'days').toISOString(),
        updatedAt: moment().subtract(2, 'days').toISOString()
      },
      {
        id: uuidv4(),
        rentalNo: 'RENT-20240510-003',
        customerId: sampleCustomers[1].id,
        customerCode: sampleCustomers[1].customerCode,
        customerName: sampleCustomers[1].name,
        equipmentId: equipment3.id,
        equipmentCode: equipment3.equipmentCode,
        equipmentType: equipment3.type,
        equipmentBrand: equipment3.brand,
        equipmentSize: equipment3.size,
        equipmentSizeCm: equipment3.sizeCm,
        rentalDate: moment().subtract(1, 'days').format('YYYY-MM-DD HH:mm:ss'),
        expectedReturnDate: moment().add(2, 'days').format('YYYY-MM-DD HH:mm:ss'),
        dailyRate: 200,
        depositAmount: 2500,
        status: 'RENTING',
        rentalPointCode: 'YD-001',
        rentalPointName: '云顶雪具租赁点',
        operatorId: 'OP-002',
        operatorName: '钱七',
        hasAdjustment: false,
        adjustmentCount: 0,
        reconciliationStatus: ReconciliationStatus.MATCHED,
        createdAt: moment().subtract(1, 'day').toISOString(),
        updatedAt: moment().toISOString()
      }
    ];

    sampleRentals.forEach(rental => this.rentalRecords.set(rental.id, rental));
  }

  getEquipmentById(id: string): SnowboardEquipment | undefined {
    return this.equipments.get(id);
  }

  getEquipmentByCode(code: string): SnowboardEquipment | undefined {
    return Array.from(this.equipments.values()).find(eq => eq.equipmentCode === code);
  }

  getAllEquipments(): SnowboardEquipment[] {
    return Array.from(this.equipments.values());
  }

  updateEquipment(id: string, data: Partial<SnowboardEquipment>): SnowboardEquipment | undefined {
    const equipment = this.equipments.get(id);
    if (equipment) {
      const updated = { ...equipment, ...data, updatedAt: moment().toISOString() };
      this.equipments.set(id, updated);
      return updated;
    }
    return undefined;
  }

  getCustomerById(id: string): Customer | undefined {
    return this.customers.get(id);
  }

  getCustomerByCode(code: string): Customer | undefined {
    return Array.from(this.customers.values()).find(cust => cust.customerCode === code);
  }

  getAllCustomers(): Customer[] {
    return Array.from(this.customers.values());
  }

  getRentalById(id: string): RentalRecord | undefined {
    return this.rentalRecords.get(id);
  }

  getRentalByNo(rentalNo: string): RentalRecord | undefined {
    return Array.from(this.rentalRecords.values()).find(r => r.rentalNo === rentalNo);
  }

  getAllRentals(): RentalRecord[] {
    return Array.from(this.rentalRecords.values());
  }

  updateRental(id: string, data: Partial<RentalRecord>): RentalRecord | undefined {
    const rental = this.rentalRecords.get(id);
    if (rental) {
      const updated = { ...rental, ...data, updatedAt: moment().toISOString() };
      this.rentalRecords.set(id, updated);
      return updated;
    }
    return undefined;
  }

  createAdjustment(data: Omit<AdjustmentRecord, 'id' | 'createdAt' | 'updatedAt'>): AdjustmentRecord {
    const id = uuidv4();
    const now = moment().toISOString();
    const adjustment: AdjustmentRecord = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.adjustmentRecords.set(id, adjustment);
    return adjustment;
  }

  getAdjustmentById(id: string): AdjustmentRecord | undefined {
    return this.adjustmentRecords.get(id);
  }

  getAdjustmentByNo(adjustmentNo: string): AdjustmentRecord | undefined {
    return Array.from(this.adjustmentRecords.values()).find(a => a.adjustmentNo === adjustmentNo);
  }

  getAdjustmentsByRentalId(rentalId: string): AdjustmentRecord[] {
    return Array.from(this.adjustmentRecords.values()).filter(a => a.rentalRecordId === rentalId);
  }

  getAllAdjustments(): AdjustmentRecord[] {
    return Array.from(this.adjustmentRecords.values());
  }

  updateAdjustment(id: string, data: Partial<AdjustmentRecord>): AdjustmentRecord | undefined {
    const adjustment = this.adjustmentRecords.get(id);
    if (adjustment) {
      const updated = { ...adjustment, ...data, updatedAt: moment().toISOString() };
      this.adjustmentRecords.set(id, updated);
      return updated;
    }
    return undefined;
  }

  createInventoryLog(data: Omit<InventoryLog, 'id' | 'createdAt'>): InventoryLog {
    const id = uuidv4();
    const log: InventoryLog = {
      ...data,
      id,
      createdAt: moment().toISOString()
    };
    this.inventoryLogs.set(id, log);
    return log;
  }

  getAllInventoryLogs(): InventoryLog[] {
    return Array.from(this.inventoryLogs.values());
  }

  createReconciliation(data: Omit<ReconciliationRecord, 'id' | 'createdAt'>): ReconciliationRecord {
    const id = uuidv4();
    const record: ReconciliationRecord = {
      ...data,
      id,
      createdAt: moment().toISOString()
    };
    this.reconciliationRecords.set(id, record);
    return record;
  }

  getAllReconciliations(): ReconciliationRecord[] {
    return Array.from(this.reconciliationRecords.values());
  }
}

export const db = new Database();
