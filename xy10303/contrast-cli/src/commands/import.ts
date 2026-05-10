import { DataStore } from '../services/dataStore';
import { Importer } from '../services/importer';
import { logger } from '../utils/logger';
import { ImportDataType, ImportResult } from '../models';

export function handleImport(
  filePath: string,
  dataType: ImportDataType,
  store: DataStore
): void {
  try {
    logger.heading(`导入数据`);
    logger.info(`文件: ${filePath}`);
    logger.info(`类型: ${dataType}`);
    logger.line();

    const { data, errors: transformErrors } = Importer.importFile(filePath, dataType);

    if (transformErrors.length > 0) {
      logger.error(`数据转换失败，存在 ${transformErrors.length} 个错误:`);
      transformErrors.forEach(err => {
        logger.bullet(`第 ${err.row} 行: ${err.message}`);
      });
      process.exit(1);
    }

    logger.info(`解析到 ${data.length} 条记录`);

    let result: ImportResult;
    
    switch (dataType) {
      case 'appointments':
        result = store.importAppointments(data);
        break;
      case 'batches':
        result = store.importBatches(data);
        break;
      case 'usage':
        result = store.importUsageRecords(data);
        break;
      default:
        throw new Error(`未知的数据类型: ${dataType}`);
    }

    if (result.success) {
      logger.success(`导入完成`);
      logger.bullet(`成功导入: ${result.imported} 条`);
      if (result.skipped > 0) {
        logger.warning(`跳过重复: ${result.skipped} 条 (幂等处理)`);
      }
    } else {
      logger.error(`导入失败，存在 ${result.errors.length} 个错误:`);
      result.errors.forEach(err => {
        const rowInfo = err.row ? `第 ${err.row} 行` : '';
        const fieldInfo = err.field ? `字段 [${err.field}]` : '';
        const valueInfo = err.value !== undefined ? `值 "${err.value}"` : '';
        logger.bullet(`${rowInfo} ${fieldInfo} ${valueInfo}: ${err.message}`.trim());
      });
      if (result.imported > 0) {
        logger.warning(`部分导入: ${result.imported} 条成功`);
      }
      process.exit(1);
    }

    if (result.warnings.length > 0) {
      logger.line();
      logger.warning(`警告信息:`);
      result.warnings.forEach(w => logger.bullet(w));
    }

  } catch (e: any) {
    logger.error(`导入失败: ${e.message}`);
    process.exit(1);
  }
}
