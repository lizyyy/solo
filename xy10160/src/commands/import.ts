import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import {
  saveSnapshot,
  saveSourceData,
  isInitialized,
  addHistoryEntry,
} from '../storage/store';
import { Product, SourceData } from '../types';

const readProductsFromFile = (filePath: string): Product[] => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase();
  const content = fs.readFileSync(filePath, 'utf-8');

  if (ext === '.json') {
    try {
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        return data;
      }
      throw new Error('JSON 文件必须是商品数组');
    } catch (e) {
      throw new Error(`JSON 解析失败: ${(e as Error).message}`);
    }
  }

  if (ext === '.csv') {
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV 文件至少需要表头和一行数据');
    }

    const headers = lines[0].split(',').map((h) => h.trim());
    const products: Product[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const product: Record<string, unknown> = {};

      headers.forEach((header, index) => {
        let val: unknown = values[index] || '';
        const numVal = Number(val);
        if (!isNaN(numVal) && String(numVal) === val) {
          val = numVal;
        } else if (val === 'true' || val === 'false') {
          val = val === 'true';
        }
        product[header] = val;
      });

      products.push(product as Product);
    }

    return products;
  }

  throw new Error(`不支持的文件格式: ${ext}，仅支持 .json 和 .csv`);
};

const validateProducts = (products: Product[]): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  products.forEach((p, index) => {
    const line = index + 2;
    if (!p.id) {
      errors.push(`第 ${line} 行: 缺少必填字段 id`);
    } else {
      if (seenIds.has(String(p.id))) {
        errors.push(`第 ${line} 行: 重复的 id: ${p.id}`);
      }
      seenIds.add(String(p.id));
    }
    if (!p.name) {
      errors.push(`第 ${line} 行: 缺少必填字段 name`);
    }
    if (p.price === undefined || p.price === null) {
      errors.push(`第 ${line} 行: 缺少必填字段 price`);
    }
  });

  return { valid: errors.length === 0, errors };
};

export const importSnapshotCommand = (
  filePath: string,
  options: { name: string; description?: string }
): void => {
  if (!isInitialized()) {
    console.log(chalk.red('✗ 项目未初始化'));
    console.log(chalk.gray('   请先运行: sir init'));
    return;
  }

  if (!filePath) {
    console.log(chalk.red('✗ 必须指定文件路径'));
    console.log(chalk.gray('   用法: sir import snapshot <文件路径> --name <名称>'));
    addHistoryEntry('import', '导入快照失败', 'failed', '未指定文件路径');
    return;
  }

  if (!options.name) {
    console.log(chalk.red('✗ 必须指定 --name 参数'));
    addHistoryEntry('import', '导入快照失败', 'failed', '未指定名称');
    return;
  }

  try {
    console.log(chalk.blue('📥 正在读取索引快照...'));
    const products = readProductsFromFile(filePath);

    console.log(chalk.blue('🔍 正在验证数据...'));
    const validation = validateProducts(products);
    if (!validation.valid) {
      console.log(chalk.red('✗ 数据验证失败:'));
      validation.errors.slice(0, 10).forEach((e) => console.log(chalk.gray(`   - ${e}`)));
      if (validation.errors.length > 10) {
        console.log(chalk.gray(`   ... 还有 ${validation.errors.length - 10} 个错误`));
      }
      addHistoryEntry(
        'import',
        '导入快照验证失败',
        'failed',
        `文件: ${filePath}, 错误数: ${validation.errors.length}`
      );
      return;
    }

    console.log(chalk.blue('💾 正在保存快照...'));
    const snapshot = saveSnapshot(options.name, products, options.description);

    console.log(chalk.green('✓ 索引快照导入成功'));
    console.log(chalk.gray(`   快照 ID: ${snapshot.id}`));
    console.log(chalk.gray(`   商品数量: ${snapshot.productCount}`));
    console.log(chalk.gray(`   文件: ${snapshot.filePath}`));

    addHistoryEntry(
      'import',
      `导入快照: ${options.name}`,
      'success',
      `商品数: ${products.length}, 文件: ${filePath}`
    );
  } catch (e) {
    console.log(chalk.red(`✗ 导入失败: ${(e as Error).message}`));
    addHistoryEntry('import', '导入快照失败', 'failed', (e as Error).message);
  }
};

export const importSourceCommand = (
  filePath: string,
  options: { name: string; description?: string; type: SourceData['sourceType'] }
): void => {
  if (!isInitialized()) {
    console.log(chalk.red('✗ 项目未初始化'));
    console.log(chalk.gray('   请先运行: sir init'));
    return;
  }

  if (!filePath) {
    console.log(chalk.red('✗ 必须指定文件路径'));
    console.log(chalk.gray('   用法: sir import source <文件路径> --name <名称> --type <类型>'));
    addHistoryEntry('import', '导入源数据失败', 'failed', '未指定文件路径');
    return;
  }

  if (!options.name) {
    console.log(chalk.red('✗ 必须指定 --name 参数'));
    addHistoryEntry('import', '导入源数据失败', 'failed', '未指定名称');
    return;
  }

  const validTypes: SourceData['sourceType'][] = ['database', 'api', 'file'];
  if (!validTypes.includes(options.type)) {
    console.log(chalk.red(`✗ 无效的类型: ${options.type}`));
    console.log(chalk.gray(`   可选值: ${validTypes.join(', ')}`));
    addHistoryEntry('import', '导入源数据失败', 'failed', `无效类型: ${options.type}`);
    return;
  }

  try {
    console.log(chalk.blue('📥 正在读取源数据...'));
    const products = readProductsFromFile(filePath);

    console.log(chalk.blue('🔍 正在验证数据...'));
    const validation = validateProducts(products);
    if (!validation.valid) {
      console.log(chalk.red('✗ 数据验证失败:'));
      validation.errors.slice(0, 10).forEach((e) => console.log(chalk.gray(`   - ${e}`)));
      if (validation.errors.length > 10) {
        console.log(chalk.gray(`   ... 还有 ${validation.errors.length - 10} 个错误`));
      }
      addHistoryEntry(
        'import',
        '导入源数据验证失败',
        'failed',
        `文件: ${filePath}, 错误数: ${validation.errors.length}`
      );
      return;
    }

    console.log(chalk.blue('💾 正在保存源数据...'));
    const source = saveSourceData(options.name, products, options.type, options.description);

    console.log(chalk.green('✓ 源数据导入成功'));
    console.log(chalk.gray(`   源数据 ID: ${source.id}`));
    console.log(chalk.gray(`   商品数量: ${source.productCount}`));
    console.log(chalk.gray(`   来源类型: ${source.sourceType}`));
    console.log(chalk.gray(`   文件: ${source.filePath}`));

    addHistoryEntry(
      'import',
      `导入源数据: ${options.name}`,
      'success',
      `商品数: ${products.length}, 类型: ${options.type}, 文件: ${filePath}`
    );
  } catch (e) {
    console.log(chalk.red(`✗ 导入失败: ${(e as Error).message}`));
    addHistoryEntry('import', '导入源数据失败', 'failed', (e as Error).message);
  }
};
