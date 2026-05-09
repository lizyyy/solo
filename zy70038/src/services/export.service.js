const fs = require('fs');
const path = require('path');
const config = require('../config');
const storage = require('../storage/file-storage');
const orderService = require('./order.service');
const exceptionService = require('./exception.service');
const inventoryService = require('./inventory.service');

class ExportService {
  constructor() {
    this.ensureExportDir();
  }
  
  ensureExportDir() {
    if (!fs.existsSync(config.exportDir)) {
      fs.mkdirSync(config.exportDir, { recursive: true });
    }
  }
  
  formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  
  formatDuration(ms) {
    if (!ms) return '-';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}小时${minutes}分钟`;
  }
  
  getStatusText(status) {
    const map = {
      'pending': '待核销',
      'picked_up': '已核销',
      'timeout_released': '超时释放',
      'cancelled': '已取消'
    };
    return map[status] || status;
  }
  
  exportTimeoutReleasedOrders(startDate, endDate) {
    const orders = orderService.getOrdersByStatus('timeout_released');
    const filtered = orders.filter(o => {
      if (startDate && o.timeoutReleasedAt < startDate) return false;
      if (endDate && o.timeoutReleasedAt > endDate) return false;
      return true;
    });
    
    const lines = [];
    lines.push('== 超时释放订单业务复核报告 ==');
    lines.push(`生成时间: ${this.formatDate(Date.now())}`);
    lines.push(`统计范围: ${startDate ? this.formatDate(startDate) : '全部'} - ${endDate ? this.formatDate(endDate) : '全部'}`);
    lines.push('');
    
    lines.push('【汇总】');
    lines.push(`超时释放订单总数: ${filtered.length}`);
    const totalItems = filtered.reduce((sum, o) => sum + o.items.length, 0);
    lines.push(`涉及商品项数: ${totalItems}`);
    lines.push('');
    
    lines.push('【订单明细】');
    lines.push('-' .repeat(100));
    
    for (const order of filtered) {
      const store = config.stores[order.storeId];
      const storeName = store ? store.name : order.storeId;
      
      lines.push('');
      lines.push(`订单号: ${order.orderId}`);
      lines.push(`门店: ${storeName} (${order.storeId})`);
      lines.push(`客户: ${order.customerName || '-'} (${order.customerPhone})`);
      lines.push(`下单时间: ${this.formatDate(order.createdAt)}`);
      lines.push(`原超时时间: ${this.formatDate(order.createdAt + order.holdTime)}`);
      lines.push(`实际超时时间: ${this.formatDate(order.timeoutReleasedAt)}`);
      lines.push(`总保留时长: ${this.formatDuration(order.totalHoldTime)}`);
      lines.push(`延长次数: ${order.extensions.length}`);
      
      if (order.extensions.length > 0) {
        lines.push('  延长记录:');
        for (const ext of order.extensions) {
          lines.push(`    - 延长人: ${ext.extendedBy}, 原因: ${ext.reason}, 延长: ${this.formatDuration(ext.additionalTime)}`);
        }
      }
      
      lines.push(`商品明细:`);
      for (const item of order.items) {
        lines.push(`  - SKU: ${item.sku}, 数量: ${item.quantity}`);
      }
      
      lines.push(`库存状态: ${order.stockReserved ? '已预留' : '未预留'} → ${order.stockRestored ? '已回补' : '未回补'}`);
      
      const stockOps = inventoryService.getStockOperationsByOrder(order.orderId);
      if (stockOps.length > 0) {
        lines.push('库存操作记录:');
        for (const op of stockOps) {
          const typeMap = { 'reserve': '预留', 'restore': '回补', 'deduct': '扣减', 'adjust': '调整' };
          lines.push(`  - ${this.formatDate(op.timestamp)} | ${typeMap[op.operationType]} | SKU: ${op.sku}, 数量: ${op.quantity}, 操作人: ${op.operator}`);
        }
      }
      
      lines.push('-' .repeat(100));
    }
    
    const exceptions = exceptionService.getAllExceptions();
    const relatedExceptions = exceptions.filter(e => 
      filtered.some(o => o.orderId === e.orderId)
    );
    
    if (relatedExceptions.length > 0) {
      lines.push('');
      lines.push('【相关异常记录】');
      lines.push('-' .repeat(100));
      for (const exc of relatedExceptions) {
        lines.push('');
        lines.push(`异常ID: ${exc.exceptionId}`);
        lines.push(`订单号: ${exc.orderId || '-'}`);
        lines.push(`类型: ${exc.exceptionType}`);
        lines.push(`严重程度: ${exc.severity}`);
        lines.push(`时间: ${this.formatDate(exc.timestamp)}`);
        lines.push(`消息: ${exc.message}`);
        lines.push(`状态: ${exc.resolved ? `已解决 (${this.formatDate(exc.resolvedAt)}, 处理人: ${exc.resolvedBy})` : '待处理'}`);
        if (exc.resolutionNotes) {
          lines.push(`处理备注: ${exc.resolutionNotes}`);
        }
      }
    }
    
    const filename = `timeout-review-${Date.now()}.txt`;
    const filepath = path.join(config.exportDir, filename);
    fs.writeFileSync(filepath, lines.join('\n'), 'utf8');
    
    return {
      success: true,
      filepath: filepath,
      orderCount: filtered.length,
      exceptionCount: relatedExceptions.length
    };
  }
  
  exportDailySummary(date) {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const orders = storage.getOrders();
    const stockOps = storage.getStockOperations();
    const exceptions = storage.getExceptions();
    
    const dayOrders = orders.filter(o => 
      o.createdAt >= startOfDay.getTime() && o.createdAt <= endOfDay.getTime()
    );
    
    const dayStockOps = stockOps.filter(op => 
      op.timestamp >= startOfDay.getTime() && op.timestamp <= endOfDay.getTime()
    );
    
    const dayExceptions = exceptions.filter(e => 
      e.timestamp >= startOfDay.getTime() && e.timestamp <= endOfDay.getTime()
    );
    
    const lines = [];
    lines.push('== 自提业务日报 ==');
    lines.push(`日期: ${targetDate.toLocaleDateString('zh-CN')}`);
    lines.push(`生成时间: ${this.formatDate(Date.now())}`);
    lines.push('');
    
    lines.push('【订单统计】');
    lines.push(`总订单数: ${dayOrders.length}`);
    lines.push(`待核销: ${dayOrders.filter(o => o.status === 'pending').length}`);
    lines.push(`已核销: ${dayOrders.filter(o => o.status === 'picked_up').length}`);
    lines.push(`超时释放: ${dayOrders.filter(o => o.status === 'timeout_released').length}`);
    lines.push('');
    
    lines.push('【库存操作统计】');
    const reserveCount = dayStockOps.filter(op => op.operationType === 'reserve').length;
    const restoreCount = dayStockOps.filter(op => op.operationType === 'restore').length;
    const deductCount = dayStockOps.filter(op => op.operationType === 'deduct').length;
    lines.push(`预留操作: ${reserveCount} 次`);
    lines.push(`回补操作: ${restoreCount} 次`);
    lines.push(`扣减操作: ${deductCount} 次`);
    lines.push('');
    
    lines.push('【异常统计】');
    lines.push(`新增异常: ${dayExceptions.length}`);
    lines.push(`待处理: ${dayExceptions.filter(e => !e.resolved).length}`);
    
    if (dayExceptions.length > 0) {
      lines.push('');
      lines.push('【异常明细】');
      for (const exc of dayExceptions) {
        const statusText = exc.resolved ? '已解决' : '待处理';
        lines.push(`- ${this.formatDate(exc.timestamp)} | ${exc.severity.toUpperCase()} | ${exc.exceptionType} | ${statusText} | ${exc.message}`);
      }
    }
    
    const pending = exceptionService.getUnresolvedExceptions();
    if (pending.length > 0) {
      lines.push('');
      lines.push('【待处理事项】');
      lines.push(`当前共有 ${pending.length} 条待处理异常记录，请查看 data/exceptions.json`);
    }
    
    const filename = `daily-summary-${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}.txt`;
    const filepath = path.join(config.exportDir, filename);
    fs.writeFileSync(filepath, lines.join('\n'), 'utf8');
    
    return {
      success: true,
      filepath: filepath,
      orderCount: dayOrders.length,
      exceptionCount: dayExceptions.length
    };
  }
}

module.exports = new ExportService();
