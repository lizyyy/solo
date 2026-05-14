import { v4 as uuidv4 } from 'uuid';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';
import { allQuery, getQuery, runQuery } from '../database';
import { AttachmentRevision, ApprovalNode } from '../types';

export class ExportService {
  public async createAttachmentRevision(
    recordId: string,
    detailItemId: string,
    attachmentName: string,
    beforeValue: string,
    afterValue: string,
    modifiedBy: string,
    approvalNodeId: string | null = null
  ): Promise<string> {
    const revisionId = uuidv4();
    await runQuery(
      `INSERT INTO attachment_revisions 
       (id, record_id, detail_item_id, attachment_name, before_value, after_value, modified_by, approval_node_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [revisionId, recordId, detailItemId, attachmentName, beforeValue, afterValue, modifiedBy, approvalNodeId]
    );
    return revisionId;
  }

  public async getAttachmentRevisions(recordId: string): Promise<AttachmentRevision[]> {
    const rows = await allQuery<any>(
      `SELECT * FROM attachment_revisions WHERE record_id = ? ORDER BY modified_at DESC`,
      [recordId]
    );

    return rows.map(row => ({
      id: row.id,
      recordId: row.record_id,
      detailItemId: row.detail_item_id,
      attachmentName: row.attachment_name,
      beforeValue: row.before_value,
      afterValue: row.after_value,
      modifiedBy: row.modified_by,
      modifiedAt: new Date(row.modified_at),
      approvalNodeId: row.approval_node_id
    }));
  }

  public async createApprovalNode(
    recordId: string,
    nodeName: string,
    nodeOrder: number,
    approver: string
  ): Promise<string> {
    const nodeId = uuidv4();
    await runQuery(
      `INSERT INTO approval_nodes (id, record_id, node_name, node_order, approver, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nodeId, recordId, nodeName, nodeOrder, approver, 'PENDING']
    );
    return nodeId;
  }

  public async approveNode(nodeId: string, approver: string, comment: string): Promise<void> {
    await runQuery(
      `UPDATE approval_nodes 
       SET status = 'APPROVED', approver = ?, comment = ?, approved_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [approver, comment, nodeId]
    );
  }

  public async getApprovalNodes(recordId: string): Promise<ApprovalNode[]> {
    const rows = await allQuery<any>(
      `SELECT * FROM approval_nodes WHERE record_id = ? ORDER BY node_order ASC`,
      [recordId]
    );

    return rows.map(row => ({
      id: row.id,
      recordId: row.record_id,
      nodeName: row.node_name,
      nodeOrder: row.node_order,
      approver: row.approver,
      approvedAt: row.approved_at ? new Date(row.approved_at) : null,
      status: row.status as 'PENDING' | 'APPROVED' | 'REJECTED',
      comment: row.comment
    }));
  }

  public async exportInitRecord(recordId: string): Promise<string> {
    const record = await getQuery<any>(
      `SELECT * FROM tenant_init_records WHERE id = ?`,
      [recordId]
    );

    if (!record) {
      throw new Error('记录不存在');
    }

    const detailItems = await allQuery<any>(
      `SELECT * FROM init_detail_items WHERE record_id = ? ORDER BY created_at ASC`,
      [recordId]
    );

    const revisions = await this.getAttachmentRevisions(recordId);
    const approvalNodes = await this.getApprovalNodes(recordId);

    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const csvPath = path.join(exportDir, `init-${record.tenant_id}-${timestamp}.csv`);

    const csvWriter = createObjectCsvWriter({
      path: csvPath,
      header: [
        { id: 'type', title: '类型' },
        { id: 'field1', title: '字段1' },
        { id: 'field2', title: '字段2' },
        { id: 'field3', title: '字段3' },
        { id: 'field4', title: '字段4' },
        { id: 'field5', title: '字段5' },
        { id: 'field6', title: '字段6' }
      ]
    });

    const records: any[] = [];

    records.push({ type: '初始化记录', field1: '租户ID', field2: record.tenant_id, field3: '租户名称', field4: record.tenant_name, field5: '状态', field6: record.status });
    records.push({ type: '初始化记录', field1: '压缩包路径', field2: record.package_path, field3: '当前步骤', field4: record.current_step, field5: '错误信息', field6: record.error_message || '' });
    records.push({ type: '初始化记录', field1: '材料摘要', field2: record.material_summary, field3: '总计', field4: record.total_items, field5: '成功', field6: record.success_items, field7: record.failed_items });
    records.push({ type: '---', field1: '---', field2: '---', field3: '---', field4: '---', field5: '---', field6: '---' });

    records.push({ type: '明细项', field1: '项目类型', field2: '项目ID', field3: '项目名称', field4: '状态', field5: '步骤', field6: '错误信息' });
    for (const item of detailItems) {
      records.push({
        type: '明细项',
        field1: item.item_type,
        field2: item.item_id,
        field3: item.item_name,
        field4: item.status,
        field5: item.step,
        field6: item.error_message || ''
      });
    }
    records.push({ type: '---', field1: '---', field2: '---', field3: '---', field4: '---', field5: '---', field6: '---' });

    records.push({ type: '附件修正', field1: '附件名称', field2: '修正前值', field3: '修正后值', field4: '修改人', field5: '修改时间', field6: '审批节点' });
    for (const rev of revisions) {
      records.push({
        type: '附件修正',
        field1: rev.attachmentName,
        field2: rev.beforeValue,
        field3: rev.afterValue,
        field4: rev.modifiedBy,
        field5: rev.modifiedAt.toISOString(),
        field6: rev.approvalNodeId || ''
      });
    }
    records.push({ type: '---', field1: '---', field2: '---', field3: '---', field4: '---', field5: '---', field6: '---' });

    records.push({ type: '审批节点', field1: '节点名称', field2: '节点顺序', field3: '审批人', field4: '状态', field5: '审批时间', field6: '备注' });
    for (const node of approvalNodes) {
      records.push({
        type: '审批节点',
        field1: node.nodeName,
        field2: node.nodeOrder,
        field3: node.approver,
        field4: node.status,
        field5: node.approvedAt?.toISOString() || '',
        field6: node.comment || ''
      });
    }

    await csvWriter.writeRecords(records);
    return csvPath;
  }

  public async exportDeviceLedger(tenantId: string): Promise<string> {
    const devices = await allQuery<any>(
      `SELECT * FROM device_ledgers WHERE tenant_id = ? ORDER BY created_at DESC`,
      [tenantId]
    );

    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const csvPath = path.join(exportDir, `devices-${tenantId}-${timestamp}.csv`);

    const csvWriter = createObjectCsvWriter({
      path: csvPath,
      header: [
        { id: 'deviceCode', title: '设备编码' },
        { id: 'deviceName', title: '设备名称' },
        { id: 'deviceType', title: '设备类型' },
        { id: 'storeName', title: '门店名称' },
        { id: 'installLocation', title: '安装位置' },
        { id: 'status', title: '状态' },
        { id: 'purchaseDate', title: '采购日期' },
        { id: 'warrantyPeriod', title: '保修期(月)' },
        { id: 'manufacturer', title: '制造商' },
        { id: 'model', title: '型号' }
      ]
    });

    const records = devices.map(d => ({
      deviceCode: d.device_code,
      deviceName: d.device_name,
      deviceType: d.device_type,
      storeName: d.store_name,
      installLocation: d.install_location,
      status: d.status,
      purchaseDate: d.purchase_date,
      warrantyPeriod: d.warranty_period,
      manufacturer: d.manufacturer,
      model: d.model
    }));

    await csvWriter.writeRecords(records);
    return csvPath;
  }
}

export const exportService = new ExportService();
