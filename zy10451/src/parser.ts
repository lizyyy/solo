import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ComposeFile, ComposeService, PortMapping, ParseError } from './types';

export class ComposeParser {
  private parseErrors: ParseError[] = [];

  parseFile(filePath: string): ComposeFile {
    const absolutePath = path.resolve(filePath);
    this.parseErrors = [];

    try {
      const content = fs.readFileSync(absolutePath, 'utf8');
      const lines = content.split('\n');
      const doc = yaml.load(content, {
        filename: absolutePath,
        onWarning: (warning) => {
          this.parseErrors.push({
            file: absolutePath,
            line: (warning as any).mark?.line,
            message: warning.message,
            severity: 'warning'
          });
        }
      }) as any;

      if (!doc || typeof doc !== 'object') {
        this.parseErrors.push({
          file: absolutePath,
          message: '无效的YAML格式或空文件',
          severity: 'error'
        });
        return { path: absolutePath, services: [], parseErrors: this.parseErrors };
      }

      const services = this.parseServices(doc, absolutePath, lines);
      return { path: absolutePath, services, parseErrors: this.parseErrors };
    } catch (error: any) {
      this.parseErrors.push({
        file: absolutePath,
        line: error.mark?.line,
        message: error.message || '无法解析YAML文件',
        severity: 'error'
      });
      return { path: absolutePath, services: [], parseErrors: this.parseErrors };
    }
  }

  private parseServices(doc: any, filePath: string, lines: string[]): ComposeService[] {
    const services: ComposeService[] = [];
    const servicesSection = doc.services || doc;

    if (!servicesSection || typeof servicesSection !== 'object') {
      return services;
    }

    for (const [serviceName, serviceConfig] of Object.entries(servicesSection)) {
      if (typeof serviceConfig !== 'object' || serviceConfig === null) {
        continue;
      }

      const lineNumber = this.findServiceLineNumber(lines, serviceName);
      const config = serviceConfig as any;

      const service: ComposeService = {
        name: serviceName,
        image: config.image,
        ports: [],
        environment: {},
        file: filePath,
        line: lineNumber
      };

      if (config.ports) {
        service.ports = this.parsePorts(config.ports, filePath, serviceName);
      }

      if (config.environment) {
        service.environment = this.parseEnvironment(config.environment);
      }

      services.push(service);
    }

    return services;
  }

  private findServiceLineNumber(lines: string[], serviceName: string): number | undefined {
    const searchPattern = `^\\s*['"]?${serviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?\\s*:`;
    const regex = new RegExp(searchPattern);

    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        return i + 1;
      }
    }
    return undefined;
  }

  private parsePorts(portsConfig: any, filePath: string, serviceName: string): PortMapping[] {
    const ports: PortMapping[] = [];

    if (!Array.isArray(portsConfig)) {
      this.parseErrors.push({
        file: filePath,
        message: `服务 "${serviceName}" 的 ports 配置必须是数组`,
        severity: 'warning'
      });
      return ports;
    }

    for (const portEntry of portsConfig) {
      try {
        const mapping = this.parsePortEntry(portEntry);
        if (mapping) {
          ports.push(mapping);
        }
      } catch (error: any) {
        this.parseErrors.push({
          file: filePath,
          message: `服务 "${serviceName}" 的端口配置无效: "${portEntry}" - ${error.message}`,
          severity: 'warning'
        });
      }
    }

    return ports;
  }

  private parsePortEntry(entry: any): PortMapping | null {
    if (typeof entry === 'number') {
      return {
        hostPort: entry,
        containerPort: entry,
        raw: String(entry)
      };
    }

    if (typeof entry === 'string') {
      return this.parsePortString(entry);
    }

    if (typeof entry === 'object' && entry !== null) {
      return this.parsePortObject(entry);
    }

    throw new Error('不支持的端口格式');
  }

  private parsePortString(portStr: string): PortMapping {
    const parts = portStr.split('/');
    const portPart = parts[0];
    const protocol = parts[1] || 'tcp';

    const hostMatch = portPart.match(/^(?:([\d.]+):)?(\d+)(?::(\d+))?$/);
    if (!hostMatch) {
      const singlePort = parseInt(portPart, 10);
      if (isNaN(singlePort)) {
        throw new Error(`无效的端口格式: ${portStr}`);
      }
      return {
        hostPort: singlePort,
        containerPort: singlePort,
        protocol,
        raw: portStr
      };
    }

    const [, hostIp, port1, port2] = hostMatch;
    const hostPort = parseInt(port1, 10);
    const containerPort = port2 ? parseInt(port2, 10) : hostPort;

    return {
      hostPort,
      containerPort,
      protocol,
      hostIp: hostIp || undefined,
      raw: portStr
    };
  }

  private parsePortObject(portObj: any): PortMapping {
    const target = portObj.target || portObj.containerPort;
    const published = portObj.published || portObj.hostPort || target;
    const hostIp = portObj.host_ip || portObj.hostIp;
    const protocol = portObj.protocol;

    if (!published || !target) {
      throw new Error('端口对象缺少必要字段');
    }

    return {
      hostPort: Number(published),
      containerPort: Number(target),
      protocol,
      hostIp,
      raw: JSON.stringify(portObj)
    };
  }

  private parseEnvironment(envConfig: any): Record<string, string | number | boolean | null> {
    const environment: Record<string, string | number | boolean | null> = {};

    if (Array.isArray(envConfig)) {
      for (const env of envConfig) {
        if (typeof env === 'string') {
          const eqIndex = env.indexOf('=');
          if (eqIndex > 0) {
            const key = env.substring(0, eqIndex);
            const value = env.substring(eqIndex + 1);
            environment[key] = this.expandEnvVars(value);
          } else {
            environment[env] = process.env[env] || null;
          }
        }
      }
    } else if (typeof envConfig === 'object') {
      for (const [key, value] of Object.entries(envConfig)) {
        if (typeof value === 'string') {
          environment[key] = this.expandEnvVars(value);
        } else {
          environment[key] = value as any;
        }
      }
    }

    return environment;
  }

  private expandEnvVars(value: string): string {
    return value.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (match, varName) => {
      return process.env[varName] || match;
    });
  }

  findComposeFiles(paths: string[]): string[] {
    const composeFiles: string[] = [];
    const composePatterns = [
      'docker-compose.yml',
      'docker-compose.yaml',
      'compose.yml',
      'compose.yaml'
    ];

    for (const inputPath of paths) {
      const resolvedPath = path.resolve(inputPath);

      if (!fs.existsSync(resolvedPath)) {
        continue;
      }

      const stat = fs.statSync(resolvedPath);

      if (stat.isFile()) {
        const fileName = path.basename(resolvedPath);
        if (composePatterns.some(p => fileName.toLowerCase() === p.toLowerCase())) {
          composeFiles.push(resolvedPath);
        }
      } else if (stat.isDirectory()) {
        for (const pattern of composePatterns) {
          const filePath = path.join(resolvedPath, pattern);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            composeFiles.push(filePath);
          }
        }
        const subdirs = fs.readdirSync(resolvedPath);
        for (const subdir of subdirs) {
          const subPath = path.join(resolvedPath, subdir);
          if (fs.statSync(subPath).isDirectory()) {
            composeFiles.push(...this.findComposeFiles([subPath]));
          }
        }
      }
    }

    return [...new Set(composeFiles)];
  }
}