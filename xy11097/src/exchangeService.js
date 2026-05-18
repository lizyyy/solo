const { run, get, all } = require('./database');

const EXCHANGE_ERRORS = {
  STUDENT_NOT_FOUND: {
    code: 'STUDENT_NOT_FOUND',
    message: '学生信息不存在',
    solution: '请检查学号是否正确'
  },
  ORIGINAL_ORDER_NOT_FOUND: {
    code: 'ORIGINAL_ORDER_NOT_FOUND',
    message: '原始订单不存在',
    solution: '请检查原始订单号是否正确'
  },
  ORDER_NOT_RECEIVED: {
    code: 'ORDER_NOT_RECEIVED',
    message: '该订单校服尚未领取，无法换货',
    solution: '请先领取校服后再申请换货'
  },
  SIZE_NOT_FOUND: {
    code: 'SIZE_NOT_FOUND',
    message: '目标尺码不存在',
    solution: '请选择正确的目标尺码'
  },
  SAME_SIZE_EXCHANGE: {
    code: 'SAME_SIZE_EXCHANGE',
    message: '目标尺码与原尺码相同',
    solution: '请选择与原尺码不同的目标尺码'
  },
  INVENTORY_INSUFFICIENT: {
    code: 'INVENTORY_INSUFFICIENT',
    message: '目标尺码库存不足',
    solution: '请选择其他尺码或等待补货后再申请'
  },
  PENDING_EXCHANGE_EXISTS: {
    code: 'PENDING_EXCHANGE_EXISTS',
    message: '该学生已有换货申请正在处理中',
    solution: '请等待前一个换货申请处理完成后再提交新申请，或联系管理员'
  },
  TOO_MANY_EXCHANGES: {
    code: 'TOO_MANY_EXCHANGES',
    message: '该订单已达到最大换货次数限制',
    solution: '同一订单最多允许换货2次，请联系管理员特殊处理'
  },
  REASON_REQUIRED: {
    code: 'REASON_REQUIRED',
    message: '换货原因不能为空',
    solution: '请填写详细的换货原因'
  },
  CONTACT_REQUIRED: {
    code: 'CONTACT_REQUIRED',
    message: '联系电话不能为空',
    solution: '请留下有效的联系电话'
  },
  INVALID_STATUS_TRANSITION: {
    code: 'INVALID_STATUS_TRANSITION',
    message: '不允许的状态转换',
    solution: '请检查当前换货单状态是否允许进行此操作'
  },
  EXCHANGE_NOT_FOUND: {
    code: 'EXCHANGE_NOT_FOUND',
    message: '换货单不存在',
    solution: '请检查换货单号是否正确'
  }
};

class ExchangeError extends Error {
  constructor(errorInfo, details = {}) {
    super(errorInfo.message);
    this.code = errorInfo.code;
    this.solution = errorInfo.solution;
    this.details = details;
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        solution: this.solution,
        details: this.details
      }
    };
  }
}

function generateExchangeNo() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `EXC${dateStr}${random}`;
}

async function getStudentByNo(studentNo) {
  return await get('SELECT * FROM students WHERE student_no = ?', [studentNo]);
}

async function getOriginalOrderByNo(orderNo) {
  return await get(`
    SELECT oo.*, s.name as student_name, s.student_no, 
           us.size_code as original_size, us.size_name, up.name as product_name
    FROM original_orders oo
    JOIN students s ON oo.student_id = s.id
    JOIN uniform_sizes us ON oo.size_id = us.id
    JOIN uniform_products up ON us.product_id = up.id
    WHERE oo.order_no = ?
  `, [orderNo]);
}

async function getSizeByCode(productId, sizeCode) {
  return await get('SELECT * FROM uniform_sizes WHERE product_id = ? AND size_code = ?', [productId, sizeCode]);
}

async function getInventory(sizeId) {
  return await get('SELECT * FROM inventory WHERE size_id = ?', [sizeId]);
}

async function getPendingExchanges(studentId) {
  return await all(`
    SELECT * FROM exchange_orders 
    WHERE student_id = ? AND status IN ('待审核', '正常', '补录')
  `, [studentId]);
}

async function getExchangeCountForOrder(originalOrderId) {
  const result = await get(`
    SELECT COUNT(*) as count FROM exchange_orders 
    WHERE original_order_id = ? AND status != '驳回'
  `, [originalOrderId]);
  return result.count;
}

async function validateExchangeRequest(originalOrder, toSize, student) {
  if (!student) {
    throw new ExchangeError(EXCHANGE_ERRORS.STUDENT_NOT_FOUND);
  }

  if (!originalOrder) {
    throw new ExchangeError(EXCHANGE_ERRORS.ORIGINAL_ORDER_NOT_FOUND);
  }

  if (originalOrder.status !== '已领取') {
    throw new ExchangeError(EXCHANGE_ERRORS.ORDER_NOT_RECEIVED, {
      currentStatus: originalOrder.status
    });
  }

  const sizeInfo = await get('SELECT product_id FROM uniform_sizes WHERE id = ?', [originalOrder.size_id]);
  const productId = sizeInfo ? sizeInfo.product_id : null;

  if (!toSize) {
    throw new ExchangeError(EXCHANGE_ERRORS.SIZE_NOT_FOUND);
  }

  if (originalOrder.size_id === toSize.id) {
    throw new ExchangeError(EXCHANGE_ERRORS.SAME_SIZE_EXCHANGE, {
      originalSize: originalOrder.original_size,
      targetSize: toSize.size_code
    });
  }

  const inventory = await getInventory(toSize.id);
  if (!inventory || inventory.quantity <= 0) {
    throw new ExchangeError(EXCHANGE_ERRORS.INVENTORY_INSUFFICIENT, {
      targetSize: toSize.size_name,
      currentStock: inventory ? inventory.quantity : 0
    });
  }

  const pendingExchanges = await getPendingExchanges(student.id);
  if (pendingExchanges.length > 0) {
    throw new ExchangeError(EXCHANGE_ERRORS.PENDING_EXCHANGE_EXISTS, {
      pendingCount: pendingExchanges.length,
      pendingExchanges: pendingExchanges.map(e => ({
        exchangeNo: e.exchange_no,
        status: e.status,
        createdAt: e.created_at
      }))
    });
  }

  const exchangeCount = await getExchangeCountForOrder(originalOrder.id);
  if (exchangeCount >= 2) {
    throw new ExchangeError(EXCHANGE_ERRORS.TOO_MANY_EXCHANGES, {
      currentExchangeCount: exchangeCount,
      maxAllowed: 2
    });
  }
}

async function createExchangeOrder(params) {
  const { orderNo, studentNo, toSizeCode, reason, reasonDetail, contactPhone } = params;

  const student = await getStudentByNo(studentNo);
  const originalOrder = await getOriginalOrderByNo(orderNo);

  let productId = null;
  if (originalOrder) {
    const sizeInfo = await get('SELECT product_id FROM uniform_sizes WHERE id = ?', [originalOrder.size_id]);
    productId = sizeInfo.product_id;
  }

  const toSize = productId ? await getSizeByCode(productId, toSizeCode) : null;

  await validateExchangeRequest(originalOrder, toSize, student);

  if (!reason || reason.trim() === '') {
    throw new ExchangeError(EXCHANGE_ERRORS.REASON_REQUIRED);
  }

  if (!contactPhone || contactPhone.trim() === '') {
    throw new ExchangeError(EXCHANGE_ERRORS.CONTACT_REQUIRED);
  }

  const exchangeNo = generateExchangeNo();
  const status = '待审核';

  const result = await run(
    `INSERT INTO exchange_orders 
    (exchange_no, original_order_id, student_id, from_size_id, to_size_id, reason, reason_detail, contact_phone, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exchangeNo,
      originalOrder.id,
      student.id,
      originalOrder.size_id,
      toSize.id,
      reason,
      reasonDetail || '',
      contactPhone,
      status
    ]
  );

  return {
    success: true,
    data: {
      id: result.lastID,
      exchangeNo,
      status,
      student: {
        studentNo: student.student_no,
        name: student.name,
        grade: student.grade,
        className: student.class_name
      },
      originalOrder: {
        orderNo: originalOrder.order_no,
        productName: originalOrder.product_name,
        originalSize: originalOrder.original_size
      },
      targetSize: {
        sizeCode: toSize.size_code,
        sizeName: toSize.size_name
      },
      reason,
      reasonDetail: reasonDetail || '',
      contactPhone,
      createdAt: new Date().toISOString()
    }
  };
}

async function getExchangeOrder(exchangeNo) {
  const exchange = await get(`
    SELECT eo.*, 
           s.name as student_name, s.student_no, s.grade, s.class_name,
           us_from.size_code as from_size_code, us_from.size_name as from_size_name,
           us_to.size_code as to_size_code, us_to.size_name as to_size_name,
           up.name as product_name, oo.order_no
    FROM exchange_orders eo
    JOIN students s ON eo.student_id = s.id
    JOIN uniform_sizes us_from ON eo.from_size_id = us_from.id
    JOIN uniform_sizes us_to ON eo.to_size_id = us_to.id
    JOIN uniform_products up ON us_from.product_id = up.id
    JOIN original_orders oo ON eo.original_order_id = oo.id
    WHERE eo.exchange_no = ?
  `, [exchangeNo]);

  if (!exchange) {
    throw new ExchangeError(EXCHANGE_ERRORS.EXCHANGE_NOT_FOUND);
  }

  return {
    success: true,
    data: {
      exchangeNo: exchange.exchange_no,
      orderNo: exchange.order_no,
      student: {
        studentNo: exchange.student_no,
        name: exchange.student_name,
        grade: exchange.grade,
        className: exchange.class_name
      },
      product: exchange.product_name,
      fromSize: {
        code: exchange.from_size_code,
        name: exchange.from_size_name
      },
      toSize: {
        code: exchange.to_size_code,
        name: exchange.to_size_name
      },
      reason: exchange.reason,
      reasonDetail: exchange.reason_detail,
      contactPhone: exchange.contact_phone,
      status: exchange.status,
      rejectReason: exchange.reject_reason,
      supplementaryNotes: exchange.supplementary_notes,
      createdAt: exchange.created_at,
      updatedAt: exchange.updated_at
    }
  };
}

async function getExchangeList(params = {}) {
  const { studentNo, status, page = 1, pageSize = 20 } = params;
  
  let whereClause = 'WHERE 1=1';
  const queryParams = [];

  if (studentNo) {
    whereClause += ' AND s.student_no = ?';
    queryParams.push(studentNo);
  }

  if (status) {
    whereClause += ' AND eo.status = ?';
    queryParams.push(status);
  }

  const countSql = `
    SELECT COUNT(*) as total
    FROM exchange_orders eo
    JOIN students s ON eo.student_id = s.id
    ${whereClause}
  `;

  const totalResult = await get(countSql, queryParams);
  const total = totalResult.total;

  const offset = (page - 1) * pageSize;
  const listParams = [...queryParams, pageSize, offset];

  const listSql = `
    SELECT eo.*, 
           s.name as student_name, s.student_no,
           us_from.size_code as from_size_code, us_from.size_name as from_size_name,
           us_to.size_code as to_size_code, us_to.size_name as to_size_name,
           up.name as product_name
    FROM exchange_orders eo
    JOIN students s ON eo.student_id = s.id
    JOIN uniform_sizes us_from ON eo.from_size_id = us_from.id
    JOIN uniform_sizes us_to ON eo.to_size_id = us_to.id
    JOIN uniform_products up ON us_from.product_id = up.id
    ${whereClause}
    ORDER BY eo.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const list = await all(listSql, listParams);

  return {
    success: true,
    data: {
      list: list.map(e => ({
        exchangeNo: e.exchange_no,
        student: {
          studentNo: e.student_no,
          name: e.student_name
        },
        product: e.product_name,
        fromSize: e.from_size_name,
        toSize: e.to_size_name,
        reason: e.reason,
        status: e.status,
        createdAt: e.created_at
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  };
}

async function updateExchangeStatus(exchangeNo, newStatus, notes = {}) {
  const exchange = await get('SELECT * FROM exchange_orders WHERE exchange_no = ?', [exchangeNo]);
  
  if (!exchange) {
    throw new ExchangeError(EXCHANGE_ERRORS.EXCHANGE_NOT_FOUND);
  }

  const validTransitions = {
    '待审核': ['正常', '驳回', '补录'],
    '正常': ['已完成', '驳回'],
    '补录': ['正常', '驳回'],
    '驳回': ['正常'],
    '已完成': []
  };

  if (!validTransitions[exchange.status] || !validTransitions[exchange.status].includes(newStatus)) {
    throw new ExchangeError(EXCHANGE_ERRORS.INVALID_STATUS_TRANSITION, {
      currentStatus: exchange.status,
      targetStatus: newStatus,
      allowedTransitions: validTransitions[exchange.status]
    });
  }

  if (newStatus === '已完成') {
    const inventory = await getInventory(exchange.to_size_id);
    if (!inventory || inventory.quantity <= 0) {
      throw new ExchangeError(EXCHANGE_ERRORS.INVENTORY_INSUFFICIENT, {
        message: '完成换裤时发现目标尺码库存不足',
        currentStock: inventory ? inventory.quantity : 0
      });
    }

    await run('UPDATE inventory SET quantity = quantity - 1, updated_at = CURRENT_TIMESTAMP WHERE size_id = ?', [exchange.to_size_id]);
  }

  let updateFields = 'status = ?, updated_at = CURRENT_TIMESTAMP';
  const updateParams = [newStatus];

  if (notes.rejectReason) {
    updateFields += ', reject_reason = ?';
    updateParams.push(notes.rejectReason);
  }
  if (notes.supplementaryNotes) {
    updateFields += ', supplementary_notes = ?';
    updateParams.push(notes.supplementaryNotes);
  }

  updateParams.push(exchangeNo);

  await run(`UPDATE exchange_orders SET ${updateFields} WHERE exchange_no = ?`, updateParams);

  return await getExchangeOrder(exchangeNo);
}

module.exports = {
  createExchangeOrder,
  getExchangeOrder,
  getExchangeList,
  updateExchangeStatus,
  ExchangeError,
  EXCHANGE_ERRORS
};
