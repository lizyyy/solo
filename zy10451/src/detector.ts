import {
  ComposeFile,
  ComposeService,
  PortConflict,
  ServiceNameConflict,
  DetectionResult,
  FixSuggestion
} from './types';

export class ConflictDetector {
  detect(composeFiles: ComposeFile[]): DetectionResult {
    const allServices = composeFiles.flatMap(f => f.services);
    const allParseErrors = composeFiles.flatMap(f => f.parseErrors);

    const portConflicts = this.detectPortConflicts(allServices);
    const serviceNameConflicts = this.detectServiceNameConflicts(allServices);

    return {
      composeFiles: composeFiles.map(f => f.path),
      totalServices: allServices.length,
      totalPorts: allServices.reduce((sum, s) => sum + s.ports.length, 0),
      portConflicts,
      serviceNameConflicts,
      parseErrors: allParseErrors,
      scanTime: new Date().toISOString()
    };
  }

  private detectPortConflicts(services: ComposeService[]): PortConflict[] {
    const portMap = new Map<string, PortConflict['services']>();

    for (const service of services) {
      for (const port of service.ports) {
        const key = `${port.hostIp || '0.0.0.0'}:${port.hostPort}`;
        
        if (!portMap.has(key)) {
          portMap.set(key, []);
        }

        portMap.get(key)!.push({
          name: service.name,
          file: service.file,
          containerPort: port.containerPort,
          protocol: port.protocol,
          line: service.line
        });
      }
    }

    const conflicts: PortConflict[] = [];
    for (const [key, servicesUsingPort] of portMap.entries()) {
      if (servicesUsingPort.length > 1) {
        const [hostIp, portStr] = key.split(':');
        const port = parseInt(portStr, 10);
        
        conflicts.push({
          port,
          hostIp: hostIp === '0.0.0.0' ? undefined : hostIp,
          services: servicesUsingPort,
          severity: this.calculatePortSeverity(port, servicesUsingPort)
        });
      }
    }

    return conflicts.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private calculatePortSeverity(port: number, services: PortConflict['services']): PortConflict['severity'] {
    if (services.length > 2) return 'high';
    
    const commonPorts = [80, 443, 8080, 3306, 5432, 27017, 6379, 3000, 8000];
    if (commonPorts.includes(port)) return 'high';
    
    if (services.length === 2) return 'medium';
    return 'low';
  }

  private detectServiceNameConflicts(services: ComposeService[]): ServiceNameConflict[] {
    const serviceMap = new Map<string, ServiceNameConflict['services']>();

    for (const service of services) {
      if (!serviceMap.has(service.name)) {
        serviceMap.set(service.name, []);
      }
      serviceMap.get(service.name)!.push({
        file: service.file,
        line: service.line
      });
    }

    const conflicts: ServiceNameConflict[] = [];
    for (const [name, serviceInstances] of serviceMap.entries()) {
      if (serviceInstances.length > 1) {
        conflicts.push({
          name,
          services: serviceInstances
        });
      }
    }

    return conflicts;
  }

  generateSuggestions(result: DetectionResult): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];
    let priority = 1;

    for (const conflict of result.portConflicts) {
      const uniqueFiles = [...new Set(conflict.services.map(s => s.file))];
      const serviceList = conflict.services.map(s => `${s.name} (${this.shortenPath(s.file)})`).join(', ');
      
      suggestions.push({
        conflictType: 'port',
        priority: priority++,
        description: `端口 ${conflict.port} 被 ${conflict.services.length} 个服务占用: ${serviceList}`,
        affectedFiles: uniqueFiles,
        action: this.generatePortFixAction(conflict)
      });
    }

    for (const conflict of result.serviceNameConflicts) {
      const uniqueFiles = [...new Set(conflict.services.map(s => s.file))];
      
      suggestions.push({
        conflictType: 'serviceName',
        priority: priority++,
        description: `服务名 "${conflict.name}" 在 ${conflict.services.length} 个文件中重复定义`,
        affectedFiles: uniqueFiles,
        action: '为其中一个服务重命名，使用项目前缀如 "project-service" 或为服务添加命名空间'
      });
    }

    return suggestions.sort((a, b) => a.priority - b.priority);
  }

  private generatePortFixAction(conflict: PortConflict): string {
    const basePort = Math.floor(conflict.port / 100) * 100;
    const suggestions: string[] = [];

    for (let i = 1; i < conflict.services.length; i++) {
      const newPort = basePort + (i * 10) + (conflict.port % 10);
      suggestions.push(`${conflict.services[i].name}: ${conflict.port} → ${newPort}`);
    }

    return `建议修改端口映射: ${suggestions.join('; ')}`;
  }

  private shortenPath(filePath: string): string {
    const parts = filePath.split('/');
    if (parts.length <= 3) return filePath;
    return `.../${parts.slice(-2).join('/')}`;
  }

  getExitCode(result: DetectionResult, strict: boolean): number {
    if (result.parseErrors.some(e => e.severity === 'error')) {
      return 2;
    }

    if (strict) {
      if (result.portConflicts.length > 0 || result.serviceNameConflicts.length > 0) {
        return 1;
      }
    } else {
      if (result.portConflicts.some(c => c.severity === 'high')) {
        return 1;
      }
    }

    return 0;
  }
}