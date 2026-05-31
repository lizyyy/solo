const fs = require('fs');
const path = require('path');
const {
  createChangeOrder,
  saveChangeOrder,
  getChangeOrder,
  ITEM_STATUS,
  updateItemStatus
} = require('./models');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg'];

function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

function parseCsv(content) {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV 文件至少需要包含表头和一行数据');
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const origIdx = headers.indexOf('originalname') !== -1
    ? headers.indexOf('originalname')
    : (headers.indexOf('original') !== -1
        ? headers.indexOf('original')
        : headers.indexOf('源文件'));
  const newIdx = headers.indexOf('newname') !== -1
    ? headers.indexOf('newname')
    : (headers.indexOf('new') !== -1
        ? headers.indexOf('new')
        : headers.indexOf('目标文件'));
  const noteIdx = headers.indexOf('note') !== -1
    ? headers.indexOf('note')
    : headers.indexOf('备注');

  if (origIdx === -1 || newIdx === -1) {
    throw new Error(`CSV 表头需要包含 originalName/newName 列。当前表头: ${headers.join(', ')}`);
  }

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length < 2) continue;

    const originalName = cols[origIdx];
    const newName = cols[newIdx];
    const note = noteIdx !== -1 ? cols[noteIdx] : '';

    if (!originalName || !newName) {
      console.warn(`  ⚠️  第 ${i + 1} 行: 原始名或新名为空，已跳过`);
      continue;
    }

    items.push({ originalName, newName, note });
  }

  return items;
}

function parseJson(content) {
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    throw new Error(`JSON 解析失败: ${e.message}`);
  }

  if (data.items && Array.isArray(data.items)) {
    return data.items;
  }

  if (Array.isArray(data)) {
    return data;
  }

  throw new Error('JSON 格式不正确，需要是数组或包含 items 数组的对象');
}

function normalizeItems(items) {
  const normalized = [];
  const errors = [];
  const warnings = [];

  items.forEach((item, idx) => {
    let originalName = item.originalName || item.original || item.source;
    let newName = item.newName || item.new || item.target;
    const note = item.note || item.remark || item.备注 || '';

    if (!originalName) {
      errors.push(`第 ${idx + 1} 条: 缺少 originalName 字段`);
      return;
    }

    if (!newName) {
      errors.push(`第 ${idx + 1} 条: 缺少 newName 字段`);
      return;
    }

    const origExt = path.extname(originalName).toLowerCase();
    const newExt = path.extname(newName).toLowerCase();

    if (!isImageFile(originalName)) {
      warnings.push(`  ⚠️  [${idx + 1}] ${originalName}: 不是常见的图片格式`);
    }

    if (!newExt) {
      newName = newName + origExt;
      warnings.push(`  ⚠️  [${idx + 1}] 新名缺少扩展名，自动补充为: ${newName}`);
    } else if (newExt !== origExt) {
      warnings.push(`  ⚠️  [${idx + 1}] 扩展名不一致: ${origExt} -> ${newExt}`);
    }

    normalized.push({
      originalName: originalName.trim(),
      newName: newName.trim(),
      note: typeof note === 'string' ? note.trim() : ''
    });
  });

  return { normalized, errors, warnings };
}

async function importChangeOrder(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  const ext = path.extname(absolutePath).toLowerCase();

  let items;
  if (ext === '.csv') {
    items = parseCsv(content);
  } else if (ext === '.json') {
    items = parseJson(content);
  } else {
    throw new Error(`不支持的文件格式: ${ext}，仅支持 .json 和 .csv`);
  }

  console.log(`\n解析到 ${items.length} 条记录，正在校验...`);

  const { normalized, errors, warnings } = normalizeItems(items);

  if (errors.length > 0) {
    console.error('\n❌ 校验失败:');
    errors.forEach(e => console.error(`  ${e}`));
    throw new Error(`共有 ${errors.length} 个错误，请修正后重新导入`);
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  警告:');
    warnings.forEach(w => console.log(w));
  }

  const existing = getChangeOrder();
  if (existing) {
    console.log(`\n⚠️  已存在变更单 ${existing.id} (${existing.batchName})`);
    console.log(`  包含 ${existing.items.length} 条记录，状态: ${existing.status}`);
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await new Promise((resolve) => {
      rl.question('  覆盖现有变更单？(yes/no): ', (answer) => {
        rl.close();
        if (answer.toLowerCase() !== 'yes') {
          console.log('已取消导入');
          process.exit(0);
        }
        resolve();
      });
    });
  }

  const batchName = path.basename(filePath, ext);
  const changeOrder = createChangeOrder(batchName, normalized);

  saveChangeOrder(changeOrder);

  console.log(`\n✅ 导入成功`);
  console.log(`  变更单ID: ${changeOrder.id}`);
  console.log(`  批次名称: ${changeOrder.batchName}`);
  console.log(`  记录条数: ${normalized.length}`);
  console.log(`\n下一步: 运行 bir review 进行复核`);
}

module.exports = {
  importChangeOrder,
  parseCsv,
  parseJson,
  normalizeItems,
  isImageFile
};
