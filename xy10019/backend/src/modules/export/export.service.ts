import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { TransferStatus } from '@prisma/client';

export type ExportFormat = 'excel' | 'markdown' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  storeId?: string;
  startTime?: Date;
  endTime?: Date;
  includeRecords?: boolean;
  includeTransfers?: boolean;
}

interface InventoryRow {
  storeCode: string;
  storeName: string;
  sku: string;
  productName: string;
  category: string;
  quantity: number;
  availableQty: number;
  lockedQty: number;
  price: number;
  value: number;
  lastUpdated: string;
}

interface InventoryRecordRow {
  storeCode: string;
  productName: string;
  operationType: string;
  quantityBefore: number;
  changeQuantity: number;
  quantityAfter: number;
  priceBefore: number;
  priceAfter: number;
  operator: string;
  createdAt: string;
  remark: string;
}

interface TransferRow {
  orderNo: string;
  sourceStore: string;
  targetStore: string;
  status: string;
  totalQuantity: number;
  totalAmount: number;
  operator: string;
  createdAt: string;
  completedAt: string;
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(private prismaService: PrismaService) {}

  async exportInventory(options: ExportOptions): Promise<{
    data: Buffer;
    filename: string;
    contentType: string;
  }> {
    this.logger.log(`开始导出库存报表, 格式: ${options.format}`);

    const {
      format,
      storeId,
      startTime,
      endTime,
      includeRecords = true,
      includeTransfers = true,
    } = options;

    const inventoryData = await this.getInventoryData(storeId);
    const recordsData = includeRecords
      ? await this.getInventoryRecords(storeId, startTime, endTime)
      : [];
    const transfersData = includeTransfers
      ? await this.getTransfers(storeId, startTime, endTime)
      : [];

    const statistics = this.calculateStatistics(inventoryData, recordsData, transfersData);

    const timestamp = new Date().toISOString().slice(0, 10);

    switch (format) {
      case 'excel':
        return {
          data: await this.exportToExcel(inventoryData, recordsData, transfersData, statistics),
          filename: `inventory-report-${timestamp}.xlsx`,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };

      case 'markdown':
        return {
          data: Buffer.from(
            this.exportToMarkdown(inventoryData, recordsData, transfersData, statistics),
          ),
          filename: `inventory-report-${timestamp}.md`,
          contentType: 'text/markdown',
        };

      case 'pdf':
        return {
          data: await this.exportToPDF(inventoryData, recordsData, transfersData, statistics),
          filename: `inventory-report-${timestamp}.pdf`,
          contentType: 'application/pdf',
        };

      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
  }

  private async getInventoryData(storeId?: string): Promise<InventoryRow[]> {
    const where: any = {};
    if (storeId) {
      where.storeId = storeId;
    }

    const inventories = await this.prismaService.inventory.findMany({
      where,
      include: { product: true, store: true },
      orderBy: [{ storeId: 'asc' }, { productId: 'asc' }],
    });

    return inventories.map((inv) => ({
      storeCode: inv.store.code,
      storeName: inv.store.name,
      sku: inv.product.sku,
      productName: inv.product.name,
      category: inv.product.category || '-',
      quantity: inv.quantity,
      availableQty: inv.availableQty,
      lockedQty: inv.lockedQty,
      price: Number(inv.price),
      value: inv.quantity * Number(inv.price),
      lastUpdated: inv.lastUpdated.toISOString(),
    }));
  }

  private async getInventoryRecords(
    storeId?: string,
    startTime?: Date,
    endTime?: Date,
  ): Promise<InventoryRecordRow[]> {
    const where: any = {};
    if (storeId) {
      where.storeId = storeId;
    }
    if (startTime || endTime) {
      where.createdAt = {};
      if (startTime) where.createdAt.gte = startTime;
      if (endTime) where.createdAt.lte = endTime;
    }

    const records = await this.prismaService.inventoryRecord.findMany({
      where,
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const storeIds = [...new Set(records.map((r) => r.storeId))];
    const stores = await this.prismaService.store.findMany({
      where: { id: { in: storeIds } },
    });
    const storeMap = new Map(stores.map((s) => [s.id, s]));

    return records.map((rec) => ({
      storeCode: storeMap.get(rec.storeId)?.code || '-',
      productName: rec.product?.name || '-',
      operationType: this.translateOperationType(rec.operationType),
      quantityBefore: rec.quantityBefore,
      changeQuantity: rec.changeQuantity,
      quantityAfter: rec.quantityAfter,
      priceBefore: rec.priceBefore ? Number(rec.priceBefore) : 0,
      priceAfter: rec.priceAfter ? Number(rec.priceAfter) : 0,
      operator: rec.operatorName,
      createdAt: rec.createdAt.toISOString(),
      remark: rec.remark || '-',
    }));
  }

  private async getTransfers(
    storeId?: string,
    startTime?: Date,
    endTime?: Date,
  ): Promise<TransferRow[]> {
    const where: any = {};
    if (storeId) {
      where.OR = [{ sourceStoreId: storeId }, { targetStoreId: storeId }];
    }
    if (startTime || endTime) {
      where.createdAt = {};
      if (startTime) where.createdAt.gte = startTime;
      if (endTime) where.createdAt.lte = endTime;
    }

    const transfers = await this.prismaService.transferOrder.findMany({
      where,
      include: {
        sourceStore: true,
        targetStore: true,
        operator: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return transfers.map((t) => ({
      orderNo: t.orderNo,
      sourceStore: `${t.sourceStore.code} - ${t.sourceStore.name}`,
      targetStore: `${t.targetStore.code} - ${t.targetStore.name}`,
      status: this.translateTransferStatus(t.status),
      totalQuantity: t.totalQuantity,
      totalAmount: Number(t.totalAmount),
      operator: t.operator?.name || '-',
      createdAt: t.createdAt.toISOString(),
      completedAt: t.completedAt?.toISOString() || '-',
    }));
  }

  private calculateStatistics(
    inventory: InventoryRow[],
    records: InventoryRecordRow[],
    transfers: TransferRow[],
  ) {
    const totalProducts = inventory.length;
    const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = inventory.reduce((sum, item) => sum + item.value, 0);
    const lowStock = inventory.filter((item) => item.availableQty <= 10).length;

    const inTransfers = transfers.filter((t) => t.status === '进行中');
    const completedTransfers = transfers.filter((t) => t.status === '已完成');

    return {
      generatedAt: new Date().toISOString(),
      totalProducts,
      totalQuantity,
      totalValue,
      totalValueFormatted: this.formatCurrency(totalValue),
      lowStock,
      recordsCount: records.length,
      transfersCount: transfers.length,
      inTransfersCount: inTransfers.length,
      completedTransfersCount: completedTransfers.length,
    };
  }

  private async exportToExcel(
    inventory: InventoryRow[],
    records: InventoryRecordRow[],
    transfers: TransferRow[],
    statistics: any,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet('汇总');
    summarySheet.columns = [
      { header: '项目', key: 'item', width: 25 },
      { header: '值', key: 'value', width: 40 },
    ];
    summarySheet.addRows([
      { item: '报表生成时间', value: statistics.generatedAt },
      { item: '商品种类数', value: statistics.totalProducts },
      { item: '总库存数量', value: statistics.totalQuantity },
      { item: '库存总价值', value: statistics.totalValueFormatted },
      { item: '低库存商品数', value: statistics.lowStock },
      { item: '变动记录数', value: statistics.recordsCount },
      { item: '调拨单数', value: statistics.transfersCount },
      { item: '进行中调拨', value: statistics.inTransfersCount },
      { item: '已完成调拨', value: statistics.completedTransfersCount },
    ]);
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getColumn(1).font = { bold: true };

    const inventorySheet = workbook.addWorksheet('库存明细');
    inventorySheet.columns = [
      { header: '门店编码', key: 'storeCode', width: 12 },
      { header: '门店名称', key: 'storeName', width: 20 },
      { header: '商品编码', key: 'sku', width: 15 },
      { header: '商品名称', key: 'productName', width: 25 },
      { header: '分类', key: 'category', width: 15 },
      { header: '总库存', key: 'quantity', width: 10 },
      { header: '可用库存', key: 'availableQty', width: 10 },
      { header: '锁定库存', key: 'lockedQty', width: 10 },
      { header: '单价', key: 'price', width: 12 },
      { header: '库存价值', key: 'value', width: 14 },
      { header: '最后更新', key: 'lastUpdated', width: 20 },
    ];
    inventorySheet.addRows(inventory);
    inventorySheet.getRow(1).font = { bold: true };

    if (records.length > 0) {
      const recordsSheet = workbook.addWorksheet('库存变动');
      recordsSheet.columns = [
        { header: '门店', key: 'storeCode', width: 12 },
        { header: '商品', key: 'productName', width: 25 },
        { header: '操作类型', key: 'operationType', width: 12 },
        { header: '变动前', key: 'quantityBefore', width: 10 },
        { header: '变动量', key: 'changeQuantity', width: 10 },
        { header: '变动后', key: 'quantityAfter', width: 10 },
        { header: '原价格', key: 'priceBefore', width: 10 },
        { header: '新价格', key: 'priceAfter', width: 10 },
        { header: '操作人', key: 'operator', width: 12 },
        { header: '时间', key: 'createdAt', width: 20 },
        { header: '备注', key: 'remark', width: 30 },
      ];
      recordsSheet.addRows(records);
      recordsSheet.getRow(1).font = { bold: true };
    }

    if (transfers.length > 0) {
      const transfersSheet = workbook.addWorksheet('调拨记录');
      transfersSheet.columns = [
        { header: '调拨单号', key: 'orderNo', width: 20 },
        { header: '源门店', key: 'sourceStore', width: 30 },
        { header: '目标门店', key: 'targetStore', width: 30 },
        { header: '状态', key: 'status', width: 10 },
        { header: '总数量', key: 'totalQuantity', width: 10 },
        { header: '总金额', key: 'totalAmount', width: 14 },
        { header: '操作人', key: 'operator', width: 12 },
        { header: '创建时间', key: 'createdAt', width: 20 },
        { header: '完成时间', key: 'completedAt', width: 20 },
      ];
      transfersSheet.addRows(transfers);
      transfersSheet.getRow(1).font = { bold: true };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private exportToMarkdown(
    inventory: InventoryRow[],
    records: InventoryRecordRow[],
    transfers: TransferRow[],
    statistics: any,
  ): string {
    let md = '# 门店库存报表\n\n';
    md += `> 生成时间: ${statistics.generatedAt}\n\n`;

    md += '## 汇总统计\n\n';
    md += '| 项目 | 值 |\n| --- | --- |\n';
    md += `| 商品种类数 | ${statistics.totalProducts} |\n`;
    md += `| 总库存数量 | ${statistics.totalQuantity} |\n`;
    md += `| 库存总价值 | ${statistics.totalValueFormatted} |\n`;
    md += `| 低库存商品数 | ${statistics.lowStock} |\n`;
    md += `| 变动记录数 | ${statistics.recordsCount} |\n`;
    md += `| 调拨单数 | ${statistics.transfersCount} |\n`;
    md += `| 进行中调拨 | ${statistics.inTransfersCount} |\n`;
    md += `| 已完成调拨 | ${statistics.completedTransfersCount} |\n\n`;

    md += '## 库存明细\n\n';
    md += '| 门店 | 商品 | 分类 | 总库存 | 可用 | 锁定 | 单价 | 价值 | 最后更新 |\n';
    md += '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |\n';
    inventory.slice(0, 100).forEach((item) => {
      md += `| ${item.storeName} (${item.storeCode}) | ${item.productName} (${item.sku}) | ${item.category} | ${item.quantity} | ${item.availableQty} | ${item.lockedQty} | ${item.price.toFixed(2)} | ${item.value.toFixed(2)} | ${item.lastUpdated} |\n`;
    });
    if (inventory.length > 100) {
      md += `\n> 共 ${inventory.length} 条记录，仅显示前 100 条\n\n`;
    } else {
      md += '\n';
    }

    if (records.length > 0) {
      md += '## 库存变动记录\n\n';
      md += '| 时间 | 门店 | 商品 | 操作 | 变动量 | 操作人 | 备注 |\n';
      md += '| --- | --- | --- | --- | ---: | --- | --- |\n';
      records.slice(0, 50).forEach((item) => {
        const change = item.changeQuantity > 0 ? `+${item.changeQuantity}` : item.changeQuantity;
        md += `| ${item.createdAt} | ${item.storeCode} | ${item.productName} | ${item.operationType} | ${change} | ${item.operator} | ${item.remark} |\n`;
      });
      if (records.length > 50) {
        md += `\n> 共 ${records.length} 条记录，仅显示前 50 条\n\n`;
      } else {
        md += '\n';
      }
    }

    if (transfers.length > 0) {
      md += '## 调拨记录\n\n';
      md += '| 单号 | 源门店 | 目标门店 | 状态 | 数量 | 金额 | 操作人 | 创建时间 |\n';
      md += '| --- | --- | --- | --- | ---: | ---: | --- | --- |\n';
      transfers.slice(0, 30).forEach((item) => {
        md += `| ${item.orderNo} | ${item.sourceStore} | ${item.targetStore} | ${item.status} | ${item.totalQuantity} | ${item.totalAmount.toFixed(2)} | ${item.operator} | ${item.createdAt} |\n`;
      });
      if (transfers.length > 30) {
        md += `\n> 共 ${transfers.length} 条记录，仅显示前 30 条\n\n`;
      } else {
        md += '\n';
      }
    }

    return md;
  }

  private async exportToPDF(
    inventory: InventoryRow[],
    records: InventoryRecordRow[],
    transfers: TransferRow[],
    statistics: any,
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const pageWidth = 800;
    const pageHeight = 600;
    const margin = 50;
    let yPosition = pageHeight - margin;

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([pageWidth, pageHeight]);

    const addText = (
      text: string,
      x: number,
      y: number,
      options: { fontSize?: number; bold?: boolean; color?: [number, number, number] } = {},
    ) => {
      const { fontSize = 12, bold = false, color = [0, 0, 0] } = options;
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font: bold ? boldFont : font,
        color: rgb(...color),
      });
    };

    const addLine = () => {
      page.drawLine({
        start: { x: margin, y: yPosition + 5 },
        end: { x: pageWidth - margin, y: yPosition + 5 },
        thickness: 1,
        color: rgb(0.7, 0.7, 0.7),
      });
    };

    const checkPage = (neededSpace: number) => {
      if (yPosition - neededSpace < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;
      }
    };

    addText('门店库存报表', pageWidth / 2 - 80, yPosition, { fontSize: 20, bold: true });
    yPosition -= 30;
    addText(`生成时间: ${statistics.generatedAt}`, margin, yPosition, { fontSize: 10, color: [0.5, 0.5, 0.5] });
    yPosition -= 25;
    addLine();
    yPosition -= 20;

    addText('汇总统计', margin, yPosition, { fontSize: 14, bold: true });
    yPosition -= 25;

    const stats = [
      ['商品种类数', statistics.totalProducts.toString()],
      ['总库存数量', statistics.totalQuantity.toString()],
      ['库存总价值', statistics.totalValueFormatted],
      ['低库存商品数', statistics.lowStock.toString()],
      ['变动记录数', statistics.recordsCount.toString()],
      ['调拨单数', statistics.transfersCount.toString()],
    ];

    stats.forEach(([label, value]) => {
      checkPage(20);
      addText(label, margin + 20, yPosition, { bold: true });
      addText(value, margin + 150, yPosition);
      yPosition -= 20;
    });

    yPosition -= 15;
    addLine();
    yPosition -= 20;

    addText('库存明细 (Top 20)', margin, yPosition, { fontSize: 14, bold: true });
    yPosition -= 25;

    const headers = ['门店', '商品', '库存', '可用', '单价', '价值'];
    const colWidths = [80, 150, 60, 60, 80, 80];
    let x = margin;

    headers.forEach((header, i) => {
      addText(header, x, yPosition, { bold: true, fontSize: 10 });
      x += colWidths[i];
    });
    yPosition -= 18;
    addLine();
    yPosition -= 15;

    inventory.slice(0, 20).forEach((item) => {
      checkPage(25);
      let x = margin;
      addText(item.storeCode, x, yPosition, { fontSize: 9 });
      x += colWidths[0];
      addText(item.productName.substring(0, 20), x, yPosition, { fontSize: 9 });
      x += colWidths[1];
      addText(item.quantity.toString(), x, yPosition, { fontSize: 9 });
      x += colWidths[2];
      addText(item.availableQty.toString(), x, yPosition, { fontSize: 9 });
      x += colWidths[3];
      addText(item.price.toFixed(2), x, yPosition, { fontSize: 9 });
      x += colWidths[4];
      addText(item.value.toFixed(2), x, yPosition, { fontSize: 9 });
      yPosition -= 16;
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  private translateOperationType(type: string): string {
    const map: Record<string, string> = {
      IN: '入库',
      OUT: '出库',
      ADJUST: '调整',
      PRICE_CHANGE: '改价',
      TRANSFER_IN: '调拨入',
      TRANSFER_OUT: '调拨出',
    };
    return map[type] || type;
  }

  private translateTransferStatus(status: TransferStatus): string {
    const map: Record<TransferStatus, string> = {
      PENDING: '待处理',
      IN_PROGRESS: '进行中',
      COMPLETED: '已完成',
      CANCELLED: '已取消',
      REVERTED: '已回退',
      FAILED: '失败',
    };
    return map[status] || status;
  }

  private formatCurrency(amount: number): string {
    return `¥${amount.toFixed(2)}`;
  }
}
