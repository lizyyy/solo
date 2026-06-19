const { exportService } = require('../src/services/ExportService');
const { store } = require('../src/store/FileStore');
const { historyManager } = require('../src/utils/history');
const { cadLayerService } = require('../src/services/CADLayerService');
const { temperatureZoneService } = require('../src/services/TemperatureZoneService');

store.clearAll();
historyManager.reloadFromStore();

const importResult = cadLayerService.importLayers([{
  name: '测试图层', zones: [], sourceFile: 'test.dwg'
}], '测试');
const layer = importResult.success[0];
console.log('导入图层:', layer.name);

const zoneResult = temperatureZoneService.createZone({
  name: '测试温区',
  layerId: layer.id,
  bounds: { minX: 10, maxX: 20, minY: 10, maxY: 20, minZ: 0, maxZ: 5 },
  temperatureRange: { min: -10, max: 0 },
  color: '#3498db'
}, '测试');
const zone = zoneResult.zone;
console.log('创建温区:', zone.name);

async function run() {
  console.log('\n开始导出...');
  try {
    const result = await exportService.exportScreenshot('test', '测试者', { zoneIds: [zone.id] });
    console.log('导出结果:', result.success ? '成功' : '失败');
    console.log('消息:', result.message);
    if (result.success) {
      console.log('文件路径:', result.export.filePath);
      console.log('文件大小:', result.export.fileSize, '字节');
      console.log('导出记录数量:', exportService.getExportHistory().length);

      const fs = require('fs');
      const exists = fs.existsSync(result.export.filePath);
      console.log('文件存在:', exists);

      store.reload();
      historyManager.reloadFromStore();
      console.log('重启后导出记录数:', exportService.getExportHistory().length);
    }
  } catch(e) {
    console.error('异常:', e.message);
    console.error(e.stack);
  }
}

run();
