import { Rule, RuleContext } from './types';
import { Issue } from '../types';

export const bleedRule: Rule = {
  id: 'BLEED-001',
  name: '出血边距检查',
  category: 'bleed',
  description: '检查元素是否在安全区内，是否超出出血范围',
  severity: 'warning',
  check: checkBleed,
};

function checkBleed(context: RuleContext): Issue[] {
  const issues: Issue[] = [];
  const { svg, rules } = context;

  if (!svg.viewBox && svg.width === undefined) {
    return issues;
  }

  const viewBox = svg.viewBox || {
    x: 0,
    y: 0,
    width: svg.width || 0,
    height: svg.height || 0,
  };

  const bleedMargin = rules.bleed.margin;

  const contentArea = {
    x: viewBox.x + bleedMargin,
    y: viewBox.y + bleedMargin,
    width: viewBox.width - bleedMargin * 2,
    height: viewBox.height - bleedMargin * 2,
  };

  const totalArea = {
    x: viewBox.x,
    y: viewBox.y,
    width: viewBox.width,
    height: viewBox.height,
  };

  for (const element of svg.elements) {
    const bounds = getElementBounds(element);
    if (!bounds) {
      continue;
    }

    const elementId = element.id || 'unnamed';
    const elementType = element.type;

    const outsideContent = isOutsideArea(bounds, contentArea);
    const outsideTotal = isOutsideArea(bounds, totalArea);

    if (outsideTotal) {
      issues.push({
        id: `BLEED-001-001-${elementId}`,
        severity: 'critical',
        category: 'bleed',
        message: `${elementType} 元素完全超出画布范围: ${elementId}`,
        details: {
          elementId: element.id,
          elementType,
          elementBounds: bounds,
          totalArea,
        },
        location: {
          x: bounds.x,
          y: bounds.y,
          elementId: element.id,
        },
        suggestion: '将元素移回画布范围内',
      });
    } else if (outsideContent) {
      const partiallyOutside = isPartiallyOutside(bounds, contentArea);
      
      if (partiallyOutside) {
        issues.push({
          id: `BLEED-001-002-${elementId}`,
          severity: 'warning',
          category: 'bleed',
          message: `${elementType} 元素部分在出血区内: ${elementId}`,
          details: {
            elementId: element.id,
            elementType,
            elementBounds: bounds,
            contentArea,
            bleedMargin,
            bleedUnit: rules.bleed.unit,
          },
          location: {
            x: bounds.x,
            y: bounds.y,
            elementId: element.id,
          },
          suggestion: `确保重要内容保持在出血边距 (${bleedMargin}${rules.bleed.unit}) 内`,
        });
      }
    }
  }

  return issues;
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getElementBounds(element: RuleContext['svg']['elements'][0]): Bounds | undefined {
  const attrs = element.attributes;

  switch (element.type) {
    case 'rect': {
      const x = parseFloat(attrs.x || '0');
      const y = parseFloat(attrs.y || '0');
      const width = parseFloat(attrs.width || '0');
      const height = parseFloat(attrs.height || '0');
      if (width > 0 && height > 0) {
        return { x, y, width, height };
      }
      break;
    }
    case 'circle': {
      const cx = parseFloat(attrs.cx || '0');
      const cy = parseFloat(attrs.cy || '0');
      const r = parseFloat(attrs.r || '0');
      if (r > 0) {
        return {
          x: cx - r,
          y: cy - r,
          width: r * 2,
          height: r * 2,
        };
      }
      break;
    }
  }

  return undefined;
}

function isOutsideArea(bounds: Bounds, area: Bounds): boolean {
  return (
    bounds.x + bounds.width < area.x ||
    bounds.x > area.x + area.width ||
    bounds.y + bounds.height < area.y ||
    bounds.y > area.y + area.height
  );
}

function isPartiallyOutside(bounds: Bounds, area: Bounds): boolean {
  return (
    bounds.x < area.x ||
    bounds.x + bounds.width > area.x + area.width ||
    bounds.y < area.y ||
    bounds.y + bounds.height > area.y + area.height
  );
}
