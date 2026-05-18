const db = require('../database/db');
const { 检查借用前置条件 } = require('./validation-service');

async function 登记借用(借用数据) {
  const { 器械编号, 借用人工号, 借用人姓名, 借用科室, 借用用途, 预计归还日期 } = 借用数据;

  const 前置检查 = await 检查借用前置条件(器械编号);

  if (!前置检查.可借用) {
    return {
      成功: false,
      消息: '借用前置检查不通过',
      问题列表: 前置检查.问题列表
    };
  }

  const 借用日期时间 = 借用数据.借用日期时间 || new Date().toISOString().replace('T', ' ').substring(0, 19);

  const insertBorrow = db.prepare(`
    INSERT INTO 借还明细 
    (器械编号, 借用人工号, 借用人姓名, 借用科室, 借用日期时间, 预计归还日期, 借用用途, 状态)
    VALUES (?, ?, ?, ?, ?, ?, ?, '借用中')
  `);

  const updateEquipment = db.prepare(`
    UPDATE 器械档案 SET 当前状态 = '借用中', 当前位置 = ? WHERE 器械编号 = ?
  `);

  await db.transaction(async () => {
    await insertBorrow.run(器械编号, 借用人工号, 借用人姓名, 借用科室, 借用日期时间, 预计归还日期, 借用用途);
    await updateEquipment.run(借用科室, 器械编号);
  });

  const 器械信息 = await db.prepare(`SELECT 器械名称, 器械类别 FROM 器械档案 WHERE 器械编号 = ?`).get(器械编号);

  return {
    成功: true,
    消息: '借用登记成功',
    借用信息: {
      器械编号,
      器械名称: 器械信息.器械名称,
      器械类别: 器械信息.器械类别,
      借用人姓名,
      借用科室,
      借用日期时间
    }
  };
}

async function 登记归还(归还数据) {
  const { 记录编号, 器械编号, 归还人工号, 归还人姓名 } = 归还数据;

  const 借用记录 = await db.prepare(`
    SELECT * FROM 借还明细 WHERE 记录编号 = ? AND 状态 = '借用中'
  `).get(记录编号);

  if (!借用记录) {
    return {
      成功: false,
      消息: '未找到对应的借用记录或该记录已归还'
    };
  }

  const 归还日期时间 = 归还数据.归还日期时间 || new Date().toISOString().replace('T', ' ').substring(0, 19);

  const updateRecord = db.prepare(`
    UPDATE 借还明细 
    SET 归还人工号 = ?, 归还人姓名 = ?, 归还日期时间 = ?, 消毒状态 = '未消毒', 状态 = '已归还'
    WHERE 记录编号 = ?
  `);

  const updateEquipment = db.prepare(`
    UPDATE 器械档案 SET 当前状态 = '待消毒', 当前位置 = '消毒室' WHERE 器械编号 = ?
  `);

  await db.transaction(async () => {
    await updateRecord.run(归还人工号, 归还人姓名, 归还日期时间, 记录编号);
    await updateEquipment.run(器械编号);
  });

  return {
    成功: true,
    消息: '归还登记成功，请及时安排消毒',
    归还信息: {
      记录编号,
      器械编号,
      归还人姓名,
      归还日期时间,
      当前消毒状态: '未消毒',
      下一步操作: '请尽快完成消毒并录入消毒记录'
    }
  };
}

async function 批量补录借还(记录列表) {
  const 结果列表 = [];
  let 成功数量 = 0;
  let 失败数量 = 0;

  for (const 记录 of 记录列表) {
    let 结果;
    if (记录.操作类型 === '借用') {
      结果 = await 登记借用({
        器械编号: 记录.器械编号,
        借用人工号: 记录.操作人工号,
        借用人姓名: 记录.操作人姓名,
        借用科室: 记录.科室,
        借用用途: 记录.用途,
        预计归还日期: 记录.预计归还日期,
        借用日期时间: 记录.操作日期时间
      });
    } else if (记录.操作类型 === '归还') {
      结果 = await 登记归还({
        记录编号: 记录.记录编号,
        器械编号: 记录.器械编号,
        归还人工号: 记录.操作人工号,
        归还人姓名: 记录.操作人姓名,
        归还日期时间: 记录.操作日期时间
      });
    } else {
      结果 = { 成功: false, 消息: `未知操作类型: ${记录.操作类型}` };
    }

    结果.原始数据 = 记录;
    结果列表.push(结果);

    if (结果.成功) {
      成功数量++;
    } else {
      失败数量++;
    }
  }

  return {
    总数量: 记录列表.length,
    成功数量,
    失败数量,
    处理时间: new Date().toISOString(),
    详细结果: 结果列表
  };
}

async function 登记消毒(消毒数据) {
  const { 器械编号, 消毒人工号, 消毒方式, 消毒时长, 备注 } = 消毒数据;

  const 消毒日期 = new Date().toISOString().split('T')[0];
  const 器械信息 = await db.prepare(`SELECT 消毒有效期 FROM 器械档案 WHERE 器械编号 = ?`).get(器械编号);
  
  if (!器械信息) {
    return { 成功: false, 消息: '器械不存在' };
  }

  const 有效期至 = new Date();
  有效期至.setDate(有效期至.getDate() + (器械信息.消毒有效期 || 14));
  const 有效期至Str = 有效期至.toISOString().split('T')[0];

  const insertSterilize = db.prepare(`
    INSERT INTO 消毒记录 (器械编号, 消毒日期, 消毒人工号, 消毒方式, 消毒时长, 有效期至, 备注)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const updateRecord = db.prepare(`
    UPDATE 借还明细 SET 消毒状态 = '已消毒', 消毒日期 = ?, 消毒人工号 = ?
    WHERE 器械编号 = ? AND 状态 = '已归还'
    ORDER BY 归还日期时间 DESC LIMIT 1
  `);

  const updateEquipment = db.prepare(`
    UPDATE 器械档案 SET 当前状态 = '在库', 当前位置 = ? WHERE 器械编号 = ?
  `);

  await db.transaction(async () => {
    await insertSterilize.run(器械编号, 消毒日期, 消毒人工号, 消毒方式, 消毒时长 || 30, 有效期至Str, 备注);
    await updateRecord.run(消毒日期, 消毒人工号, 器械编号);
    await updateEquipment.run('消毒室-已消毒', 器械编号);
  });

  return {
    成功: true,
    消息: '消毒登记完成',
    消毒信息: {
      器械编号,
      消毒日期,
      有效期至: 有效期至Str
    }
  };
}

module.exports = {
  登记借用,
  登记归还,
  批量补录借还,
  登记消毒
};
