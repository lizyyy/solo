const db = require('../database/db');
const fs = require('fs');
const path = require('path');

async function 查询借还明细(条件 = {}) {
  let sql = `
    SELECT 
      j.记录编号,
      j.器械编号,
      q.器械名称,
      q.器械类别,
      q.规格型号,
      j.借用人工号,
      j.借用人姓名,
      j.借用科室,
      j.借用日期时间,
      j.预计归还日期,
      j.借用用途,
      j.归还人工号,
      j.归还人姓名,
      j.归还日期时间,
      j.消毒状态,
      j.消毒日期,
      j.消毒人工号,
      j.状态,
      j.异常说明
    FROM 借还明细 j
    JOIN 器械档案 q ON j.器械编号 = q.器械编号
    WHERE 1=1
  `;
  const params = [];

  if (条件.开始日期) {
    sql += ` AND DATE(j.借用日期时间) >= ?`;
    params.push(条件.开始日期);
  }
  if (条件.结束日期) {
    sql += ` AND DATE(j.借用日期时间) <= ?`;
    params.push(条件.结束日期);
  }
  if (条件.状态) {
    sql += ` AND j.状态 = ?`;
    params.push(条件.状态);
  }
  if (条件.器械编号) {
    sql += ` AND j.器械编号 = ?`;
    params.push(条件.器械编号);
  }
  if (条件.借用科室) {
    sql += ` AND j.借用科室 = ?`;
    params.push(条件.借用科室);
  }

  sql += ` ORDER BY j.借用日期时间 DESC`;

  const 记录列表 = await db.prepare(sql).all(...params);

  return {
    查询时间: new Date().toISOString(),
    记录总数: 记录列表.length,
    业务字段说明: {
      记录编号: '借还流水号',
      器械编号: '器械唯一标识',
      器械名称: '器械标准名称',
      器械类别: '器械分类(手机类/手术器械/检查器械等)',
      规格型号: '具体型号规格',
      借用人姓名: '实际借用人姓名',
      借用科室: '借用科室名称',
      借用日期时间: '借用发生时间',
      预计归还日期: '预计归还日期',
      借用用途: '具体使用用途说明',
      归还人姓名: '实际归还人姓名',
      归还日期时间: '归还发生时间',
      消毒状态: '已消毒/未消毒',
      消毒日期: '消毒完成日期',
      状态: '借用中/已归还'
    },
    记录列表: 记录列表
  };
}

async function 导出JSON(条件 = {}) {
  const 数据 = await 查询借还明细(条件);
  return JSON.stringify(数据, null, 2);
}

async function 导出CSV(条件 = {}) {
  const 数据 = await 查询借还明细(条件);
  
  if (数据.记录列表.length === 0) {
    return '无数据';
  }

  const 表头 = Object.keys(数据.记录列表[0]);
  const BOM = '\uFEFF';
  let csv = BOM + 表头.join(',') + '\n';

  数据.记录列表.forEach(row => {
    const 行数据 = 表头.map(key => {
      let 值 = row[key] || '';
      值 = String(值).replace(/"/g, '""');
      if (值.includes(',') || 值.includes('\n')) {
        值 = `"${值}"`;
      }
      return 值;
    });
    csv += 行数据.join(',') + '\n';
  });

  return csv;
}

function 保存导出文件(数据, 文件名, 格式 = 'json') {
  const 导出目录 = path.join(__dirname, '../../exports');
  if (!fs.existsSync(导出目录)) {
    fs.mkdirSync(导出目录, { recursive: true });
  }

  const 完整路径 = path.join(导出目录, `${文件名}.${format}`);
  
  if (format === 'csv') {
    fs.writeFileSync(完整路径, 数据, 'utf8');
  } else {
    fs.writeFileSync(完整路径, 数据, 'utf8');
  }

  return {
    文件名: `${文件名}.${format}`,
    完整路径,
    文件大小: Buffer.byteLength(数据, 'utf8')
  };
}

module.exports = {
  查询借还明细,
  导出JSON,
  导出CSV,
  保存导出文件
};
