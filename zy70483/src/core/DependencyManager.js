const chalk = require('chalk');
const Table = require('cli-table3');

class DependencyManager {
  constructor() {
    this.services = this.getDefaultServices();
  }

  getDefaultServices() {
    return {
      'database': { dependencies: [], name: '数据库服务' },
      'redis': { dependencies: [], name: 'Redis缓存' },
      'config': { dependencies: ['database'], name: '配置中心' },
      'auth': { dependencies: ['database', 'redis'], name: '认证服务' },
      'api-gateway': { dependencies: ['auth', 'config'], name: 'API网关' },
      'user-service': { dependencies: ['auth', 'database'], name: '用户服务' },
      'order-service': { dependencies: ['user-service', 'database'], name: '订单服务' },
      'payment-service': { dependencies: ['order-service', 'database'], name: '支付服务' },
      'notification': { dependencies: ['api-gateway'], name: '通知服务' },
      'web-app': { dependencies: ['api-gateway', 'notification'], name: 'Web应用' }
    };
  }

  calculateStartOrder(specificServices = null) {
    const services = specificServices 
      ? this.filterServices(specificServices)
      : this.services;
    
    const inDegree = {};
    const graph = {};
    
    Object.keys(services).forEach(service => {
      inDegree[service] = 0;
      graph[service] = [];
    });

    Object.entries(services).forEach(([service, config]) => {
      config.dependencies.forEach(dep => {
        if (services[dep]) {
          graph[dep].push(service);
          inDegree[service]++;
        }
      });
    });

    const cycleResult = this.detectCycle(services);
    if (cycleResult.hasCycle) {
      return {
        success: false,
        hasCycle: true,
        cyclePath: cycleResult.path,
        message: '检测到循环依赖'
      };
    }

    const queue = [];
    const order = [];

    Object.keys(inDegree).forEach(service => {
      if (inDegree[service] === 0) {
        queue.push(service);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift();
      order.push(current);

      graph[current].forEach(next => {
        inDegree[next]--;
        if (inDegree[next] === 0) {
          queue.push(next);
        }
      });
    }

    return {
      success: true,
      hasCycle: false,
      order: order,
      services: services,
      message: '启动顺序计算完成'
    };
  }

  detectCycle(services) {
    const visited = new Set();
    const recStack = new Set();
    const path = [];

    const dfs = (service, currentPath) => {
      if (recStack.has(service)) {
        const cycleStart = currentPath.indexOf(service);
        return { hasCycle: true, path: [...currentPath.slice(cycleStart), service] };
      }
      
      if (visited.has(service)) {
        return { hasCycle: false };
      }

      visited.add(service);
      recStack.add(service);
      currentPath.push(service);

      for (const dep of services[service]?.dependencies || []) {
        if (services[dep]) {
          const result = dfs(dep, currentPath);
          if (result.hasCycle) {
            return result;
          }
        }
      }

      recStack.delete(service);
      currentPath.pop();
      return { hasCycle: false };
    };

    for (const service of Object.keys(services)) {
      if (!visited.has(service)) {
        const result = dfs(service, path);
        if (result.hasCycle) {
          return result;
        }
      }
    }

    return { hasCycle: false, path: [] };
  }

  filterServices(serviceList) {
    const result = {};
    serviceList.forEach(name => {
      if (this.services[name]) {
        result[name] = this.services[name];
      }
    });
    return result;
  }

  printResult(result) {
    if (!result.success) {
      console.log(chalk.red('❌ 计算失败:'), result.message);
      if (result.hasCycle) {
        console.log(chalk.yellow('\n🔄 循环依赖链路:'));
        console.log(chalk.red(result.cyclePath.join(' → ')));
      }
      return;
    }

    console.log(chalk.green('✅ 启动顺序计算完成\n'));
    
    const table = new Table({
      head: ['顺序', '服务名称', '服务说明', '依赖列表'],
      colWidths: [8, 20, 20, 30]
    });

    result.order.forEach((service, index) => {
      const config = result.services[service];
      table.push([
        index + 1,
        service,
        config.name,
        config.dependencies.join(', ') || '无'
      ]);
    });

    console.log(table.toString());
  }
}

module.exports = DependencyManager;
