import { Rule, RuleContext } from './types';
import { Issue } from '../types';

export const registrationRule: Rule = {
  id: 'REG-001',
  name: '套准孔检查',
  category: 'registration',
  description: '检查套准孔是否存在、位置和尺寸是否正确',
  severity: 'warning',
  check: checkRegistration,
};

function checkRegistration(context: RuleContext): Issue[] {
  const issues: Issue[] = [];
  const { svg, rules } = context;

  if (!rules.registrationMarks.required) {
    return issues;
  }

  const viewBox = svg.viewBox || {
    x: 0,
    y: 0,
    width: svg.width || 0,
    height: svg.height || 0,
  };

  const registrationMarks = findRegistrationMarks(svg);

  if (registrationMarks.length === 0) {
    issues.push({
      id: 'REG-001-001',
      severity: 'critical',
      category: 'registration',
      message: '未找到套准孔标记',
      details: {
        required: rules.registrationMarks.required,
        expectedCount: 4,
      },
      suggestion: '在页面四角添加套准孔标记，用于印刷套色校准',
    });
    return issues;
  }

  const minSize = rules.registrationMarks.size.min;
  const maxSize = rules.registrationMarks.size.max;

  for (const mark of registrationMarks) {
    const markId = mark.id || 'unnamed';
    const size = mark.radius ? mark.radius * 2 : Math.max(mark.width || 0, mark.height || 0);

    if (size < minSize) {
      issues.push({
        id: `REG-001-002-${markId}`,
        severity: 'warning',
        category: 'registration',
        message: `套准孔尺寸过小: ${markId}`,
        details: {
          markId: mark.id,
          actualSize: size,
          minSize,
          maxSize,
        },
        location: {
          x: mark.x,
          y: mark.y,
          elementId: mark.id,
        },
        suggestion: `套准孔最小尺寸应为 ${minSize}，当前为 ${size}`,
      });
    }

    if (size > maxSize) {
      issues.push({
        id: `REG-001-003-${markId}`,
        severity: 'info',
        category: 'registration',
        message: `套准孔尺寸偏大: ${markId}`,
        details: {
          markId: mark.id,
          actualSize: size,
          minSize,
          maxSize,
        },
        location: {
          x: mark.x,
          y: mark.y,
          elementId: mark.id,
        },
        suggestion: `套准孔推荐尺寸范围 ${minSize}-${maxSize}，当前为 ${size}`,
      });
    }
  }

  const corners = estimateCorners(registrationMarks, viewBox);
  const tolerance = rules.registrationMarks.positionTolerance;

  const expectedPositions = getExpectedCornerPositions(viewBox, rules.bleed.margin);

  for (let i = 0; i < corners.length; i++) {
    const corner = corners[i];
    const expected = expectedPositions[i];
    
    if (!corner) {
      issues.push({
        id: `REG-001-004-${i}`,
        severity: 'warning',
        category: 'registration',
        message: `缺少 ${getCornerName(i)} 角的套准孔`,
        details: {
          corner: getCornerName(i),
          expectedPosition: expected,
        },
        suggestion: `在 ${getCornerName(i)} 角添加套准孔，建议位置: (${expected.x}, ${expected.y})`,
      });
      continue;
    }

    const distance = Math.sqrt(
      Math.pow(corner.x - expected.x, 2) + Math.pow(corner.y - expected.y, 2)
    );

    if (distance > tolerance) {
      issues.push({
        id: `REG-001-005-${corner.id || i}`,
        severity: 'info',
        category: 'registration',
        message: `${getCornerName(i)} 角套准孔位置偏差较大`,
        details: {
          markId: corner.id,
          actualPosition: { x: corner.x, y: corner.y },
          expectedPosition: expected,
          distance,
          tolerance,
        },
        location: {
          x: corner.x,
          y: corner.y,
          elementId: corner.id,
        },
        suggestion: `套准孔位置偏差 ${distance.toFixed(2)}，容差为 ${tolerance}`,
      });
    }
  }

  return issues;
}

interface RegistrationMark {
  id?: string;
  x: number;
  y: number;
  radius?: number;
  width?: number;
  height?: number;
}

function findRegistrationMarks(svg: RuleContext['svg']): RegistrationMark[] {
  const marks: RegistrationMark[] = [];

  for (const element of svg.elements) {
    const attrs = element.attributes;
    
    if (element.type === 'circle') {
      const cx = parseFloat(attrs.cx || '0');
      const cy = parseFloat(attrs.cy || '0');
      const r = parseFloat(attrs.r || '0');
      
      if (r > 0) {
        marks.push({
          id: element.id,
          x: cx,
          y: cy,
          radius: r,
        });
      }
    }
    
    if (element.type === 'rect') {
      const x = parseFloat(attrs.x || '0');
      const y = parseFloat(attrs.y || '0');
      const width = parseFloat(attrs.width || '0');
      const height = parseFloat(attrs.height || '0');
      
      if (width > 0 && height > 0) {
        const isSquareish = Math.abs(width - height) / Math.max(width, height) < 0.2;
        
        if (isSquareish && width <= 20) {
          marks.push({
            id: element.id,
            x: x + width / 2,
            y: y + height / 2,
            width,
            height,
          });
        }
      }
    }
  }

  return marks;
}

function estimateCorners(
  marks: RegistrationMark[],
  viewBox: { x: number; y: number; width: number; height: number }
): (RegistrationMark | undefined)[] {
  const centerX = viewBox.x + viewBox.width / 2;
  const centerY = viewBox.y + viewBox.height / 2;

  const corners: (RegistrationMark | undefined)[] = [undefined, undefined, undefined, undefined];

  for (const mark of marks) {
    const quadrant = getQuadrant(mark.x, mark.y, centerX, centerY);
    
    if (!corners[quadrant]) {
      corners[quadrant] = mark;
    } else {
      const existing = corners[quadrant]!;
      const existingDist = getDistanceToCorner(existing, quadrant, viewBox);
      const newDist = getDistanceToCorner(mark, quadrant, viewBox);
      
      if (newDist < existingDist) {
        corners[quadrant] = mark;
      }
    }
  }

  return corners;
}

function getQuadrant(x: number, y: number, centerX: number, centerY: number): number {
  if (x <= centerX && y <= centerY) return 0;
  if (x > centerX && y <= centerY) return 1;
  if (x > centerX && y > centerY) return 2;
  return 3;
}

function getCornerName(index: number): string {
  const names = ['左上', '右上', '右下', '左下'];
  return names[index] || '未知';
}

function getDistanceToCorner(
  mark: RegistrationMark,
  quadrant: number,
  viewBox: { x: number; y: number; width: number; height: number }
): number {
  const corners = [
    { x: viewBox.x, y: viewBox.y },
    { x: viewBox.x + viewBox.width, y: viewBox.y },
    { x: viewBox.x + viewBox.width, y: viewBox.y + viewBox.height },
    { x: viewBox.x, y: viewBox.y + viewBox.height },
  ];
  
  const corner = corners[quadrant];
  return Math.sqrt(Math.pow(mark.x - corner.x, 2) + Math.pow(mark.y - corner.y, 2));
}

function getExpectedCornerPositions(
  viewBox: { x: number; y: number; width: number; height: number },
  bleedMargin: number
): { x: number; y: number }[] {
  const margin = bleedMargin / 2;
  return [
    { x: viewBox.x + margin, y: viewBox.y + margin },
    { x: viewBox.x + viewBox.width - margin, y: viewBox.y + margin },
    { x: viewBox.x + viewBox.width - margin, y: viewBox.y + viewBox.height - margin },
    { x: viewBox.x + margin, y: viewBox.y + viewBox.height - margin },
  ];
}
