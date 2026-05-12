'use client';

import { Prop, Crew, Rental, InspectionRecord, RentalStatus } from '@/types';

const generateId = () => Math.random().toString(36).substr(2, 9);

const initialProps: Prop[] = [
  {
    id: 'prop001',
    name: '复古欧式沙发',
    category: '家具',
    description: '19世纪风格真皮沙发，棕色，三人座',
    quantity: 2,
    availableQuantity: 1,
    dailyRate: 150,
    depositAmount: 500,
    status: 'available',
    tags: ['热门', '复古', '家具'],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'prop002',
    name: '古董落地灯',
    category: '灯具',
    description: '铜质复古落地灯，带布艺灯罩',
    quantity: 5,
    availableQuantity: 5,
    dailyRate: 80,
    depositAmount: 200,
    status: 'available',
    tags: ['灯具', '复古'],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'prop003',
    name: '民国风书桌',
    category: '家具',
    description: '实木书桌，带抽屉，深棕色',
    quantity: 3,
    availableQuantity: 2,
    dailyRate: 120,
    depositAmount: 400,
    status: 'available',
    tags: ['热门', '民国', '家具'],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'prop004',
    name: '丝绸背景布',
    category: '背景',
    description: '香槟色丝绸背景，3x5米',
    quantity: 10,
    availableQuantity: 8,
    dailyRate: 50,
    depositAmount: 100,
    status: 'available',
    tags: ['背景', '热门'],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'prop005',
    name: '复古电话机',
    category: '装饰',
    description: '黑色转盘电话机，可作为道具使用',
    quantity: 8,
    availableQuantity: 6,
    dailyRate: 40,
    depositAmount: 150,
    status: 'available',
    tags: ['装饰', '复古'],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
];

const initialCrews: Crew[] = [
  {
    id: 'crew001',
    name: '时光映像工作室',
    contactPerson: '张明',
    phone: '13800138001',
    email: 'zhang@timeimage.com',
    company: '时光映像文化传播有限公司',
    createdAt: '2024-01-20T10:00:00Z',
  },
  {
    id: 'crew002',
    name: '星光影视团队',
    contactPerson: '李华',
    phone: '13800138002',
    email: 'lihua@starlight.com',
    company: '星光影视制作有限公司',
    createdAt: '2024-02-01T10:00:00Z',
  },
  {
    id: 'crew003',
    name: '彩虹摄影组',
    contactPerson: '王芳',
    phone: '13800138003',
    email: 'wangfang@rainbow.com',
    createdAt: '2024-02-15T10:00:00Z',
  },
];

const initialRentals: Rental[] = [
  {
    id: 'rental001',
    crewId: 'crew001',
    crewName: '时光映像工作室',
    items: [
      { propId: 'prop001', propName: '复古欧式沙发', quantity: 1, unitPrice: 150, depositAmount: 500 },
      { propId: 'prop002', propName: '古董落地灯', quantity: 2, unitPrice: 80, depositAmount: 200 },
    ],
    startDate: '2024-05-10',
    endDate: '2024-05-15',
    totalDays: 5,
    subtotal: 1550,
    totalDeposit: 900,
    depositPaid: true,
    status: 'completed',
    notes: '民国风电视剧拍摄使用',
    createdAt: '2024-05-05T10:00:00Z',
    updatedAt: '2024-05-16T10:00:00Z',
    createdBy: 'admin',
  },
  {
    id: 'rental002',
    crewId: 'crew002',
    crewName: '星光影视团队',
    items: [
      { propId: 'prop003', propName: '民国风书桌', quantity: 1, unitPrice: 120, depositAmount: 400 },
      { propId: 'prop004', propName: '丝绸背景布', quantity: 2, unitPrice: 50, depositAmount: 100 },
    ],
    startDate: '2024-05-18',
    endDate: '2024-05-22',
    totalDays: 4,
    subtotal: 880,
    totalDeposit: 600,
    depositPaid: true,
    status: 'picked_up',
    notes: '广告片拍摄',
    createdAt: '2024-05-10T10:00:00Z',
    updatedAt: '2024-05-18T10:00:00Z',
    createdBy: 'admin',
  },
  {
    id: 'rental003',
    crewId: 'crew003',
    crewName: '彩虹摄影组',
    items: [
      { propId: 'prop005', propName: '复古电话机', quantity: 2, unitPrice: 40, depositAmount: 150, damagedQuantity: 1, damageDescription: '听筒断裂' },
    ],
    startDate: '2024-05-08',
    endDate: '2024-05-12',
    totalDays: 4,
    subtotal: 320,
    totalDeposit: 300,
    depositPaid: true,
    damageCompensation: 200,
    compensationPaid: false,
    status: 'damaged',
    notes: '复古写真拍摄，归还时发现1台电话机听筒断裂',
    createdAt: '2024-05-06T10:00:00Z',
    updatedAt: '2024-05-13T10:00:00Z',
    createdBy: 'admin',
  },
];

class Store {
  private props: Prop[] = [...initialProps];
  private crews: Crew[] = [...initialCrews];
  private rentals: Rental[] = [...initialRentals];
  private inspections: InspectionRecord[] = [];

  getProps(): Prop[] { return [...this.props]; }
  getProp(id: string): Prop | undefined { return this.props.find(p => p.id === id); }
  
  addProp(prop: Omit<Prop, 'id' | 'createdAt' | 'updatedAt'>): Prop {
    const newProp: Prop = { ...prop, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    this.props.push(newProp);
    return newProp;
  }

  updateProp(id: string, updates: Partial<Prop>): Prop | undefined {
    const index = this.props.findIndex(p => p.id === id);
    if (index === -1) return undefined;
    this.props[index] = { ...this.props[index], ...updates, updatedAt: new Date().toISOString() };
    return this.props[index];
  }

  deleteProp(id: string): boolean {
    const index = this.props.findIndex(p => p.id === id);
    if (index === -1) return false;
    this.props.splice(index, 1);
    return true;
  }

  getCrews(): Crew[] { return [...this.crews]; }
  getCrew(id: string): Crew | undefined { return this.crews.find(c => c.id === id); }
  
  addCrew(crew: Omit<Crew, 'id' | 'createdAt'>): Crew {
    const newCrew: Crew = { ...crew, id: generateId(), createdAt: new Date().toISOString() };
    this.crews.push(newCrew);
    return newCrew;
  }

  updateCrew(id: string, updates: Partial<Crew>): Crew | undefined {
    const index = this.crews.findIndex(c => c.id === id);
    if (index === -1) return undefined;
    this.crews[index] = { ...this.crews[index], ...updates };
    return this.crews[index];
  }

  deleteCrew(id: string): boolean {
    const index = this.crews.findIndex(c => c.id === id);
    if (index === -1) return false;
    this.crews.splice(index, 1);
    return true;
  }

  getRentals(): Rental[] { return [...this.rentals]; }
  getRental(id: string): Rental | undefined { return this.rentals.find(r => r.id === id); }

  checkScheduleConflict(propIds: string[], startDate: string, endDate: string, excludeRentalId?: string): string[] {
    const conflicts: string[] = [];
    const propRentals = this.rentals.filter(r => 
      r.status !== 'cancelled' && 
      r.id !== excludeRentalId &&
      r.items.some(item => propIds.includes(item.propId))
    );

    for (const rental of propRentals) {
      const overlap = !(endDate < rental.startDate || startDate > rental.endDate);
      if (overlap) {
        for (const item of rental.items) {
          if (propIds.includes(item.propId) && !conflicts.includes(item.propName)) {
            conflicts.push(item.propName);
          }
        }
      }
    }
    return conflicts;
  }

  addRental(rental: Omit<Rental, 'id' | 'createdAt' | 'updatedAt'>): { rental: Rental; conflicts: string[] } {
    const propIds = rental.items.map(item => item.propId);
    const conflicts = this.checkScheduleConflict(propIds, rental.startDate, rental.endDate);
    
    if (conflicts.length > 0) {
      return { rental: {} as Rental, conflicts };
    }

    const duplicateCheck = this.rentals.find(r => 
      r.crewId === rental.crewId && 
      r.startDate === rental.startDate &&
      r.items.every(item => rental.items.some(ri => ri.propId === item.propId))
    );

    if (duplicateCheck) {
      return { rental: duplicateCheck, conflicts: ['DUPLICATE'] };
    }

    const newRental: Rental = { ...rental, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    this.rentals.push(newRental);
    return { rental: newRental, conflicts: [] };
  }

  updateRental(id: string, updates: Partial<Rental>): Rental | undefined {
    const index = this.rentals.findIndex(r => r.id === id);
    if (index === -1) return undefined;
    this.rentals[index] = { ...this.rentals[index], ...updates, updatedAt: new Date().toISOString() };
    return this.rentals[index];
  }

  getInspections(): InspectionRecord[] { return [...this.inspections]; }
  
  addInspection(inspection: Omit<InspectionRecord, 'id'>): InspectionRecord {
    const newInspection: InspectionRecord = { ...inspection, id: generateId() };
    this.inspections.push(newInspection);
    return newInspection;
  }

  getPendingReturns(): Rental[] {
    return this.rentals.filter(r => ['picked_up', 'returned', 'cleaning'].includes(r.status));
  }

  getPendingCompensations(): Rental[] {
    return this.rentals.filter(r => r.status === 'damaged' && !r.compensationPaid);
  }
}

export const store = new Store();
