import { Rule, RuleContext } from './types';
import { Issue } from '../types';
import { isPathClosed } from '../parsers';

export const dielineRule: Rule = {
  id: 'DIELINE-001',
  name: '刀线检查',
  category: 'dieline',
  description: '检查刀线路径是否闭合、颜色和线宽是否正确',
  severity: 'critical',
  check: checkDieline,
};

function checkDieline(context: RuleContext): Issue[] {
  const issues: Issue[] = [];
  const { svg, rules } = context;

  const dielinePaths = findDielinePaths(svg, rules);

  if (dielinePaths.length === 0) {
    issues.push({
      id: 'DIELINE-001-001',
      severity: 'critical',
      category: 'dieline',
      message: '未找到刀线路径',
      details: {
        expectedStrokeColor: rules.dieline.strokeColor,
        totalPaths: svg.paths.length,
      },
      suggestion: `确保刀线使用 ${rules.dieline.strokeColor} 描边颜色，或检查 YAML 配置中的 dieline.strokeColor 设置`,
    });
    return issues;
  }

  for (const path of dielinePaths) {
    const pathId = path.id || 'unnamed';

    if (rules.dieline.mustBeClosed) {
      const closed = isPathClosed(path.d);
      if (!closed) {
        issues.push({
          id: `DIELINE-001-002-${pathId}`,
          severity: 'critical',
          category: 'dieline',
          message: `刀线路径未闭合: ${pathId}`,
          details: {
            pathId: path.id,
            stroke: path.stroke,
            strokeWidth: path.strokeWidth,
          },
          location: {
            elementId: path.id,
          },
          suggestion: '在路径末尾添加 Z 命令以闭合路径，或确保路径的起点和终点坐标相同',
        });
      }
    }

    if (path.stroke && path.stroke.toLowerCase() !== rules.dieline.strokeColor.toLowerCase()) {
      const isCommonRed = isRedColor(path.stroke);
      if (!isCommonRed && rules.dieline.strokeColor === '#FF0000') {
        issues.push({
          id: `DIELINE-001-003-${pathId}`,
          severity: 'warning',
          category: 'dieline',
          message: `刀线描边颜色不标准: ${pathId}`,
          details: {
            pathId: path.id,
            actualColor: path.stroke,
            expectedColor: rules.dieline.strokeColor,
          },
          location: {
            elementId: path.id,
          },
          suggestion: `建议使用标准刀线颜色 ${rules.dieline.strokeColor}`,
        });
      }
    }

    if (path.strokeWidth !== undefined && path.strokeWidth !== rules.dieline.strokeWidth) {
      issues.push({
        id: `DIELINE-001-004-${pathId}`,
        severity: 'info',
        category: 'dieline',
        message: `刀线线宽与标准值不同: ${pathId}`,
        details: {
          pathId: path.id,
          actualWidth: path.strokeWidth,
          expectedWidth: rules.dieline.strokeWidth,
        },
        location: {
          elementId: path.id,
        },
        suggestion: `标准刀线线宽为 ${rules.dieline.strokeWidth}，当前为 ${path.strokeWidth}`,
      });
    }

    if (!path.stroke || path.stroke === 'none' || path.stroke === 'transparent') {
      issues.push({
        id: `DIELINE-001-005-${pathId}`,
        severity: 'warning',
        category: 'dieline',
        message: `刀线路径缺少描边: ${pathId}`,
        details: {
          pathId: path.id,
        },
        location: {
          elementId: path.id,
        },
        suggestion: `为刀线添加描边颜色，推荐使用 ${rules.dieline.strokeColor}`,
      });
    }
  }

  return issues;
}

function findDielinePaths(
  svg: RuleContext['svg'],
  rules: RuleContext['rules']
): RuleContext['svg']['paths'] {
  const targetColor = rules.dieline.strokeColor.toLowerCase();
  
  return svg.paths.filter(path => {
    if (!path.stroke) {
      return false;
    }
    
    const strokeColor = path.stroke.toLowerCase();
    
    if (strokeColor === targetColor) {
      return true;
    }
    
    if (targetColor === '#ff0000' && isRedColor(strokeColor)) {
      return true;
    }
    
    return false;
  });
}

function isRedColor(color: string): boolean {
  const lower = color.toLowerCase();
  
  if (lower === 'red' || lower === '#ff0000' || lower === '#f00') {
    return true;
  }
  
  const rgbMatch = lower.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return r > 200 && g < 50 && b < 50;
  }
  
  return false;
}
