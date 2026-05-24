import Papa from 'papaparse';
import type { InventoryReport, Layer, Slot, SKU } from '../types';
import { countExpiringSKUs, filterSKUsByExpiry } from './expiryChecker';

export function generateInventoryReport(
  layers: Layer[],
  slots: Slot[],
  skus: SKU[],
  expiryDays: number,
): InventoryReport {
  const layerStats = layers.map((layer) => {
    const layerSlots = slots.filter((s) => s.layerId === layer.id);
    const layerSKUs = skus.filter((s) => s.layerId === layer.id);
    const misplacedCount = layerSlots.filter((s) => s.status === 'misplaced').length;
    const conflictCount = layerSlots.filter((s) => s.status === 'conflict').length;

    return {
      layerId: layer.id,
      layerName: layer.name,
      totalSlots: layerSlots.length,
      occupiedSlots: layerSlots.filter((s) => s.isOccupied).length,
      misplacedCount: misplacedCount + conflictCount,
      expiringCount: countExpiringSKUs(layerSKUs, expiryDays),
    };
  });

  const totalSlots = slots.length;
  const occupiedSlots = slots.filter((s) => s.isOccupied).length;
  const misplacedItems = slots.filter((s) => s.status === 'misplaced' || s.status === 'conflict').length;
  const expiringItems = countExpiringSKUs(skus, expiryDays);

  return {
    id: `report-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    totalSlots,
    occupiedSlots,
    misplacedItems,
    expiringItems,
    layerStats,
    skuDetails: skus,
  };
}

export function exportReportJSON(report: InventoryReport): void {
  const dataStr = JSON.stringify(report, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `inventory-report-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportReportCSV(report: InventoryReport): void {
  const summaryData = [
    { metric: '总货位数', value: report.totalSlots },
    { metric: '已占用货位', value: report.occupiedSlots },
    { metric: '温层错放数量', value: report.misplacedItems },
    { metric: '临期商品数量', value: report.expiringItems },
    { metric: '生成时间', value: new Date(report.generatedAt).toLocaleString() },
  ];

  const skuData = report.skuDetails.map((sku) => ({
    SKU编码: sku.code,
    商品名称: sku.name,
    批次号: sku.batchNo,
    货位: sku.slotId,
    温层: sku.layerId,
    数量: sku.quantity,
    类别: sku.category,
    入库日期: sku.inboundDate,
    效期: sku.expiryDate,
  }));

  const layerData = report.layerStats.map((stat) => ({
    温层名称: stat.layerName,
    总货位数: stat.totalSlots,
    已占用: stat.occupiedSlots,
    错放数量: stat.misplacedCount,
    临期数量: stat.expiringCount,
  }));

  const csvSummary = Papa.unparse(summaryData);
  const csvSKUs = Papa.unparse(skuData);
  const csvLayers = Papa.unparse(layerData);

  const fullCSV = `=== 盘点汇总 ===\n${csvSummary}\n\n=== 温层统计 ===\n${csvLayers}\n\n=== SKU明细 ===\n${csvSKUs}`;

  const dataBlob = new Blob(['\ufeff' + fullCSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `inventory-report-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getFilteredSKUs(
  skus: SKU[],
  searchQuery: string,
  selectedLayerIds: string[],
  expiryDays: number,
): SKU[] {
  return skus.filter((sku) => {
    const matchesSearch =
      searchQuery === '' ||
      sku.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sku.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sku.batchNo.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesLayer = selectedLayerIds.length === 0 || selectedLayerIds.includes(sku.layerId);
    const matchesExpiry = expiryDays <= 0 || skus.some((s) => s.id === sku.id);

    return matchesSearch && matchesLayer && matchesExpiry;
  });
}
