import { Rule, RuleContext } from './types';
import { Issue } from '../types';

export const barcodeRule: Rule = {
  id: 'BARCODE-001',
  name: '条码检查',
  category: 'barcode',
  description: '检查条码尺寸、位置和安静区是否符合要求',
  severity: 'warning',
  check: checkBarcodes,
};

function checkBarcodes(context: RuleContext): Issue[] {
  const issues: Issue[] = [];
  const { svg, rules, barcodes } = context;

  if (!barcodes || barcodes.length === 0) {
    return issues;
  }

  const viewBox = svg.viewBox || {
    x: 0,
    y: 0,
    width: svg.width || 0,
    height: svg.height || 0,
  };

  const barcodeRules = rules.barcode;

  for (const barcode of barcodes) {
    const barcodeId = barcode.id || 'unnamed';

    if (barcode.width < barcodeRules.minWidth) {
      issues.push({
        id: `BARCODE-001-001-${barcodeId}`,
        severity: 'critical',
        category: 'barcode',
        message: `条码宽度小于最小值: ${barcodeId}`,
        details: {
          barcodeId: barcode.id,
          barcodeType: barcode.type,
          value: barcode.value,
          actualWidth: barcode.width,
          minWidth: barcodeRules.minWidth,
        },
        location: {
          x: barcode.x,
          y: barcode.y,
        },
        suggestion: `条码最小宽度应为 ${barcodeRules.minWidth}，当前为 ${barcode.width}`,
      });
    }

    if (barcode.width > barcodeRules.maxWidth) {
      issues.push({
        id: `BARCODE-001-002-${barcodeId}`,
        severity: 'warning',
        category: 'barcode',
        message: `条码宽度大于推荐最大值: ${barcodeId}`,
        details: {
          barcodeId: barcode.id,
          barcodeType: barcode.type,
          actualWidth: barcode.width,
          maxWidth: barcodeRules.maxWidth,
        },
        location: {
          x: barcode.x,
          y: barcode.y,
        },
        suggestion: `条码推荐最大宽度为 ${barcodeRules.maxWidth}，当前为 ${barcode.width}`,
      });
    }

    if (barcode.height < barcodeRules.minHeight) {
      issues.push({
        id: `BARCODE-001-003-${barcodeId}`,
        severity: 'critical',
        category: 'barcode',
        message: `条码高度小于最小值: ${barcodeId}`,
        details: {
          barcodeId: barcode.id,
          barcodeType: barcode.type,
          actualHeight: barcode.height,
          minHeight: barcodeRules.minHeight,
        },
        location: {
          x: barcode.x,
          y: barcode.y,
        },
        suggestion: `条码最小高度应为 ${barcodeRules.minHeight}，当前为 ${barcode.height}`,
      });
    }

    if (barcode.height > barcodeRules.maxHeight) {
      issues.push({
        id: `BARCODE-001-004-${barcodeId}`,
        severity: 'info',
        category: 'barcode',
        message: `条码高度大于推荐最大值: ${barcodeId}`,
        details: {
          barcodeId: barcode.id,
          barcodeType: barcode.type,
          actualHeight: barcode.height,
          maxHeight: barcodeRules.maxHeight,
        },
        location: {
          x: barcode.x,
          y: barcode.y,
        },
        suggestion: `条码推荐最大高度为 ${barcodeRules.maxHeight}，当前为 ${barcode.height}`,
      });
    }

    const quietZone = barcodeRules.quietZone;
    const barcodeArea = {
      x: barcode.x - quietZone,
      y: barcode.y - quietZone,
      width: barcode.width + quietZone * 2,
      height: barcode.height + quietZone * 2,
    };

    if (barcodeArea.x < viewBox.x) {
      issues.push({
        id: `BARCODE-001-005-${barcodeId}`,
        severity: 'critical',
        category: 'barcode',
        message: `条码安静区超出左侧边界: ${barcodeId}`,
        details: {
          barcodeId: barcode.id,
          barcodeArea,
          viewBox,
          quietZone,
        },
        location: {
          x: barcode.x,
          y: barcode.y,
        },
        suggestion: `条码左侧安静区需要 ${quietZone} 的空间，当前超出边界`,
      });
    }

    if (barcodeArea.x + barcodeArea.width > viewBox.x + viewBox.width) {
      issues.push({
        id: `BARCODE-001-006-${barcodeId}`,
        severity: 'critical',
        category: 'barcode',
        message: `条码安静区超出右侧边界: ${barcodeId}`,
        details: {
          barcodeId: barcode.id,
          barcodeArea,
          viewBox,
          quietZone,
        },
        location: {
          x: barcode.x,
          y: barcode.y,
        },
        suggestion: `条码右侧安静区需要 ${quietZone} 的空间，当前超出边界`,
      });
    }

    if (barcodeArea.y < viewBox.y) {
      issues.push({
        id: `BARCODE-001-007-${barcodeId}`,
        severity: 'critical',
        category: 'barcode',
        message: `条码安静区超出顶部边界: ${barcodeId}`,
        details: {
          barcodeId: barcode.id,
          barcodeArea,
          viewBox,
          quietZone,
        },
        location: {
          x: barcode.x,
          y: barcode.y,
        },
        suggestion: `条码顶部安静区需要 ${quietZone} 的空间，当前超出边界`,
      });
    }

    if (barcodeArea.y + barcodeArea.height > viewBox.y + viewBox.height) {
      issues.push({
        id: `BARCODE-001-008-${barcodeId}`,
        severity: 'critical',
        category: 'barcode',
        message: `条码安静区超出底部边界: ${barcodeId}`,
        details: {
          barcodeId: barcode.id,
          barcodeArea,
          viewBox,
          quietZone,
        },
        location: {
          x: barcode.x,
          y: barcode.y,
        },
        suggestion: `条码底部安静区需要 ${quietZone} 的空间，当前超出边界`,
      });
    }

    const bleedMargin = rules.bleed.margin;
    const safeArea = {
      x: viewBox.x + bleedMargin,
      y: viewBox.y + bleedMargin,
      width: viewBox.width - bleedMargin * 2,
      height: viewBox.height - bleedMargin * 2,
    };

    const inSafeZone = 
      barcode.x >= safeArea.x &&
      barcode.y >= safeArea.y &&
      barcode.x + barcode.width <= safeArea.x + safeArea.width &&
      barcode.y + barcode.height <= safeArea.y + safeArea.height;

    if (!inSafeZone) {
      issues.push({
        id: `BARCODE-001-009-${barcodeId}`,
        severity: 'warning',
        category: 'barcode',
        message: `条码在安全区外: ${barcodeId}`,
        details: {
          barcodeId: barcode.id,
          barcodeBounds: {
            x: barcode.x,
            y: barcode.y,
            width: barcode.width,
            height: barcode.height,
          },
          safeArea,
          bleedMargin,
        },
        location: {
          x: barcode.x,
          y: barcode.y,
        },
        suggestion: `条码应放置在安全区内 (出血边距 ${bleedMargin})，避免裁切风险`,
      });
    }

    if (!barcode.value || barcode.value.trim() === '') {
      issues.push({
        id: `BARCODE-001-010-${barcodeId}`,
        severity: 'critical',
        category: 'barcode',
        message: `条码缺少编码值: ${barcodeId}`,
        details: {
          barcodeId: barcode.id,
          barcodeType: barcode.type,
        },
        location: {
          x: barcode.x,
          y: barcode.y,
        },
        suggestion: '为条码提供有效的编码值',
      });
    }

    if (barcode.type === 'EAN13' && barcode.value.length !== 13) {
      issues.push({
        id: `BARCODE-001-011-${barcodeId}`,
        severity: 'warning',
        category: 'barcode',
        message: `EAN13 条码长度不正确: ${barcodeId}`,
        details: {
          barcodeId: barcode.id,
          expectedLength: 13,
          actualLength: barcode.value.length,
          value: barcode.value,
        },
        location: {
          x: barcode.x,
          y: barcode.y,
        },
        suggestion: 'EAN13 条码应为 13 位数字',
      });
    }
  }

  return issues;
}
