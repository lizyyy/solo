import type { Route, DetectionIssue } from '../types';

function generateId(): string {
  return 'ISSUE-' + Date.now().toString(36).toUpperCase();
}

export class RouteDetectionEngine {
  static detectSupplementaryRoutes(routes: Route[]): DetectionIssue[] {
    const issues: DetectionIssue[] = [];

    for (const route of routes) {
      if (route.isSupplementary && !route.recalculated) {
        issues.push({
          id: generateId(),
          type: 'route_not_recalculated',
          routeId: route.id,
          severity: 'warning',
          description: `补录路线 "${route.name}" 没有重新计算长度`,
          status: 'open',
          nextAction: 'contact_designer',
          missingMaterials: ['楼层剖面草图（避让段）', '复核确认记录'],
          createdAt: new Date().toISOString()
        });
      }

      if (route.isSupplementary && route.calculatedLength !== undefined && 
          Math.abs(route.length - route.calculatedLength) > 0.5) {
        issues.push({
          id: generateId(),
          type: 'route_not_recalculated',
          routeId: route.id,
          severity: 'warning',
          description: `补录路线 "${route.name}" 长度不一致：记录 ${route.length}m，实测 ${route.calculatedLength}m`,
          status: 'open',
          nextAction: 'contact_designer',
          missingMaterials: ['长度复核计算书', '现场测量照片'],
          createdAt: new Date().toISOString()
        });
      }
    }

    return issues;
  }

  static getIssueTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'route_not_recalculated': '补录路线未重新计算长度'
    };
    return labels[type] || type;
  }

  static getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'open': '待处理',
      'supplemented': '已补充待复核',
      'resolved': '已解决'
    };
    return labels[status] || status;
  }

  static getNextActionLabel(action: string): string {
    const labels: Record<string, string> = {
      'contact_customer': '请联系展陈客户',
      'contact_designer': '请联系展陈设计师阿景'
    };
    return labels[action] || action;
  }

  static getSeverityColor(severity: string): string {
    const colors: Record<string, string> = {
      'warning': 'text-warning-500 bg-warning-50',
      'error': 'text-error-500 bg-red-50'
    };
    return colors[severity] || 'text-industrial-400 bg-industrial-50';
  }

  static getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'open': 'text-error-500 bg-red-50',
      'supplemented': 'text-warning-500 bg-warning-50',
      'resolved': 'text-success-500 bg-green-50'
    };
    return colors[status] || 'text-industrial-400 bg-industrial-50';
  }
}
