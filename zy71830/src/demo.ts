import chalk from 'chalk';
import { HexTerritorySimulator } from './hexSimulator.js';
import { Unit, TerrainRule, TerrainHex } from './types.js';

async function runDemo() {
  console.log(chalk.cyan.bold('\n╔══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║           🎮 六边形领地推演系统 - 完整演示                   ║'));
  console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════════════════╝\n'));

  const sim = new HexTerritorySimulator();

  console.log(chalk.yellow.bold('━━━━━━━━━━ 场景1: 单位表先到，地形规则还没补 ━━━━━━━━━━'));
  console.log(chalk.gray('先导入单位表，地形规则稍后补上...\n'));

  const initialUnits: Unit[] = [
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

  const unitResult = sim.importUnits(initialUnits, '数值策划');
  console.log(chalk.green(`✅ 导入了 ${unitResult.success} 个单位\n`));

  console.log(chalk.blue('尝试运行推演...\n'));
  const firstResult = sim.runSimulation('BATTLE_001', '系统');

  if (!firstResult.success && firstResult.errors) {
    console.log(sim.formatErrors(firstResult.errors));
    console.log(sim.getNextSteps(firstResult.errors));
  }

  console.log(chalk.yellow.bold('\n━━━━━━━━━━ 场景2: 补上地形规则，区分补材料 vs 改结论 ━━━━━━━━━━'));
  console.log(chalk.gray('现在补上地形规则，看看哪些改变会影响结论...\n'));

  const terrainRules: TerrainRule[] = [
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

  const terrainResult = sim.importTerrainRules(terrainRules, '关卡策划');
  console.log(chalk.green(`✅ 导入了 ${terrainResult.success} 条地形规则`));

  const terrainMap: TerrainHex[] = [
    { coord: { q: 0, r: 0 }, terrainType: 'plain' },
    { coord: { q: 1, r: 0 }, terrainType: 'forest' },
    { coord: { q: 2, r: 1 }, terrainType: 'mountain' }
  ];

  const mapResult = sim.setTerrainMap(terrainMap, '关卡策划');
  console.log(chalk.green(`✅ 设置了 ${mapResult.success} 个地形坐标\n`));

  console.log(chalk.cyan('📊 变更分析：'));
  console.log(chalk.gray(sim.getChangeSummary()));
  console.log(chalk.gray(`   推演结论是否变化：${sim.hasConclusionChanged() ? '是' : '否'}\n`));

  console.log(chalk.yellow.bold('━━━━━━━━━━ 场景3: 计算回合顺序，带错误溯源 ━━━━━━━━━━'));
  console.log(chalk.gray('现在计算回合顺序，如果出错会告诉你来自哪里...\n'));

  const secondResult = sim.runSimulation('BATTLE_001', '系统');

  if (secondResult.warnings && secondResult.warnings.length > 0) {
    console.log(sim.formatWarnings(secondResult.warnings));
  }

  if (secondResult.success && secondResult.turnOrder) {
    console.log(chalk.green('✅ 回合顺序计算完成！\n'));
    console.log(chalk.blue('📋 回合顺序表：'));
    secondResult.turnOrder.forEach((item) => {
      const sourceText = item.source === 'terrain_bonus' ? '（含地形加成）' : '';
      console.log(chalk.white(`   ${item.phase}. ${item.unitName} - 先手值: ${item.initiative} ${sourceText}`));
    });

    console.log(chalk.cyan('\n🔍 查看单个单位的先手值明细：'));
    const explanation = sim.explainTurnOrder('BLUE_ARCH_001');
    if (explanation) {
      console.log(chalk.gray(explanation));
    }
  }

  console.log(chalk.yellow.bold('\n━━━━━━━━━━ 场景4: 回合顺序算错时的溯源 ━━━━━━━━━━'));
  console.log(chalk.gray('故意制造一个平局来演示错误溯源...\n'));

  sim.updateUnit('RED_INF_001', { initiative: 55 }, '数值策划');

  const tieResult = sim.runSimulation('BATTLE_002', '系统');
  if (!tieResult.success && tieResult.errors) {
    console.log(sim.formatErrors(tieResult.errors));
    console.log(sim.getNextSteps(tieResult.errors));
  }

  sim.updateUnit('RED_INF_001', { initiative: 50 }, '数值策划');

  console.log(chalk.yellow.bold('\n━━━━━━━━━━ 场景5: 玩法策划手动修改战报，保留历史 ━━━━━━━━━━'));
  console.log(chalk.gray('手动修改战报，前后变化留在历史里...\n'));

  const finalResult = sim.runSimulation('BATTLE_003', '系统');

  if (finalResult.success) {
    console.log(chalk.green('✅ 生成初始战报\n'));

    console.log(chalk.blue('✏️  玩法策划手动修改战报：将胜者设为RED方，调整摘要...\n'));
    sim.manuallyEditReport('BATTLE_003', {
      winner: 'RED',
      summary: '经过激烈战斗，赤焰军团凭借骑兵的出色发挥取得胜利！'
    }, '玩法策划');

    console.log(chalk.yellow('📜 查看战报历史：'));
    console.log(sim.getReportHistory('BATTLE_003'));

    console.log(chalk.yellow('\n📊 版本对比：'));
    console.log(sim.compareReportVersions('BATTLE_003', 0, 1));
  }

  console.log(chalk.yellow.bold('\n━━━━━━━━━━ 场景6: 汇总变更分析 ━━━━━━━━━━'));
  console.log(chalk.gray('最后看看所有变更中哪些影响了结论...\n'));

  console.log(chalk.cyan(sim.getChangeSummary()));

  console.log(chalk.cyan.bold('\n╔══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║                    ✨ 演示结束！                              ║'));
  console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.white('📖 系统特性总结：'));
  console.log(chalk.gray('  • 错误提示像人话 - 不吐字段名和堆栈，说清楚问题'));
  console.log(chalk.gray('  • 区分补材料和改结论 - 哪些只是完善信息，哪些真的改了结果'));
  console.log(chalk.gray('  • 回合顺序错误溯源 - 来自单位表还是地形规则，找谁补'));
  console.log(chalk.gray('  • 战报历史追踪 - 手动改动留在历史里，复盘不打架\n'));
}

runDemo().catch(console.error);
