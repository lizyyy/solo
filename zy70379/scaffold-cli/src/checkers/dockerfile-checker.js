const fs = require('fs');
const path = require('path');
const BaseChecker = require('./base-checker');

class DockerfileChecker extends BaseChecker {
  check() {
    const issues = [];
    const dockerfilePath = path.join(this.projectPath, 'Dockerfile');

    if (!fs.existsSync(dockerfilePath)) {
      issues.push(this.createIssue(
        'required-files',
        'Dockerfile 不存在',
        { missingFile: 'Dockerfile' }
      ));
      return issues;
    }

    const content = fs.readFileSync(dockerfilePath, 'utf-8');
    const lines = content.split('\n');

    issues.push(...this.checkBaseImage(lines));
    issues.push(...this.checkUser(content));
    issues.push(...this.checkWorkdir(lines));
    issues.push(...this.checkExposePort(lines));
    issues.push(...this.checkHealthcheck(lines));

    return issues;
  }

  checkBaseImage(lines) {
    const issues = [];
    const expectedBase = this.template.dockerfile?.baseImage;
    if (!expectedBase) return issues;

    const fromLine = lines.find(line => line.trim().startsWith('FROM '));
    if (!fromLine) {
      issues.push(this.createIssue(
        'dockerfile',
        'Dockerfile 中未找到 FROM 指令',
        { expected: expectedBase, actual: null }
      ));
      return issues;
    }

    const actualBase = fromLine.trim().replace(/^FROM\s+/, '').split(/\s+/)[0];
    const normalizedActual = actualBase.replace(/^docker\.io\/library\//, '');
    const normalizedExpected = expectedBase.replace(/^docker\.io\/library\//, '');

    if (normalizedActual !== normalizedExpected) {
      issues.push(this.createIssue(
        'dockerfile',
        `基础镜像不一致，期望 ${expectedBase}，实际 ${actualBase}`,
        { expected: expectedBase, actual: actualBase }
      ));
    }

    return issues;
  }

  checkUser(content) {
    const issues = [];
    const expectedUser = this.template.dockerfile?.user;
    if (!expectedUser) return issues;

    const userMatch = content.match(/^USER\s+(\w+)/m);
    if (!userMatch) {
      issues.push(this.createIssue(
        'dockerfile',
        'Dockerfile 中未使用 USER 指令，存在安全风险',
        { expected: expectedUser, actual: null }
      ));
      return issues;
    }

    if (userMatch[1] !== expectedUser) {
      issues.push(this.createIssue(
        'dockerfile',
        `运行用户不一致，期望 ${expectedUser}，实际 ${userMatch[1]}`,
        { expected: expectedUser, actual: userMatch[1] }
      ));
    }

    return issues;
  }

  checkWorkdir(lines) {
    const issues = [];
    const expectedWorkdir = this.template.dockerfile?.workdir;
    if (!expectedWorkdir) return issues;

    const workdirLine = lines.find(line => line.trim().startsWith('WORKDIR '));
    if (!workdirLine) {
      issues.push(this.createIssue(
        'dockerfile',
        'Dockerfile 中未设置 WORKDIR',
        { expected: expectedWorkdir, actual: null }
      ));
      return issues;
    }

    const actualWorkdir = workdirLine.trim().replace(/^WORKDIR\s+/, '');
    if (actualWorkdir !== expectedWorkdir) {
      issues.push(this.createIssue(
        'dockerfile',
        `工作目录不一致，期望 ${expectedWorkdir}，实际 ${actualWorkdir}`,
        { expected: expectedWorkdir, actual: actualWorkdir }
      ));
    }

    return issues;
  }

  checkExposePort(lines) {
    const issues = [];
    const expectedPort = this.template.dockerfile?.exposePort;
    if (!expectedPort) return issues;

    const exposeLines = lines.filter(line => line.trim().startsWith('EXPOSE '));
    if (exposeLines.length === 0) {
      issues.push(this.createIssue(
        'dockerfile',
        'Dockerfile 中未声明 EXPOSE 端口',
        { expected: expectedPort, actual: null }
      ));
      return issues;
    }

    const exposedPorts = exposeLines.map(line => {
      const parts = line.trim().replace(/^EXPOSE\s+/, '').split(/\s+/);
      return parts.map(p => parseInt(p)).filter(p => !isNaN(p));
    }).flat();

    if (!exposedPorts.includes(expectedPort)) {
      issues.push(this.createIssue(
        'dockerfile',
        `暴露端口不一致，期望 ${expectedPort}，实际 ${exposedPorts.join(', ')}`,
        { expected: expectedPort, actual: exposedPorts.join(', ') }
      ));
    }

    return issues;
  }

  checkHealthcheck(lines) {
    const issues = [];
    const expectedHealthcheck = this.template.dockerfile?.healthcheck;
    if (!expectedHealthcheck) return issues;

    const healthcheckLine = lines.find(line => line.trim().startsWith('HEALTHCHECK '));
    if (!healthcheckLine) {
      issues.push(this.createIssue(
        'healthcheck',
        'Dockerfile 中未配置 HEALTHCHECK',
        { expected: expectedHealthcheck, actual: null }
      ));
      return issues;
    }

    const intervalMatch = healthcheckLine.match(/--interval=([\w]+)/);
    const timeoutMatch = healthcheckLine.match(/--timeout=([\w]+)/);
    const retriesMatch = healthcheckLine.match(/--retries=(\d+)/);
    const startPeriodMatch = healthcheckLine.match(/--start-period=([\w]+)/);

    if (expectedHealthcheck.interval && intervalMatch && intervalMatch[1] !== expectedHealthcheck.interval) {
      issues.push(this.createIssue(
        'healthcheck',
        `健康检查间隔不一致，期望 ${expectedHealthcheck.interval}，实际 ${intervalMatch[1]}`,
        {
          configKey: 'interval',
          expected: expectedHealthcheck.interval,
          actual: intervalMatch[1]
        }
      ));
    }

    if (expectedHealthcheck.timeout && timeoutMatch && timeoutMatch[1] !== expectedHealthcheck.timeout) {
      issues.push(this.createIssue(
        'healthcheck',
        `健康检查超时不一致，期望 ${expectedHealthcheck.timeout}，实际 ${timeoutMatch[1]}`,
        {
          configKey: 'timeout',
          expected: expectedHealthcheck.timeout,
          actual: timeoutMatch[1]
        }
      ));
    }

    if (expectedHealthcheck.retries && retriesMatch && parseInt(retriesMatch[1]) !== expectedHealthcheck.retries) {
      issues.push(this.createIssue(
        'healthcheck',
        `健康检查重试次数不一致，期望 ${expectedHealthcheck.retries}，实际 ${retriesMatch[1]}`,
        {
          configKey: 'retries',
          expected: expectedHealthcheck.retries,
          actual: retriesMatch[1]
        }
      ));
    }

    return issues;
  }
}

module.exports = DockerfileChecker;
