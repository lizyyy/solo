#!/usr/bin/env node

import chalk from 'chalk';
import { HexTerritorySimulator } from './hexSimulator.js';
import { Unit, TerrainRule, TerrainHex } from './types.js';
import * as readline from 'readline';

const sim = new HexTerritorySimulator();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function showMenu() {
  console.log(chalk.cyan.bold('\n╔══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║               🎮 六边形领地推演系统                          ║'));
  console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.yellow('  1. 📊 导入单位表'));
  console.log(chalk.yellow('  2. 🗺️  导入地形规则'));
  console.log(chalk.yellow('  3. 📍 设置地形地图'));
  console.log(chalk.yellow('  4. 🎲 运行推演'));
  console.log(chalk.yellow('  5. 🔍 验证数据'));
  console.log(chalk.yellow('  6. 📋 查看变更记录'));
  console.log(chalk.yellow('  7. 📜 查看战报历史'));
  console.log(chalk.yellow('  8. 🎬 运行完整演示'));
  console.log(chalk.yellow('  0. ❌ 退出'));
  console.log('');
}

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function handleImportUnits() {
  console.log(chalk.blue('\n📊 导入单位表（演示数据）...'));
  
  const units: Unit[] = [
    {
      id: 'RED_INF_001',
      name: '赤焰步兵营',
      type: 'infantry',
      attack: 100,
      defense: 80,
      speed: 3,
      hp: 500,
      position: { q: 0, r: 0 },
      owner: 'RED',
      initiative: 50
    },
    {
      id: 'RED_CAV_001',
      name: '烈焰骑兵团',
      type: 'cavalry',
      attack: 150,
      defense: 60,
      speed: 6,
      hp: 400,
      position: { q: 1, r: 0 },
      owner: 'RED',
      initiative: 70
    },
    {
      id: 'BLUE_ARCH_001',
      name: '蓝羽弓兵营',
      type: 'archer',
      attack: 120,
      defense: 40,
      speed: 3,
      hp: 300,
      position: { q: 2, r: 1 },
      owner: 'BLUE',
      initiative: 55
    }
  ];

  const result = sim.importUnits(units, '数值策划');
  console.log(chalk.green(`✅ 成功导入 ${result.success} 个单位`));
  
  if (result.errors.length > 0) {
    console.log(sim.formatErrors(result.errors));
  }
}

async function handleImportTerrainRules() {
  console.log(chalk.blue('\n🗺️  导入地形规则（演示数据）...'));
  
  const rules: TerrainRule[] = [
    {
      id: 'PLAIN_001',
      name: '开阔平原',
      terrainType: 'plain',
      movementCost: 1,
      defenseBonus: 0,
      attackPenalty: 0,
      description: '平坦开阔的平原，无特殊效果'
    },
    {
      id: 'FOREST_001',
      name: '密林地带',
      terrainType: 'forest',
      movementCost: 2,
      defenseBonus: 20,
      attackPenalty: 10,
      description: '茂密森林，防御加成但攻击减弱'
    },
    {
      id: 'MOUNTAIN_001',
      name: '险峻山地',
      terrainType: 'mountain',
      movementCost: 3,
      defenseBonus: 30,
      attackPenalty: 15,
      description: '崎岖山地，大幅提升防御但移动困难'
    }
  ];

  const result = sim.importTerrainRules(rules, '关卡策划');
  console.log(chalk.green(`✅ 成功导入 ${result.success} 条地形规则`));
  
  if (result.errors.length > 0) {
    console.log(sim.formatErrors(result.errors));
  }
}

async function handleSetTerrainMap() {
  console.log(chalk.blue('\n📍 设置地形地图（演示数据）...'));
  
  const hexes: TerrainHex[] = [
    { coord: { q: 0, r: 0 }, terrainType: 'plain' },
    { coord: { q: 1, r: 0 }, terrainType: 'forest' },
    { coord: { q: 2, r: 1 }, terrainType: 'mountain' }
  ];

  const result = sim.setTerrainMap(hexes, '关卡策划');
  console.log(chalk.green(`✅ 成功设置 ${result.success} 个地形坐标`));
  
  if (result.errors.length > 0) {
    console.log(sim.formatErrors(result.errors));
  }
}

async function handleRunSimulation() {
  console.log(chalk.blue('\n🎲 运行推演...'));
  
  const reportId = await prompt('请输入战报编号: ') || 'BATTLE_001';
  const result = sim.runSimulation(reportId, '系统');

  if (result.warnings && result.warnings.length > 0) {
    console.log(sim.formatWarnings(result.warnings));
  }

  if (!result.success && result.errors) {
    console.log(sim.formatErrors(result.errors));
    console.log(sim.getNextSteps(result.errors));
    return;
  }

  if (result.success && result.turnOrder) {
    console.log(chalk.green('\n✅ 推演成功！\n'));
    console.log(chalk.blue('📋 回合顺序：'));
    result.turnOrder.forEach((item) => {
      const sourceText = item.source === 'terrain_bonus' ? '（含地形加成）' : '';
      console.log(chalk.white(`   ${item.phase}. ${item.unitName} - 先手值: ${item.initiative} ${sourceText}`));
    });
  }
}

async function handleValidate() {
  console.log(chalk.blue('\n🔍 验证数据...'));
  
  const { errors, warnings } = sim.validateAll();
  
  console.log(sim.errorPresenter.formatValidationSummary(errors, warnings));
  
  if (errors.length > 0) {
    console.log(sim.formatErrors(errors));
    console.log(sim.getNextSteps(errors));
  }
  
  if (warnings.length > 0) {
    console.log(sim.formatWarnings(warnings));
  }
}

async function handleChangeLog() {
  console.log(chalk.blue('\n📋 变更记录：'));
  console.log(chalk.cyan(sim.getChangeSummary()));
  
  const analysis = sim.changeAuditor.analyzeChanges();
  
  if (analysis.materialOnlyChanges.length > 0) {
    console.log(chalk.gray('\n📝 补充材料的变更（不影响结论）：'));
    analysis.materialOnlyChanges.forEach((change, i) => {
      console.log(chalk.gray(`   ${i + 1}. ${change.description}`));
    });
  }
  
  if (analysis.conclusionChanges.length > 0) {
    console.log(chalk.yellow('\n⚠️  影响结论的变更：'));
    analysis.conclusionChanges.forEach((change, i) => {
      console.log(chalk.yellow(`   ${i + 1}. ${change.description} - ${change.author}`));
    });
  }
}

async function handleReportHistory() {
  const reports = sim.battleManager.getAllReports();
  
  if (reports.length === 0) {
    console.log(chalk.yellow('\n⚠️  还没有战报记录'));
    return;
  }
  
  console.log(chalk.blue('\n📜 战报列表：'));
  reports.forEach((report, i) => {
    console.log(chalk.white(`   ${i + 1}. ${report.id} - ${report.title}`));
  });
  
  const reportId = await prompt('\n请输入要查看历史的战报编号: ');
  if (reportId) {
    console.log(sim.getReportHistory(reportId));
  }
}

async function handleDemo() {
  rl.close();
  await import('./demo.js');
}

async function main() {
  while (true) {
    showMenu();
    const choice = await prompt(chalk.green('请选择操作: '));

    switch (choice.trim()) {
      case '1':
        await handleImportUnits();
        break;
      case '2':
        await handleImportTerrainRules();
        break;
      case '3':
        await handleSetTerrainMap();
        break;
      case '4':
        await handleRunSimulation();
        break;
      case '5':
        await handleValidate();
        break;
      case '6':
        await handleChangeLog();
        break;
      case '7':
        await handleReportHistory();
        break;
      case '8':
        await handleDemo();
        process.exit(0);
        break;
      case '0':
        console.log(chalk.cyan('\n👋 再见！'));
        rl.close();
        process.exit(0);
      default:
        console.log(chalk.red('\n❌ 无效的选择，请重试'));
    }
  }
}

main().catch(console.error);
