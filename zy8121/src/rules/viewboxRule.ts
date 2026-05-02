import { Rule, RuleContext } from './types';
import { Issue } from '../types';

export const viewBoxRule: Rule = {
  id: 'SVG-001',
  name: 'viewBox 检查',
  category: 'viewbox',
  description: '检查 SVG 是否包含有效的 viewBox 属性',
  severity: 'warning',
  check: checkViewBox,
};

export const dimensionRule: Rule = {
  id: 'SVG-002',
  name: '尺寸单位检查',
  category: 'dimension',
  description: '检查 SVG 尺寸和单位是否符合印刷要求',
  severity: 'warning',
  check: checkDimensions,
};

function checkViewBox(context: RuleContext): Issue[] {
  const issues: Issue[] = [];
  const { svg } = context;

  if (!svg.viewBox) {
    issues.push({
      id: 'SVG-001-001',
      severity: 'critical',
      category: 'viewbox',
      message: 'SVG 缺少 viewBox 属性',
      details: {
        hasWidth: svg.width !== undefined,
        hasHeight: svg.height !== undefined,
        hasUnit: svg.unit !== undefined,
      },
      suggestion: '为 SVG 添加 viewBox 属性以确保正确的缩放和定位，例如：viewBox="0 0 100 100"',
    });
  } else {
    if (svg.viewBox.width <= 0 || svg.viewBox.height <= 0) {
      issues.push({
        id: 'SVG-001-002',
        severity: 'critical',
        category: 'viewbox',
        message: 'viewBox 包含无效的尺寸值',
        details: {
          viewBox: svg.viewBox,
        },
        suggestion: '确保 viewBox 的宽高值为正数',
      });
    }
    
    if (svg.viewBox.x !== 0 || svg.viewBox.y !== 0) {
      issues.push({
        id: 'SVG-001-003',
        severity: 'warning',
        category: 'viewbox',
        message: 'viewBox 原点不为 (0, 0)，可能导致定位问题',
        details: {
          viewBox: svg.viewBox,
        },
        suggestion: '建议将 viewBox 原点设置为 (0, 0)',
      });
    }
  }

  return issues;
}

function checkDimensions(context: RuleContext): Issue[] {
  const issues: Issue[] = [];
  const { svg } = context;

  if (svg.width === undefined || svg.height === undefined) {
    if (!svg.viewBox) {
      issues.push({
        id: 'SVG-002-001',
        severity: 'critical',
        category: 'dimension',
        message: 'SVG 缺少明确的尺寸定义',
        details: {
          hasWidthAttr: svg.width !== undefined,
          hasHeightAttr: svg.height !== undefined,
          hasViewBox: svg.viewBox !== undefined,
        },
        suggestion: '为 SVG 添加 width/height 属性或 viewBox 属性',
      });
    }
  }

  if (svg.unit === undefined && (svg.width !== undefined || svg.height !== undefined)) {
    issues.push({
      id: 'SVG-002-002',
      severity: 'warning',
      category: 'dimension',
      message: 'SVG 尺寸未指定单位',
      details: {
        width: svg.width,
        height: svg.height,
      },
      suggestion: '建议为尺寸添加明确的单位，印刷行业推荐使用 mm (毫米) 或 pt (点)',
    });
  }

  if (svg.unit) {
    const printUnits = ['mm', 'cm', 'pt', 'in'];
    if (!printUnits.includes(svg.unit)) {
      issues.push({
        id: 'SVG-002-003',
        severity: 'warning',
        category: 'dimension',
        message: `SVG 使用的单位 "${svg.unit}" 不是印刷行业标准单位`,
        details: {
          unit: svg.unit,
          recommendedUnits: printUnits,
        },
        suggestion: '印刷行业推荐使用 mm (毫米)、cm (厘米)、pt (点) 或 in (英寸)',
      });
    }
  }

  if (svg.width !== undefined && svg.height !== undefined) {
    if (svg.width <= 0 || svg.height <= 0) {
      issues.push({
        id: 'SVG-002-004',
        severity: 'critical',
        category: 'dimension',
        message: 'SVG 尺寸包含无效值',
        details: {
          width: svg.width,
          height: svg.height,
          unit: svg.unit,
        },
        suggestion: '确保 SVG 宽高值为正数',
      });
    }
  }

  return issues;
}
