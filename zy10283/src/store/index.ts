import { create } from 'zustand';
import {
  RepairOrder,
  Customer,
  RepairStatus,
  CreateOrderDTO,
  UpdateOrderDTO,
  QuoteConfirmDTO,
  PickupDTO,
  DashboardStats,
  RepairItem,
  DuplicateCheckResult,
  PickupValidationResult
} from '../types';
import { addDays, differenceInDays, isBefore, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface RepairStore {
  orders: RepairOrder[];
  customers: Customer[];
  currentUser: string;
  selectedOrder: RepairOrder | null;
  
  addOrder: (order: CreateOrderDTO) => RepairOrder;
  updateOrder: (orderId: string, data: UpdateOrderDTO) => void;
  deleteOrder: (orderId: string) => void;
  selectOrder: (order: RepairOrder | null) => void;
  
  updateStatus: (orderId: string, status: RepairStatus, note?: string) => { success: boolean; error?: string };
  confirmQuote: (orderId: string, data: QuoteConfirmDTO) => void;
  pickupOrder: (orderId: string, data: PickupDTO) => void;
  addPhoto: (orderId: string, url: string, description: string) => void;
  
  addRepairItem: (orderId: string, item: Omit<RepairItem, 'id'>) => void;
  updateRepairItem: (orderId: string, itemId: string, updates: Partial<RepairItem>) => void;
  deleteRepairItem: (orderId: string, itemId: string) => void;
  
  checkDuplicate: (data: CreateOrderDTO) => DuplicateCheckResult;
  validatePickup: (orderId: string, data: PickupDTO) => PickupValidationResult;
  
  getOrdersByStatus: (status: RepairStatus) => RepairOrder[];
  searchOrders: (keyword: string) => RepairOrder[];
  getOverdueOrders: () => RepairOrder[];
  getUnquotedRepairingOrders: () => RepairOrder[];
  getDashboardStats: () => DashboardStats;
  
  calculateOverdueFee: (order: RepairOrder) => number;
  calculateTotalEstimatedPrice: (order: RepairOrder) => number;
  exportOrderForSignature: (order: RepairOrder) => string;
}

const generateOrderNo = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `JX${year}${month}${day}${random}`;
};

const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

const initialOrders: RepairOrder[] = [
  {
    id: generateId(),
    orderNo: generateOrderNo(),
    customerId: generateId(),
    customerName: '张三',
    customerPhone: '13800138000',
    jewelryName: '18K金钻石戒指',
    jewelryDescription: '主钻0.5ct，副钻8颗，戒托有磨损，需要翻新抛光',
    jewelryMaterial: '18K金',
    diamondCount: 9,
    weight: 3.5,
    estimatedPrice: 500,
    finalPrice: 500,
    deposit: 200,
    status: RepairStatus.REPAIRING,
    quoteConfirmedAt: new Date().toISOString(),
    quoteConfirmedBy: '李店员',
    estimatedPickupDate: addDays(new Date(), 3).toISOString(),
    registeredBy: '李店员',
    registeredAt: new Date().toISOString(),
    photos: [],
    statusHistory: [
      {
        id: generateId(),
        orderId: '',
        status: RepairStatus.REGISTERED,
        operator: '李店员',
        createdAt: new Date().toISOString()
      },
      {
        id: generateId(),
        orderId: '',
        status: RepairStatus.QUOTED,
        operator: '李店员',
        createdAt: new Date().toISOString()
      },
      {
        id: generateId(),
        orderId: '',
        status: RepairStatus.QUOTE_CONFIRMED,
        operator: '李店员',
        createdAt: new Date().toISOString()
      },
      {
        id: generateId(),
        orderId: '',
        status: RepairStatus.REPAIRING,
        operator: '王师傅',
        note: '开始维修',
        createdAt: new Date().toISOString()
      }
    ],
    repairItems: [
      {
        id: generateId(),
        name: '戒托翻新',
        description: '抛光翻新，去除划痕',
        estimatedPrice: 200,
        completed: true
      },
      {
        id: generateId(),
        name: '钻石加固',
        description: '检查并加固8颗副钻',
        estimatedPrice: 300,
        completed: false
      }
    ]
  },
  {
    id: generateId(),
    orderNo: generateOrderNo(),
    customerId: generateId(),
    customerName: '李四',
    customerPhone: '13900139000',
    jewelryName: '铂金项链',
    jewelryDescription: '链子断裂，需要焊接',
    jewelryMaterial: 'PT950',
    weight: 8.2,
    estimatedPrice: 200,
    status: RepairStatus.QUOTED,
    estimatedPickupDate: addDays(new Date(), 5).toISOString(),
    registeredBy: '李店员',
    registeredAt: new Date().toISOString(),
    photos: [],
    statusHistory: [
      {
        id: generateId(),
        orderId: '',
        status: RepairStatus.REGISTERED,
        operator: '李店员',
        createdAt: new Date().toISOString()
      },
      {
        id: generateId(),
        orderId: '',
        status: RepairStatus.QUOTED,
        operator: '李店员',
        createdAt: new Date().toISOString()
      }
    ],
    repairItems: [
      {
        id: generateId(),
        name: '焊接修复',
        description: '项链断裂处激光焊接',
        estimatedPrice: 150,
        completed: false
      },
      {
        id: generateId(),
        name: '整体抛光',
        description: '整条项链抛光翻新',
        estimatedPrice: 50,
        completed: false
      }
    ]
  }
];

export const useRepairStore = create<RepairStore>((set, get) => ({
  orders: initialOrders,
  customers: [],
  currentUser: '李店员',
  selectedOrder: null,

  checkDuplicate: (data) => {
    const { orders } = get();
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentOrders = orders.filter(o => {
      const registeredAt = new Date(o.registeredAt);
      return registeredAt >= oneHourAgo && o.status !== RepairStatus.CANCELLED;
    });
    
    const phoneMatch = recentOrders.find(o => o.customerPhone === data.customerPhone);
    if (phoneMatch) {
      const jewelrySimilar = 
        phoneMatch.jewelryName === data.jewelryName ||
        phoneMatch.jewelryDescription === data.jewelryDescription;
      
      if (jewelrySimilar) {
        return {
          isDuplicate: true,
          reason: '同一客户1小时内已登记过相同首饰，请确认是否重复录入',
          existingOrderNo: phoneMatch.orderNo
        };
      }
    }
    
    const exactMatch = recentOrders.find(o => 
      o.customerName === data.customerName &&
      o.customerPhone === data.customerPhone &&
      o.jewelryName === data.jewelryName &&
      o.jewelryDescription === data.jewelryDescription
    );
    
    if (exactMatch) {
      return {
        isDuplicate: true,
        reason: '存在完全相同的寄存记录，请确认是否重复提交',
        existingOrderNo: exactMatch.orderNo
      };
    }
    
    return { isDuplicate: false };
  },

  validatePickup: (orderId, data) => {
    const { orders } = get();
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      return {
        isValid: false,
        isCustomerMatch: false,
        isIdCardMatch: false,
        warnings: ['订单不存在'],
        requiresIdCard: false
      };
    }

    const warnings: string[] = [];
    const isCustomerMatch = 
      data.pickerName === order.customerName && 
      data.pickerPhone === order.customerPhone;
    
    const isIdCardMatch = 
      !order.customerIdCard || 
      !data.pickerIdCard || 
      data.pickerIdCard === order.customerIdCard;
    
    const totalAmount = (order.finalPrice || order.estimatedPrice || 0) + 
      get().calculateOverdueFee(order) - (order.deposit || 0);
    const requiresIdCard = totalAmount > 5000;

    if (!isCustomerMatch) {
      warnings.push('取件人信息与登记客户信息不一致，请核实身份');
    }
    
    if (order.customerIdCard && data.pickerIdCard && !isIdCardMatch) {
      warnings.push('身份证号码与登记信息不一致');
    }
    
    if (requiresIdCard && !data.pickerIdCard) {
      warnings.push('贵重物品取件需出示身份证登记');
    }

    return {
      isValid: isCustomerMatch && isIdCardMatch && (!requiresIdCard || !!data.pickerIdCard),
      isCustomerMatch,
      isIdCardMatch,
      warnings,
      requiresIdCard
    };
  },

  addOrder: (data) => {
    const order: RepairOrder = {
      id: generateId(),
      orderNo: generateOrderNo(),
      customerId: generateId(),
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerIdCard: data.customerIdCard,
      jewelryName: data.jewelryName,
      jewelryDescription: data.jewelryDescription,
      jewelryMaterial: data.jewelryMaterial,
      diamondCount: data.diamondCount,
      weight: data.weight,
      deposit: data.deposit,
      status: RepairStatus.REGISTERED,
      estimatedPickupDate: data.estimatedPickupDate,
      registeredBy: get().currentUser,
      registeredAt: new Date().toISOString(),
      note: data.note,
      photos: [],
      statusHistory: [
        {
          id: generateId(),
          orderId: '',
          status: RepairStatus.REGISTERED,
          operator: get().currentUser,
          createdAt: new Date().toISOString()
        }
      ],
      repairItems: data.repairItems || []
    };
    set((state) => ({ orders: [...state.orders, order] }));
    return order;
  },

  addRepairItem: (orderId, item) => {
    set((state) => ({
      orders: state.orders.map((order) => {
        if (order.id !== orderId) return order;
        return {
          ...order,
          repairItems: [...order.repairItems, { ...item, id: generateId() }]
        };
      })
    }));
  },

  updateRepairItem: (orderId, itemId, updates) => {
    set((state) => ({
      orders: state.orders.map((order) => {
        if (order.id !== orderId) return order;
        return {
          ...order,
          repairItems: order.repairItems.map((item) =>
            item.id === itemId ? { ...item, ...updates } : item
          )
        };
      })
    }));
  },

  deleteRepairItem: (orderId, itemId) => {
    set((state) => ({
      orders: state.orders.map((order) => {
        if (order.id !== orderId) return order;
        return {
          ...order,
          repairItems: order.repairItems.filter((item) => item.id !== itemId)
        };
      })
    }));
  },

  calculateTotalEstimatedPrice: (order) => {
    return order.repairItems.reduce((sum, item) => sum + item.estimatedPrice, 0);
  },

  updateOrder: (orderId, data) => {
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId ? { ...order, ...data } : order
      )
    }));
  },

  deleteOrder: (orderId) => {
    set((state) => ({
      orders: state.orders.filter((order) => order.id !== orderId)
    }));
  },

  selectOrder: (order) => {
    set({ selectedOrder: order });
  },

  updateStatus: (orderId, status, note) => {
    const { orders } = get();
    const order = orders.find(o => o.id === orderId);
    
    if (!order) {
      return { success: false, error: '订单不存在' };
    }
    
    if (order.status === RepairStatus.PICKED_UP) {
      return { success: false, error: '已取件订单不能修改状态' };
    }
    
    if (status === RepairStatus.REPAIRING && !order.quoteConfirmedAt) {
      return { success: false, error: '未完成报价确认的订单不能进入维修状态' };
    }

    set((state) => ({
      orders: state.orders.map((order) => {
        if (order.id !== orderId) return order;

        const newHistory = {
          id: generateId(),
          orderId,
          status,
          operator: state.currentUser,
          note,
          createdAt: new Date().toISOString()
        };

        const updates: Partial<RepairOrder> = {
          status,
          statusHistory: [...order.statusHistory, newHistory]
        };

        if (status === RepairStatus.COMPLETED) {
          updates.completedAt = new Date().toISOString();
        }

        return { ...order, ...updates };
      })
    }));
    
    return { success: true };
  },

  confirmQuote: (orderId, data) => {
    set((state) => ({
      orders: state.orders.map((order) => {
        if (order.id !== orderId) return order;

        const newHistory = {
          id: generateId(),
          orderId,
          status: RepairStatus.QUOTE_CONFIRMED,
          operator: data.confirmedBy,
          createdAt: new Date().toISOString()
        };

        return {
          ...order,
          finalPrice: data.finalPrice,
          quoteConfirmedAt: new Date().toISOString(),
          quoteConfirmedBy: data.confirmedBy,
          status: RepairStatus.QUOTE_CONFIRMED,
          statusHistory: [...order.statusHistory, newHistory]
        };
      })
    }));
  },

  pickupOrder: (orderId, data) => {
    const { orders, calculateOverdueFee } = get();
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const overdueFee = calculateOverdueFee(order);

    set((state) => ({
      orders: state.orders.map((o) => {
        if (o.id !== orderId) return o;

        const newHistory = {
          id: generateId(),
          orderId,
          status: RepairStatus.PICKED_UP,
          operator: state.currentUser,
          note: `取件人：${data.pickerName}，电话：${data.pickerPhone}，支付金额：${data.paidAmount}`,
          createdAt: new Date().toISOString()
        };

        return {
          ...o,
          pickerName: data.pickerName,
          pickerPhone: data.pickerPhone,
          pickerIdCard: data.pickerIdCard,
          pickedUpAt: new Date().toISOString(),
          overdueFee,
          status: RepairStatus.PICKED_UP,
          statusHistory: [...o.statusHistory, newHistory]
        };
      })
    }));
  },

  addPhoto: (orderId, url, description) => {
    set((state) => ({
      orders: state.orders.map((order) => {
        if (order.id !== orderId) return order;
        return {
          ...order,
          photos: [
            ...order.photos,
            {
              id: generateId(),
              orderId,
              url,
              description,
              uploadedAt: new Date().toISOString()
            }
          ]
        };
      })
    }));
  },

  getOrdersByStatus: (status) => {
    return get().orders.filter((order) => order.status === status);
  },

  searchOrders: (keyword) => {
    const lowerKeyword = keyword.toLowerCase();
    return get().orders.filter(
      (order) =>
        order.orderNo.toLowerCase().includes(lowerKeyword) ||
        order.customerName.toLowerCase().includes(lowerKeyword) ||
        order.customerPhone.includes(keyword) ||
        order.jewelryName.toLowerCase().includes(lowerKeyword)
    );
  },

  getOverdueOrders: () => {
    const now = new Date();
    return get().orders.filter((order) => {
      if (order.status === RepairStatus.PICKED_UP || !order.estimatedPickupDate) return false;
      return isBefore(new Date(order.estimatedPickupDate), now);
    });
  },

  getUnquotedRepairingOrders: () => {
    return get().orders.filter(
      (order) =>
        order.status === RepairStatus.REPAIRING &&
        !order.quoteConfirmedAt
    );
  },

  getDashboardStats: () => {
    const { orders } = get();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      totalOrders: orders.length,
      pendingOrders: orders.filter(
        (o) => o.status !== RepairStatus.PICKED_UP && o.status !== RepairStatus.CANCELLED
      ).length,
      repairingOrders: orders.filter((o) => o.status === RepairStatus.REPAIRING).length,
      completedToday: orders.filter(
        (o) => o.completedAt && new Date(o.completedAt) >= today
      ).length,
      pickedUpToday: orders.filter(
        (o) => o.pickedUpAt && new Date(o.pickedUpAt) >= today
      ).length,
      totalRevenue: orders
        .filter((o) => o.pickedUpAt)
        .reduce((sum, o) => sum + (o.finalPrice || 0) + (o.overdueFee || 0), 0),
      overdueOrders: get().getOverdueOrders().length,
      unquotedRepairing: get().getUnquotedRepairingOrders().length
    };
  },

  calculateOverdueFee: (order) => {
    if (!order.estimatedPickupDate || order.status === RepairStatus.PICKED_UP) {
      return order.overdueFee || 0;
    }

    const daysOverdue = differenceInDays(new Date(), new Date(order.estimatedPickupDate));
    if (daysOverdue <= 0) return 0;

    const dailyFee = 5;
    const maxFee = (order.finalPrice || order.estimatedPrice || 0) * 0.1;
    return Math.min(daysOverdue * dailyFee, maxFee);
  },

  exportOrderForSignature: (order) => {
    const totalAmount = (order.finalPrice || 0) + (order.overdueFee || 0) - (order.deposit || 0);
    
    const repairItemsText = order.repairItems.length > 0
      ? order.repairItems.map((item, i) => 
          `  ${i + 1}. ${item.name}：${item.description}（${item.estimatedPrice}元）`
        ).join('\n')
      : '  无';
    
    return `
珠宝维修取件确认单
==================

订单编号：${order.orderNo}
登记日期：${format(new Date(order.registeredAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
店员：${order.registeredBy}

客户信息
--------
姓名：${order.customerName}
电话：${order.customerPhone}
身份证号：${order.customerIdCard || '未登记'}

首饰信息
--------
名称：${order.jewelryName}
描述：${order.jewelryDescription}
材质：${order.jewelryMaterial || '-'}
钻石数量：${order.diamondCount || 0}颗
重量：${order.weight || '-'}g

维修项目
--------
${repairItemsText}

费用明细
--------
维修费：${order.finalPrice || order.estimatedPrice || 0}元
逾期保管费：${order.overdueFee || 0}元
押金：${order.deposit || 0}元
应收金额：${Math.max(0, totalAmount)}元

取件信息
--------
预计取件日期：${order.estimatedPickupDate ? format(new Date(order.estimatedPickupDate), 'yyyy年MM月dd日', { locale: zhCN }) : '-'}

客户确认签字：__________________
日期：__________________

备注：本人确认首饰已核对无误，钻石数量与登记时一致，首饰外观无异议。取件人已核实身份信息。
    `.trim();
  }
}));
