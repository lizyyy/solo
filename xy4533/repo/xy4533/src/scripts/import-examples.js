const path = require('path');
const importService = require('../services/importService');

const examplesDir = path.join(__dirname, '../../examples');

async function importAllExamples() {
  console.log('='.repeat(60));
  console.log('开始导入示例数据...');
  console.log('='.repeat(60));
  console.log('');

  try {
    console.log('1. 导入订单数据...');
    const ordersResult = await importService.importOrdersFromCSV(
      path.join(examplesDir, 'orders.csv')
    );
    console.log(`   ✓ 导入完成: 总计 ${ordersResult.total} 条, 成功 ${ordersResult.imported} 条`);
    if (ordersResult.errors > 0) {
      console.log(`   ⚠ 错误: ${ordersResult.errors} 条`);
    }

    console.log('');
    console.log('2. 导入湿房读数...');
    const wetroomResult = await importService.importWetroomReadingsFromJSON(
      path.join(examplesDir, 'wetroom_readings.json')
    );
    console.log(`   ✓ 导入完成: 总计 ${wetroomResult.total} 条, 成功 ${wetroomResult.imported} 条`);
    if (wetroomResult.errors > 0) {
      console.log(`   ⚠ 错误: ${wetroomResult.errors} 条`);
    }

    console.log('');
    console.log('3. 导入漆层工序数据...');
    const layersResult = await importService.importLayerProcessesFromCSV(
      path.join(examplesDir, 'layer_processes.csv')
    );
    console.log(`   ✓ 导入完成: 总计 ${layersResult.total} 条, 成功 ${layersResult.imported} 条`);
    if (layersResult.errors > 0) {
      console.log(`   ⚠ 错误: ${layersResult.errors} 条`);
    }

    console.log('');
    console.log('4. 导入交接备注...');
    const handoverResult = await importService.importHandoverNotesFromText(
      path.join(examplesDir, 'handover_notes.txt')
    );
    console.log(`   ✓ 导入完成: 总计 ${handoverResult.total} 条, 成功 ${handoverResult.imported} 条`);
    if (handoverResult.errors > 0) {
      console.log(`   ⚠ 错误: ${handoverResult.errors} 条`);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('示例数据导入完成！');
    console.log('');
    console.log('导入统计:');
    console.log(`  - 订单: ${ordersResult.imported} 条`);
    console.log(`  - 湿房读数: ${wetroomResult.imported} 条`);
    console.log(`  - 漆层工序: ${layersResult.imported} 条`);
    console.log(`  - 交接备注: ${handoverResult.imported} 条`);
    console.log('');
    console.log('注意: 示例数据中包含一些故意制造的违规情况，用于测试违规检测功能:');
    console.log('  1. 底漆完成后未干透就进入髹涂');
    console.log('  2. 打磨工序未完成就开始描金');
    console.log('  3. 湿房读数超出正常范围');
    console.log('');
    console.log('请运行以下命令进行违规检测:');
    console.log('  curl -X POST http://localhost:3000/api/violations/check');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (err) {
    console.error('导入失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

importAllExamples();
