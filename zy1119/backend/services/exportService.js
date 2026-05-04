const XLSX = require('xlsx');
const { Order, OrderItem, Product, PickupSlot, Exception, InventoryAllocation, InventoryBatch } = require('../models');
const dayjs = require('dayjs');

const generatePickupList = async (date = null) => {
  const targetDate = date || dayjs().format('YYYY-MM-DD');
  
  const orders = await Order.findAll({
    include: [
      {
        model: OrderItem,
        include: [
          Product,
          {
            model: InventoryAllocation,
            include: [InventoryBatch]
          }
        ]
      },
      {
        model: PickupSlot,
        where: { date: targetDate }
      }
    ],
    where: {
      status: { [Op.in]: ['paid', 'allocated'] }
    },
    order: [
      [PickupSlot, 'start_time', 'ASC'],
      ['customer_name', 'ASC']
    ]
  });

  const pickupList = orders.map(order => {
    const items = order.OrderItems.map(item => ({
      productName: item.Product?.name,
      sku: item.Product?.sku,
      quantity: item.quantity,
      unit: item.Product?.unit,
      allocated: item.allocated_quantity,
      picked: item.picked_quantity,
      isExpiryPriority: item.InventoryAllocations?.some(alloc => alloc.is_expiry_priority) || false,
      expiryDates: item.InventoryAllocations?.map(alloc => 
        alloc.InventoryBatch?.expiry_date
      ).filter(Boolean) || []
    }));

    return {
      orderNo: order.order_no,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      customerAddress: order.customer_address,
      pickupCode: order.pickup_code,
      pickupSlot: {
        date: order.PickupSlot?.date,
        startTime: order.PickupSlot?.start_time,
        endTime: order.PickupSlot?.end_time
      },
      totalAmount: order.total_amount,
      status: order.status,
      items,
      hasExpiryItems: items.some(item => item.isExpiryPriority),
      note: order.note
    };
  });

  const summary = {
    date: targetDate,
    totalOrders: orders.length,
    totalAmount: orders.reduce((sum, o) => sum + parseFloat(o.total_amount), 0).toFixed(2),
    slotsSummary: pickupList.reduce((acc, order) => {
      const slotKey = `${order.pickupSlot.startTime}-${order.pickupSlot.endTime}`;
      if (!acc[slotKey]) {
        acc[slotKey] = {
          time: `${order.pickupSlot.startTime}-${order.pickupSlot.endTime}`,
          orderCount: 0,
          hasExpiryOrders: 0
        };
      }
      acc[slotKey].orderCount++;
      if (order.hasExpiryItems) acc[slotKey].hasExpiryOrders++;
      return acc;
    }, {})
  };

  return {
    summary,
    pickupList,
    generatedAt: new Date().toISOString()
  };
};

const generateShortageReport = async (date = null) => {
  const exceptions = await Exception.findAll({
    where: {
      type: 'shortage',
      status: { [Op.in]: ['open', 'processing'] }
    },
    include: [
      { model: Order, attributes: ['id', 'order_no', 'customer_name', 'customer_phone'] },
      { model: Product, attributes: ['id', 'name', 'sku', 'unit'] }
    ],
    order: [['created_at', 'DESC']]
  });

  const shortageItems = exceptions.map(ex => ({
    exceptionId: ex.id,
    orderNo: ex.Order?.order_no,
    customerName: ex.Order?.customer_name,
    customerPhone: ex.Order?.customer_phone,
    productName: ex.Product?.name,
    productSku: ex.Product?.sku,
    unit: ex.Product?.unit,
    affectedQuantity: ex.affected_quantity,
    description: ex.description,
    action: ex.action,
    status: ex.status,
    createdAt: ex.created_at
  }));

  const summary = {
    totalShortages: shortageItems.length,
    totalAffectedQuantity: shortageItems.reduce((sum, item) => sum + item.affectedQuantity, 0),
    byProduct: shortageItems.reduce((acc, item) => {
      if (!acc[item.productSku]) {
        acc[item.productSku] = {
          productName: item.productName,
          productSku: item.productSku,
          unit: item.unit,
          totalQuantity: 0,
          orderCount: 0
        };
      }
      acc[item.productSku].totalQuantity += item.affectedQuantity;
      acc[item.productSku].orderCount++;
      return acc;
    }, {}),
    pendingAction: shortageItems.filter(item => item.action === 'pending').length
  };

  return {
    summary,
    shortageItems,
    generatedAt: new Date().toISOString()
  };
};

const generateRefundReport = async (date = null) => {
  const exceptions = await Exception.findAll({
    where: {
      action: 'refund',
      status: { [Op.in]: ['open', 'processing', 'resolved'] }
    },
    include: [
      { 
        model: Order, 
        attributes: ['id', 'order_no', 'customer_name', 'customer_phone', 'total_amount'],
        include: [{
          model: OrderItem,
          where: sequelize.literal('`Order`.`id` = `OrderItems`.`order_id` AND `OrderItems`.`product_id` = `Exception`.`product_id`'),
          attributes: ['unit_price', 'quantity']
        }]
      },
      { model: Product, attributes: ['id', 'name', 'sku', 'unit', 'price'] }
    ],
    order: [['created_at', 'DESC']]
  });

  const refundItems = exceptions.map(ex => {
    const orderItem = ex.Order?.OrderItems?.[0];
    const unitPrice = orderItem?.unit_price || ex.Product?.price || 0;
    const refundAmount = unitPrice * ex.affected_quantity;

    return {
      exceptionId: ex.id,
      orderNo: ex.Order?.order_no,
      customerName: ex.Order?.customer_name,
      customerPhone: ex.Order?.customer_phone,
      productName: ex.Product?.name,
      productSku: ex.Product?.sku,
      unit: ex.Product?.unit,
      affectedQuantity: ex.affected_quantity,
      unitPrice: unitPrice,
      refundAmount: refundAmount.toFixed(2),
      description: ex.description,
      actionDetail: ex.action_detail,
      status: ex.status,
      resolvedAt: ex.resolved_at,
      createdAt: ex.created_at
    };
  });

  const summary = {
    totalRefunds: refundItems.length,
    totalRefundAmount: refundItems.reduce((sum, item) => sum + parseFloat(item.refundAmount), 0).toFixed(2),
    byStatus: {
      pending: refundItems.filter(item => item.status === 'open' || item.status === 'processing').length,
      resolved: refundItems.filter(item => item.status === 'resolved').length
    },
    byProduct: refundItems.reduce((acc, item) => {
      if (!acc[item.productSku]) {
        acc[item.productSku] = {
          productName: item.productName,
          productSku: item.productSku,
          unit: item.unit,
          totalQuantity: 0,
          totalAmount: 0,
          orderCount: 0
        };
      }
      acc[item.productSku].totalQuantity += item.affectedQuantity;
      acc[item.productSku].totalAmount += parseFloat(item.refundAmount);
      acc[item.productSku].orderCount++;
      return acc;
    }, {})
  };

  return {
    summary,
    refundItems,
    generatedAt: new Date().toISOString()
  };
};

const exportToExcel = async (data, sheetName = 'Sheet1') => {
  const wb = XLSX.utils.book_new();
  
  if (Array.isArray(data)) {
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  } else if (data && data.summary && data.pickupList) {
    const summaryData = [
      ['自提清单汇总'],
      ['日期', data.summary.date],
      ['总订单数', data.summary.totalOrders],
      ['总金额', `¥${data.summary.totalAmount}`],
      [],
      ['时段汇总']
    ];
    
    Object.values(data.summary.slotsSummary).forEach(slot => {
      summaryData.push([
        `时段: ${slot.time}`,
        `订单数: ${slot.orderCount}`,
        `含临期商品: ${slot.hasExpiryOrders}单`
      ]);
    });
    
    summaryData.push([]);
    summaryData.push(['订单明细']);
    summaryData.push(['订单号', '客户姓名', '电话', '自提码', '时段', '商品', '数量', '金额', '状态', '备注']);
    
    data.pickupList.forEach(order => {
      order.items.forEach((item, idx) => {
        summaryData.push([
          idx === 0 ? order.orderNo : '',
          idx === 0 ? order.customerName : '',
          idx === 0 ? order.customerPhone : '',
          idx === 0 ? order.pickupCode : '',
          idx === 0 ? `${order.pickupSlot.startTime}-${order.pickupSlot.endTime}` : '',
          item.productName + (item.isExpiryPriority ? ' [临期优先]' : ''),
          item.quantity,
          idx === 0 ? `¥${order.totalAmount}` : '',
          idx === 0 ? order.status : '',
          idx === 0 ? order.note : ''
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws, '自提清单');
  }

  return wb;
};

const getOverdueReminders = async () => {
  const today = dayjs();
  const yesterday = today.subtract(1, 'day');

  const overdueOrders = await Order.findAll({
    include: [
      {
        model: OrderItem,
        include: [Product]
      },
      {
        model: PickupSlot
      }
    ],
    where: {
      status: { [Op.in]: ['paid', 'allocated'] },
      [Op.and]: [
        sequelize.where(
          sequelize.col('PickupSlot.date'),
          '<',
          today.format('YYYY-MM-DD')
        )
      ]
    }
  });

  const reminders = overdueOrders.map(order => ({
    orderNo: order.order_no,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    pickupSlot: {
      date: order.PickupSlot?.date,
      startTime: order.PickupSlot?.start_time,
      endTime: order.PickupSlot?.endTime
    },
    daysOverdue: today.diff(dayjs(order.PickupSlot?.date), 'day'),
    items: order.OrderItems?.map(item => ({
      productName: item.Product?.name,
      quantity: item.quantity,
      isExpiry: item.Product?.shelf_life_days && 
                dayjs(order.PickupSlot?.date).add(item.Product.shelf_life_days, 'day').isBefore(today)
    })),
    totalAmount: order.total_amount,
    note: order.note
  }));

  return {
    totalOverdue: reminders.length,
    reminders,
    urgentReminders: reminders.filter(r => r.daysOverdue > 1),
    message: reminders.length > 0 
      ? `发现${reminders.length}个逾期未自提订单，请及时联系客户` 
      : '无逾期未自提订单'
  };
};

module.exports = {
  generatePickupList,
  generateShortageReport,
  generateRefundReport,
  exportToExcel,
  getOverdueReminders
};
