const db = require('../db');
const { successResponse } = require('../utils/response');
const { NotFoundError, AuthorizationError, ValidationError } = require('../utils/errors');
const { getStateLabel } = require('../utils/stateMachine');

const getOrderForExport = async (orderId, userId) => {
  const order = await db('orders')
    .leftJoin('products', 'orders.product_id', 'products.id')
    .leftJoin('users as buyers', 'orders.buyer_id', 'buyers.id')
    .leftJoin('users as sellers', 'orders.seller_id', 'sellers.id')
    .select(
      'orders.*',
      'products.title as product_title',
      'products.description as product_description',
      'products.brand as product_brand',
      'products.model as product_model',
      'products.category as product_category',
      'products.serial_number_suffix as product_serial_suffix',
      'products.condition as product_condition',
      'products.accessories as product_accessories',
      'products.specs as product_specs',
      'products.price as product_price',
      'buyers.name as buyer_name',
      'buyers.email as buyer_email',
      'buyers.phone as buyer_phone',
      'sellers.name as seller_name',
      'sellers.email as seller_email',
      'sellers.phone as seller_phone'
    )
    .where('orders.id', orderId)
    .first();

  if (!order) {
    throw new NotFoundError('订单不存在');
  }

  if (order.buyer_id !== userId && order.seller_id !== userId) {
    throw new AuthorizationError('您没有权限导出此订单');
  }

  const [paymentRecords, inspectionItems, inspectionReport, logistics, disputes] = await Promise.all([
    db('payment_records')
      .leftJoin('users', 'payment_records.created_by', 'users.id')
      .select('payment_records.*', 'users.name as creator_name')
      .where('payment_records.order_id', orderId)
      .orderBy('created_at', 'asc'),
    db('inspection_items')
      .where('order_id', orderId)
      .orderBy('sort_order', 'asc'),
    db('inspection_reports')
      .leftJoin('users', 'inspection_reports.submitted_by', 'users.id')
      .select('inspection_reports.*', 'users.name as submitter_name')
      .where('inspection_reports.order_id', orderId)
      .first(),
    db('logistics')
      .where('order_id', orderId)
      .orderBy('created_at', 'asc'),
    db('disputes')
      .leftJoin('users as raisers', 'disputes.raised_by', 'raisers.id')
      .select('disputes.*', 'raisers.name as raiser_name')
      .where('disputes.order_id', orderId)
      .orderBy('created_at', 'asc')
  ]);

  return {
    order: {
      ...order,
      product_accessories: order.product_accessories ? JSON.parse(order.product_accessories) : [],
      product_specs: order.product_specs ? JSON.parse(order.product_specs) : {},
      status_label: getStateLabel(order.status)
    },
    payment_records: paymentRecords.map(pr => ({
      ...pr,
      evidence_urls: pr.evidence_urls ? JSON.parse(pr.evidence_urls) : []
    })),
    inspection_items: inspectionItems.map(item => ({
      ...item,
      evidence_urls: item.evidence_urls ? JSON.parse(item.evidence_urls) : []
    })),
    inspection_report: inspectionReport ? {
      ...inspectionReport,
      additional_evidence_urls: inspectionReport.additional_evidence_urls ? JSON.parse(inspectionReport.additional_evidence_urls) : []
    } : null,
    logistics: logistics.map(log => ({
      ...log,
      tracking_history: log.tracking_history ? JSON.parse(log.tracking_history) : []
    })),
    disputes: disputes.map(d => ({
      ...d,
      evidence_urls: d.evidence_urls ? JSON.parse(d.evidence_urls) : []
    })),
    exported_at: new Date().toISOString()
  };
};

const exportToJSON = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const exportData = await getOrderForExport(id, userId);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=order-${exportData.order.order_number}.json`);
    
    res.status(200).json(exportData);
  } catch (error) {
    next(error);
  }
};

const exportToMarkdown = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const data = await getOrderForExport(id, userId);
    const { order, payment_records, inspection_items, inspection_report, logistics, disputes, exported_at } = data;

    let markdown = `# 交易记录导出\n\n`;
    markdown += `> 导出时间: ${new Date(exported_at).toLocaleString('zh-CN')}\n\n`;
    markdown += `---\n\n`;

    markdown += `## 订单基本信息\n\n`;
    markdown += `- **订单号**: ${order.order_number}\n`;
    markdown += `- **订单状态**: ${order.status_label}\n`;
    markdown += `- **创建时间**: ${new Date(order.created_at).toLocaleString('zh-CN')}\n`;
    markdown += `- **成交价**: ¥${order.final_price}\n`;
    markdown += `- **订金金额**: ¥${order.deposit_amount}\n`;
    markdown += `- **尾款金额**: ¥${order.balance_amount}\n`;
    if (order.notes) {
      markdown += `- **订单备注**: ${order.notes}\n`;
    }
    markdown += `\n`;

    markdown += `---\n\n`;
    markdown += `## 商品信息\n\n`;
    markdown += `### ${order.product_title}\n\n`;
    if (order.product_description) {
      markdown += `${order.product_description}\n\n`;
    }
    markdown += `- **品牌/型号**: ${order.product_brand || '-'} / ${order.product_model || '-'}\n`;
    markdown += `- **分类**: ${order.product_category}\n`;
    if (order.product_serial_suffix) {
      markdown += `- **序列号后四位**: ${order.product_serial_suffix}\n`;
    }
    markdown += `- **成色**: ${order.product_condition}\n`;
    markdown += `- **原价**: ¥${order.product_price}\n`;
    
    if (order.product_accessories && order.product_accessories.length > 0) {
      markdown += `- **配件**: ${order.product_accessories.join(', ')}\n`;
    }
    
    if (order.product_specs && Object.keys(order.product_specs).length > 0) {
      markdown += `\n**规格参数**:\n`;
      for (const [key, value] of Object.entries(order.product_specs)) {
        const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        markdown += `- ${displayKey}: ${Array.isArray(value) ? value.join(', ') : value}\n`;
      }
    }
    markdown += `\n`;

    markdown += `---\n\n`;
    markdown += `## 交易双方\n\n`;
    markdown += `### 买家\n`;
    markdown += `- **姓名**: ${order.buyer_name}\n`;
    if (order.buyer_email) markdown += `- **邮箱**: ${order.buyer_email}\n`;
    if (order.buyer_phone) markdown += `- **电话**: ${order.buyer_phone}\n`;
    markdown += `\n`;
    
    markdown += `### 卖家\n`;
    markdown += `- **姓名**: ${order.seller_name}\n`;
    if (order.seller_email) markdown += `- **邮箱**: ${order.seller_email}\n`;
    if (order.seller_phone) markdown += `- **电话**: ${order.seller_phone}\n`;
    markdown += `\n`;

    if (logistics && logistics.length > 0) {
      markdown += `---\n\n`;
      markdown += `## 物流信息\n\n`;
      
      logistics.forEach((log, index) => {
        markdown += `### ${log.type === 'return' ? '退货物流' : '发货物流'} #${index + 1}\n\n`;
        markdown += `- **物流公司**: ${log.logistics_company || '-'}\n`;
        markdown += `- **运单号**: ${log.tracking_number || '-'}\n`;
        markdown += `- **状态**: ${log.status}\n`;
        if (log.shipped_at) markdown += `- **发货时间**: ${new Date(log.shipped_at).toLocaleString('zh-CN')}\n`;
        if (log.delivered_at) markdown += `- **签收时间**: ${new Date(log.delivered_at).toLocaleString('zh-CN')}\n`;
        
        if (log.tracking_history && log.tracking_history.length > 0) {
          markdown += `\n**物流轨迹**:\n`;
          log.tracking_history.forEach((track, i) => {
            markdown += `${i + 1}. ${track.time} - ${track.status} (${track.location})\n`;
          });
        }
        markdown += `\n`;
      });
    }

    if (inspection_items && inspection_items.length > 0) {
      markdown += `---\n\n`;
      markdown += `## 验货清单\n\n`;
      
      inspection_items.forEach((item, index) => {
        markdown += `### ${index + 1}. ${item.name}\n\n`;
        if (item.description) markdown += `- **描述**: ${item.description}\n`;
        markdown += `- **结果**: ${item.result}\n`;
        if (item.notes) markdown += `- **备注**: ${item.notes}\n`;
        if (item.evidence_urls && item.evidence_urls.length > 0) {
          markdown += `- **证据**:\n`;
          item.evidence_urls.forEach((url, i) => {
            markdown += `  ${i + 1}. [证据${i + 1}](${url})\n`;
          });
        }
        markdown += `\n`;
      });
    }

    if (inspection_report) {
      markdown += `---\n\n`;
      markdown += `## 验货报告\n\n`;
      markdown += `- **提交人**: ${inspection_report.submitter_name}\n`;
      markdown += `- **提交时间**: ${new Date(inspection_report.created_at).toLocaleString('zh-CN')}\n`;
      markdown += `- **整体结果**: ${inspection_report.overall_result}\n`;
      if (inspection_report.notes) {
        markdown += `- **备注**: ${inspection_report.notes}\n`;
      }
      if (inspection_report.additional_evidence_urls && inspection_report.additional_evidence_urls.length > 0) {
        markdown += `- **附加证据**:\n`;
        inspection_report.additional_evidence_urls.forEach((url, i) => {
          markdown += `  ${i + 1}. [证据${i + 1}](${url})\n`;
        });
      }
      markdown += `\n`;
    }

    if (payment_records && payment_records.length > 0) {
      markdown += `---\n\n`;
      markdown += `## 付款记录\n\n`;
      
      payment_records.forEach((record, index) => {
        markdown += `### ${index + 1}. ${record.type === 'deposit' ? '订金' : record.type === 'balance' ? '尾款' : '退款'}\n\n`;
        markdown += `- **金额**: ¥${record.amount}\n`;
        markdown += `- **状态**: ${record.status}\n`;
        markdown += `- **支付方式**: ${record.payment_method || '-'}\n`;
        if (record.transaction_id) markdown += `- **交易号**: ${record.transaction_id}\n`;
        markdown += `- **原因**: ${record.reason}\n`;
        if (record.creator_name) markdown += `- **操作人**: ${record.creator_name}\n`;
        markdown += `- **时间**: ${new Date(record.created_at).toLocaleString('zh-CN')}\n`;
        markdown += `\n`;
      });
    }

    if (disputes && disputes.length > 0) {
      markdown += `---\n\n`;
      markdown += `## 争议处理\n\n`;
      
      disputes.forEach((dispute, index) => {
        markdown += `### 争议 #${index + 1}\n\n`;
        markdown += `- **发起方**: ${dispute.raiser_name}\n`;
        markdown += `- **状态**: ${dispute.status}\n`;
        markdown += `- **原因**: ${dispute.reason}\n`;
        if (dispute.responsibility && dispute.responsibility !== 'undecided') {
          markdown += `- **责任归属**: ${dispute.responsibility}\n`;
        }
        if (dispute.suggestion) markdown += `- **处理建议**: ${dispute.suggestion}\n`;
        if (dispute.refund_amount) markdown += `- **退款金额**: ¥${dispute.refund_amount}\n`;
        if (dispute.resolution_details) markdown += `- **处理详情**: ${dispute.resolution_details}\n`;
        if (dispute.resolved_at) markdown += `- **解决时间**: ${new Date(dispute.resolved_at).toLocaleString('zh-CN')}\n`;
        if (dispute.evidence_urls && dispute.evidence_urls.length > 0) {
          markdown += `- **证据**:\n`;
          dispute.evidence_urls.forEach((url, i) => {
            markdown += `  ${i + 1}. [证据${i + 1}](${url})\n`;
          });
        }
        markdown += `\n`;
      });
    }

    markdown += `---\n\n`;
    markdown += `> 本报告由二手电子产品验货担保交易系统自动生成\n`;
    markdown += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n`;

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=order-${order.order_number}.md`);
    
    res.status(200).send(markdown);
  } catch (error) {
    next(error);
  }
};

const exportOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;

    if (format === 'markdown' || format === 'md') {
      return exportToMarkdown(req, res, next);
    }

    if (format === 'json') {
      return exportToJSON(req, res, next);
    }

    throw new ValidationError('不支持的导出格式，支持: json, markdown');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  exportOrder,
  exportToJSON,
  exportToMarkdown
};
