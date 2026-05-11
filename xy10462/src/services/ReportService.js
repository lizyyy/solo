const chalk = require('chalk');

class ReportService {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }

  formatPrice(price) {
    return `¥${price.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
  }

  formatPercent(value) {
    return `${value.toFixed(2)}%`;
  }

  generateVehicleDetail(vehicle) {
    const totalCost = vehicle.getTotalCost();
    const preparationCost = vehicle.getTotalPreparationCost();
    const currentPrice = vehicle.getCurrentSellingPrice();
    const originalPrice = vehicle.getOriginalSellingPrice();
    const profit = vehicle.getProfit();
    const originalProfit = vehicle.getOriginalProfit();
    const issues = vehicle.getIssues();

    let output = '';
    output += chalk.bold.cyan(`\n${'━'.repeat(60)}\n`);
    output += chalk.bold.white(`车辆详情: ${vehicle.displayName}\n`);
    output += chalk.gray(`${'━'.repeat(60)}\n\n`);

    output += chalk.bold('基本信息:\n');
    output += `  VIN: ${vehicle.vin}\n`;
    output += `  车牌号: ${vehicle.plateNumber || 'N/A'}\n`;
    output += `  里程: ${vehicle.mileage ? vehicle.mileage.toLocaleString() + ' km' : 'N/A'}\n`;
    output += `  状态: ${this.formatStatus(vehicle.status)}\n\n`;

    output += chalk.bold('成本明细:\n');
    output += `  收车价: ${chalk.yellow(this.formatPrice(vehicle.purchasePrice))}\n`;
    output += `  整备费用: ${chalk.yellow(this.formatPrice(preparationCost))}\n`;
    output += `  总成本: ${chalk.red.bold(this.formatPrice(totalCost))}\n\n`;

    if (vehicle.costs.length > 0) {
      output += chalk.bold('费用明细:\n');
      output += this.formatCosts(vehicle.costs);
    }

    if (vehicle.preparationItems.length > 0) {
      output += chalk.bold('\n整备项目:\n');
      output += this.formatPreparationItems(vehicle.preparationItems);
    }

    output += chalk.bold('\n售价与毛利:\n');
    output += `  原始售价: ${this.formatPrice(originalPrice)}\n`;
    if (vehicle.priceAdjustments.length > 0) {
      output += `  调整后售价: ${chalk.green.bold(this.formatPrice(currentPrice))}\n`;
      const priceDiff = currentPrice - originalPrice;
      output += `  售价调整: ${priceDiff >= 0 ? chalk.green('+' + this.formatPrice(priceDiff)) : chalk.red(this.formatPrice(priceDiff))}\n`;
      output += `  原始毛利: ${this.formatProfit(originalProfit)}\n`;
      output += `  调整后毛利: ${chalk.bold(this.formatProfit(profit))}\n`;
      const profitChange = profit - originalProfit;
      output += `  毛利变化: ${profitChange >= 0 ? chalk.green('+' + this.formatPrice(profitChange)) : chalk.red(this.formatPrice(profitChange))}\n`;
    } else {
      output += `  当前售价: ${this.formatPrice(currentPrice)}\n`;
      output += `  毛利: ${this.formatProfit(profit)}\n`;
    }
    output += `  毛利率: ${this.formatPercent(vehicle.getProfitMargin())}\n`;

    if (issues.length > 0) {
      output += chalk.bold.red('\n⚠ 存在问题:\n');
      issues.forEach(issue => {
        const prefix = issue.severity === 'error' ? chalk.red('✗') : chalk.yellow('!');
        output += `  ${prefix} ${issue.message}\n`;
      });
    }

    if (vehicle.priceAdjustments.length > 0) {
      output += chalk.bold.magenta('\n📝 售价调整历史:\n');
      vehicle.priceAdjustments.forEach((adj, index) => {
        const diff = adj.newPrice - adj.oldPrice;
        output += `  [${index + 1}] ${new Date(adj.createdAt).toLocaleDateString()}\n`;
        output += `      ${this.formatPrice(adj.oldPrice)} → ${this.formatPrice(adj.newPrice)}`;
        output += ` (${diff >= 0 ? '+' : ''}${this.formatPrice(diff)})\n`;
        output += `      原因: ${adj.reason}\n`;
      });
    }

    return output;
  }

  generateProfitRanking(ascending = false) {
    const vehicles = this.dataStore.getVehiclesSortedByProfit(ascending);

    let output = '';
    output += chalk.bold.cyan(`\n${'━'.repeat(70)}\n`);
    output += chalk.bold.white(`利润排序 (${ascending ? '低到高' : '高到低'})\n`);
    output += chalk.gray(`${'━'.repeat(70)}\n\n`);

    const header = `${chalk.bold('排名')}  ${chalk.bold('车辆').padEnd(20)} ${chalk.bold('总成本').padEnd(15)} ${chalk.bold('售价').padEnd(15)} ${chalk.bold('毛利').padEnd(15)} ${chalk.bold('毛利率')}`;
    output += header + '\n';
    output += chalk.gray('-'.repeat(70)) + '\n';

    vehicles.forEach((vehicle, index) => {
      const rank = (index + 1).toString().padStart(3);
      const name = vehicle.displayName.substring(0, 18).padEnd(20);
      const totalCost = this.formatPrice(vehicle.getTotalCost()).padEnd(15);
      const price = this.formatPrice(vehicle.getCurrentSellingPrice()).padEnd(15);
      const profit = this.formatProfit(vehicle.getProfit()).padEnd(15);
      const margin = this.formatPercent(vehicle.getProfitMargin()).padStart(8);

      output += `${rank}  ${name} ${totalCost} ${price} ${profit} ${margin}\n`;
    });

    const stats = this.dataStore.getStatistics();
    output += chalk.gray('-'.repeat(70)) + '\n';
    output += `\n${chalk.bold('汇总:')}\n`;
    output += `  总车辆数: ${stats.totalVehicles}\n`;
    output += `  总成本: ${this.formatPrice(stats.totalCost)}\n`;
    output += `  总预期收入: ${this.formatPrice(stats.totalExpectedRevenue)}\n`;
    output += `  总毛利: ${this.formatProfit(stats.totalProfit)}\n`;
    output += `  平均毛利率: ${this.formatPercent(stats.profitMargin)}\n`;

    return output;
  }

  generateIssuesReport() {
    const vehicles = this.dataStore.getVehiclesWithIssues();
    const stats = this.dataStore.getStatistics();

    let output = '';
    output += chalk.bold.cyan(`\n${'━'.repeat(70)}\n`);
    output += chalk.bold.white(`待处理问题报告\n`);
    output += chalk.gray(`${'━'.repeat(70)}\n\n`);

    output += `问题车辆数: ${chalk.yellow.bold(vehicles.length)} / ${stats.totalVehicles}\n\n`;

    if (vehicles.length === 0) {
      output += chalk.green('✓ 所有车辆状态良好，没有待处理问题。\n');
      return output;
    }

    const issuesByType = {
      DUPLICATE_ITEM: [],
      PRICE_BELOW_COST: [],
      UNFINISHED_PREPARATION: []
    };

    vehicles.forEach(vehicle => {
      vehicle.getIssues().forEach(issue => {
        if (issuesByType[issue.type]) {
          issuesByType[issue.type].push({ vehicle, issue });
        }
      });
    });

    if (issuesByType.DUPLICATE_ITEM.length > 0) {
      output += chalk.yellow.bold('\n⚠ 重复整备项目:\n');
      issuesByType.DUPLICATE_ITEM.forEach(({ vehicle, issue }) => {
        output += `  ${vehicle.displayName} - ${issue.message}\n`;
      });
    }

    if (issuesByType.PRICE_BELOW_COST.length > 0) {
      output += chalk.red.bold('\n✗ 售价低于成本:\n');
      issuesByType.PRICE_BELOW_COST.forEach(({ vehicle, issue }) => {
        output += `  ${vehicle.displayName} - ${issue.message}\n`;
      });
    }

    if (issuesByType.UNFINISHED_PREPARATION.length > 0) {
      output += chalk.yellow.bold('\n⚠ 未完成整备却待售:\n');
      issuesByType.UNFINISHED_PREPARATION.forEach(({ vehicle, issue }) => {
        output += `  ${vehicle.displayName} - ${issue.message}\n`;
      });
    }

    return output;
  }

  generateFullReport() {
    let output = '';
    output += this.generateSummary();
    output += this.generateProfitRanking();
    output += this.generateIssuesReport();

    return output;
  }

  generateSummary() {
    const stats = this.dataStore.getStatistics();

    let output = '';
    output += chalk.bold.cyan(`\n${'━'.repeat(70)}\n`);
    output += chalk.bold.white('📊 二手车整备费用汇总报告\n');
    output += chalk.gray(`${'━'.repeat(70)}\n\n`);

    output += chalk.bold('车辆统计:\n');
    output += `  总车辆数: ${stats.totalVehicles}\n`;
    output += `  整备中: ${stats.vehiclesInPreparation} 台\n`;
    output += `  待售: ${stats.vehiclesForSale} 台\n`;
    output += `  有问题车辆: ${chalk.yellow(stats.vehiclesWithIssues)} 台\n\n`;

    output += chalk.bold('财务汇总:\n');
    output += `  收车总成本: ${this.formatPrice(stats.totalPurchaseCost)}\n`;
    output += `  整备总费用: ${this.formatPrice(stats.totalPreparationCost)}\n`;
    output += `  总成本: ${chalk.red.bold(this.formatPrice(stats.totalCost))}\n`;
    output += `  预期总收入: ${this.formatPrice(stats.totalExpectedRevenue)}\n`;
    output += `  总毛利: ${chalk.green.bold(this.formatPrice(stats.totalProfit))}\n`;
    output += `  综合毛利率: ${this.formatPercent(stats.profitMargin)}\n`;

    return output;
  }

  formatStatus(status) {
    const statusMap = {
      'in_preparation': chalk.yellow('整备中'),
      'for_sale': chalk.green('待售'),
      'sold': chalk.gray('已售出')
    };
    return statusMap[status] || status;
  }

  formatProfit(profit) {
    if (profit > 0) {
      return chalk.green(this.formatPrice(profit));
    } else if (profit < 0) {
      return chalk.red(this.formatPrice(profit));
    }
    return this.formatPrice(profit);
  }

  formatCosts(costs) {
    let output = '';
    costs.forEach((cost, index) => {
      output += `  [${index + 1}] ${cost.category || '未分类'} - ${cost.description || ''}\n`;
      output += `      配件: ${this.formatPrice(cost.partsCost)}`;
      output += `  工时: ${this.formatPrice(cost.laborCost)}`;
      if (cost.laborHours > 0) {
        output += ` (${cost.laborHours}h)`;
      }
      output += `  小计: ${this.formatPrice(cost.getTotal())}\n`;
    });
    return output;
  }

  formatPreparationItems(items) {
    let output = '';
    items.forEach((item, index) => {
      const status = item.status === 'completed' ? chalk.green('✓') : chalk.yellow('○');
      output += `  ${status} ${item.type}`;
      if (item.description) {
        output += ` - ${item.description}`;
      }
      output += `\n`;
    });
    return output;
  }
}

module.exports = ReportService;
