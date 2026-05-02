import * as fs from 'fs';
import { DOMParser } from 'xmldom';
import { ParsedSVG, SVGElement, SVGPath } from '../types';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function parseSvgFile(filePath: string): ParsedSVG {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseSvgContent(content, filePath);
}

export function parseSvgContent(content: string, fileName?: string): ParsedSVG {
  const parser = new DOMParser({
    errorHandler: {
      warning: () => {},
      error: () => {},
      fatalError: () => {},
    },
  });
  
  const doc = parser.parseFromString(content, 'image/svg+xml');
  const svgElement = doc.getElementsByTagNameNS(SVG_NS, 'svg')[0] || 
                     doc.getElementsByTagName('svg')[0];
  
  if (!svgElement) {
    throw new Error(`无效的 SVG 文件: 未找到 svg 根元素`);
  }

  const viewBox = parseViewBox(svgElement.getAttribute('viewBox'));
  const { width, height, unit } = parseDimensions(
    svgElement.getAttribute('width'),
    svgElement.getAttribute('height'),
    viewBox
  );

  const elements: SVGElement[] = [];
  const paths: SVGPath[] = [];

  extractElements(svgElement, elements, paths);

  return {
    viewBox,
    width,
    height,
    unit,
    elements,
    paths,
    rawContent: content,
  };
}

function parseViewBox(viewBoxAttr: string | null): ParsedSVG['viewBox'] | undefined {
  if (!viewBoxAttr) {
    return undefined;
  }
  
  const parts = viewBoxAttr.trim().split(/\s+|,/).map(Number);
  
  if (parts.length === 4 && parts.every(p => !isNaN(p))) {
    return {
      x: parts[0],
      y: parts[1],
      width: parts[2],
      height: parts[3],
    };
  }
  
  return undefined;
}

function parseDimensions(
  widthAttr: string | null,
  heightAttr: string | null,
  viewBox?: ParsedSVG['viewBox']
): { width?: number; height?: number; unit?: string } {
  const widthResult = parseDimension(widthAttr);
  const heightResult = parseDimension(heightAttr);
  
  const unit = widthResult.unit || heightResult.unit;
  
  let width = widthResult.value;
  let height = heightResult.value;
  
  if (width === undefined && viewBox) {
    width = viewBox.width;
  }
  
  if (height === undefined && viewBox) {
    height = viewBox.height;
  }
  
  return { width, height, unit };
}

interface DimensionResult {
  value?: number;
  unit?: string;
}

function parseDimension(attr: string | null): DimensionResult {
  if (!attr) {
    return {};
  }
  
  const match = attr.match(/^([\d.]+)(px|pt|mm|cm|in|em|rem|%)?$/i);
  
  if (match) {
    return {
      value: parseFloat(match[1]),
      unit: match[2]?.toLowerCase(),
    };
  }
  
  return {};
}

function extractElements(
  element: Element,
  elements: SVGElement[],
  paths: SVGPath[]
): void {
  const tagName = element.localName || element.tagName.toLowerCase();
  
  const typeMap: Record<string, SVGElement['type']> = {
    path: 'path',
    circle: 'circle',
    rect: 'rect',
    line: 'line',
    text: 'text',
  };
  
  const type = typeMap[tagName];
  
  if (type) {
    const attributes: Record<string, string> = {};
    
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = attr.value;
    }
    
    elements.push({
      type,
      id: element.getAttribute('id') || undefined,
      attributes,
    });
    
    if (type === 'path') {
      const d = element.getAttribute('d');
      if (d) {
        paths.push({
          id: element.getAttribute('id') || undefined,
          d,
          stroke: element.getAttribute('stroke') || undefined,
          strokeWidth: element.hasAttribute('stroke-width') 
            ? parseFloat(element.getAttribute('stroke-width') || '0')
            : undefined,
          fill: element.getAttribute('fill') || undefined,
        });
      }
    }
  }
  
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i];
    if (child.nodeType === 1) {
      extractElements(child as Element, elements, paths);
    }
  }
}

export function isPathClosed(d: string): boolean {
  const trimmed = d.trim().toUpperCase();
  
  if (trimmed.endsWith('Z')) {
    return true;
  }
  
  const commands = parsePathCommands(d);
  
  if (commands.length < 2) {
    return false;
  }
  
  const firstMove = commands.find(c => c.type === 'M' || c.type === 'm');
  if (!firstMove || firstMove.x === undefined || firstMove.y === undefined) {
    return false;
  }
  
  let currentX: number = firstMove.x;
  let currentY: number = firstMove.y;
  let startX: number = currentX;
  let startY: number = currentY;
  
  for (const cmd of commands) {
    switch (cmd.type) {
      case 'M':
      case 'm':
        if (cmd.x !== undefined && cmd.y !== undefined) {
          currentX = cmd.type === 'm' ? currentX + cmd.x : cmd.x;
          currentY = cmd.type === 'm' ? currentY + cmd.y : cmd.y;
          startX = currentX;
          startY = currentY;
        }
        break;
      case 'L':
      case 'l':
        if (cmd.x !== undefined && cmd.y !== undefined) {
          currentX = cmd.type === 'l' ? currentX + cmd.x : cmd.x;
          currentY = cmd.type === 'l' ? currentY + cmd.y : cmd.y;
        }
        break;
      case 'H':
      case 'h':
        if (cmd.x !== undefined) {
          currentX = cmd.type === 'h' ? currentX + cmd.x : cmd.x;
        }
        break;
      case 'V':
      case 'v':
        if (cmd.y !== undefined) {
          currentY = cmd.type === 'v' ? currentY + cmd.y : cmd.y;
        }
        break;
    }
  }
  
  const tolerance = 0.001;
  return Math.abs(currentX - startX) < tolerance && Math.abs(currentY - startY) < tolerance;
}

interface PathCommand {
  type: string;
  x?: number;
  y?: number;
}

function parsePathCommands(d: string): PathCommand[] {
  const commands: PathCommand[] = [];
  const tokens = d.match(/[a-zA-Z]|[-+]?[\d.]+/g) || [];
  
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    
    if (/[a-zA-Z]/.test(token)) {
      const type = token;
      const cmd: PathCommand = { type };
      
      if (['M', 'm', 'L', 'l'].includes(type)) {
        if (i + 2 <= tokens.length) {
          cmd.x = parseFloat(tokens[i + 1]);
          cmd.y = parseFloat(tokens[i + 2]);
          i += 3;
        } else {
          i++;
        }
      } else if (['H', 'h', 'V', 'v'].includes(type)) {
        if (i + 1 <= tokens.length) {
          if (type === 'H' || type === 'h') {
            cmd.x = parseFloat(tokens[i + 1]);
          } else {
            cmd.y = parseFloat(tokens[i + 1]);
          }
          i += 2;
        } else {
          i++;
        }
      } else {
        i++;
      }
      
      commands.push(cmd);
    } else {
      i++;
    }
  }
  
  return commands;
}
