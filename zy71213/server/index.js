const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const PensionCalculator = require('./pension-calculator');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

const calculator = new PensionCalculator();

const 边界案例数据 = {
  补缴重复案例: {
    name: '补缴重复案例',
    参保人信息: { 姓名: '张三', 身份证号: '110101197001011234' },
    参保记录: [
      {
        id: 'ins001',
        姓名: '张三',
        身份证号: '110101197001011234',
        参保地: '北京市',
        起始年月: '2000-01',
        终止年月: '2010-12',
        缴费类型: '正常缴费',
        缴费基数: 5000,
        个人账户储存额: 48000,
        缴费月数: 132
      }
    ],
    补缴单: [
      {
        id: 'supp001',
        参保记录ID: 'ins001',
        补缴起始年月: '2005-01',
        补缴终止年月: '2005-06',
        补缴基数: 6000,
        补缴金额: 8640,
        补缴类型: '单位补缴',
        滞纳金: 120,
        状态: '已确认'
      }
    ],
    领取地信息: {
      id: 'loc001',
      城市: '北京市',
      省份: '北京市',
      户籍性质: '城镇',
      社会平均工资: 11082,
      计发基数: 11082,
      最低缴费基数: 6650,
      最高缴费基数: 33225
    },
    年龄信息: {
      出生日期: '1970-01-01',
      退休年月: '2030-01',
      性别: '男',
      工种: '普通',
      视同缴费年限: 5
    }
  },
  多地参保案例: {
    name: '多地参保案例',
    参保人信息: { 姓名: '李四', 身份证号: '310101197505155678' },
    参保记录: [
      {
        id: 'ins002',
        姓名: '李四',
        身份证号: '310101197505155678',
        参保地: '上海市',
        起始年月: '2000-01',
        终止年月: '2008-12',
        缴费类型: '正常缴费',
        缴费基数: 6000,
        个人账户储存额: 55296,
        缴费月数: 108
      },
      {
        id: 'ins003',
        姓名: '李四',
        身份证号: '310101197505155678',
        参保地: '北京市',
        起始年月: '2009-01',
        终止年月: '2020-12',
        缴费类型: '正常缴费',
        缴费基数: 8000,
        个人账户储存额: 92160,
        缴费月数: 144
      },
      {
        id: 'ins004',
        姓名: '李四',
        身份证号: '310101197505155678',
        参保地: '深圳市',
        起始年月: '2021-01',
        终止年月: '2025-12',
        缴费类型: '正常缴费',
        缴费基数: 10000,
        个人账户储存额: 57600,
        缴费月数: 60
      }
    ],
    补缴单: [],
    领取地信息: {
      id: 'loc002',
      城市: '上海市',
      省份: '上海市',
      户籍性质: '城镇',
      社会平均工资: 12183,
      计发基数: 12183,
      最低缴费基数: 7330,
      最高缴费基数: 36549
    },
    年龄信息: {
      出生日期: '1975-05-15',
      退休年月: '2035-05',
      性别: '男',
      工种: '普通',
      视同缴费年限: 0
    }
  },
  提前退休案例: {
    name: '提前退休案例',
    参保人信息: { 姓名: '王五', 身份证号: '440101198003209012' },
    参保记录: [
      {
        id: 'ins005',
        姓名: '王五',
        身份证号: '440101198003209012',
        参保地: '广州市',
        起始年月: '2000-01',
        终止年月: '2022-12',
        缴费类型: '正常缴费',
        缴费基数: 7000,
        个人账户储存额: 184320,
        缴费月数: 276
      }
    ],
    补缴单: [],
    领取地信息: {
      id: 'loc003',
      城市: '广州市',
      省份: '广东省',
      户籍性质: '城镇',
      社会平均工资: 10428,
      计发基数: 10428,
      最低缴费基数: 6257,
      最高缴费基数: 31284
    },
    年龄信息: {
      出生日期: '1980-03-20',
      退休年月: '2035-03',
      性别: '男',
      工种: '特殊工种',
      视同缴费年限: 3
    }
  },
  缴费年限不足案例: {
    name: '缴费年限不足案例',
    参保人信息: { 姓名: '赵六', 身份证号: '510101197208103456' },
    参保记录: [
      {
        id: 'ins006',
        姓名: '赵六',
        身份证号: '510101197208103456',
        参保地: '成都市',
        起始年月: '2015-01',
        终止年月: '2024-12',
        缴费类型: '正常缴费',
        缴费基数: 4000,
        个人账户储存额: 46080,
        缴费月数: 120
      }
    ],
    补缴单: [],
    领取地信息: {
      id: 'loc004',
      城市: '成都市',
      省份: '四川省',
      户籍性质: '城镇',
      社会平均工资: 8491,
      计发基数: 8491,
      最低缴费基数: 5095,
      最高缴费基数: 25473
    },
    年龄信息: {
      出生日期: '1972-08-10',
      退休年月: '2032-08',
      性别: '男',
      工种: '普通',
      视同缴费年限: 0
    }
  }
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '养老金试算系统运行正常' });
});

app.get('/api/sample-cases', (req, res) => {
  res.json({
    success: true,
    data: 边界案例数据,
    message: '边界案例样例数据'
  });
});

app.post('/api/calculate', (req, res) => {
  try {
    const { 参保人信息, 参保记录, 补缴单, 领取地信息, 年龄信息 } = req.body;
    
    if (!参保记录 || !参保记录.length) {
      return res.status(400).json({
        success: false,
        message: '参保记录不能为空'
      });
    }
    
    if (!领取地信息) {
      return res.status(400).json({
        success: false,
        message: '领取地信息不能为空'
      });
    }
    
    if (!年龄信息) {
      return res.status(400).json({
        success: false,
        message: '年龄信息不能为空'
      });
    }
    
    const 结果 = calculator.计算养老金(参保人信息, 参保记录, 补缴单 || [], 领取地信息, 年龄信息);
    
    res.json({
      success: true,
      data: 结果,
      message: '试算完成'
    });
  } catch (error) {
    console.error('试算错误:', error);
    res.status(500).json({
      success: false,
      message: '试算过程中发生错误: ' + error.message
    });
  }
});

app.post('/api/compare', (req, res) => {
  try {
    const { 方案列表 } = req.body;
    
    if (!方案列表 || !方案列表.length) {
      return res.status(400).json({
        success: false,
        message: '方案列表不能为空'
      });
    }
    
    const 对比结果 = calculator.对比方案(方案列表);
    
    res.json({
      success: true,
      data: 对比结果,
      message: '方案对比完成'
    });
  } catch (error) {
    console.error('方案对比错误:', error);
    res.status(500).json({
      success: false,
      message: '方案对比过程中发生错误: ' + error.message
    });
  }
});

app.post('/api/validate/payment-months', (req, res) => {
  try {
    const { 参保记录, 补缴单 } = req.body;
    
    const 结果 = calculator.归集缴费年限(参保记录 || [], 补缴单 || []);
    
    res.json({
      success: true,
      data: {
        实际缴费月数: 结果.实际缴费月数,
        实际缴费年限: 结果.实际缴费年限,
        剩余月数: 结果.剩余月数,
        边界提示: 结果.边界提示
      },
      message: '缴费月份校验完成'
    });
  } catch (error) {
    console.error('缴费月份校验错误:', error);
    res.status(500).json({
      success: false,
      message: '缴费月份校验过程中发生错误: ' + error.message
    });
  }
});

app.post('/api/validate/age', (req, res) => {
  try {
    const { 出生日期, 退休年月, 性别, 工种 } = req.body;
    
    const 结果 = calculator.校验年龄边界(出生日期, 退休年月, 性别, 工种);
    
    res.json({
      success: true,
      data: 结果,
      message: '年龄边界校验完成'
    });
  } catch (error) {
    console.error('年龄边界校验错误:', error);
    res.status(500).json({
      success: false,
      message: '年龄边界校验过程中发生错误: ' + error.message
    });
  }
});

app.post('/api/determine-location', (req, res) => {
  try {
    const { 参保记录, 户籍地 } = req.body;
    
    const 结果 = calculator.确定领取地(参保记录 || [], 户籍地);
    
    res.json({
      success: true,
      data: 结果,
      message: '领取地确定完成'
    });
  } catch (error) {
    console.error('领取地确定错误:', error);
    res.status(500).json({
      success: false,
      message: '领取地确定过程中发生错误: ' + error.message
    });
  }
});

app.post('/api/export-pdf', (req, res) => {
  try {
    const { 试算结果, 参保人信息 } = req.body;
    
    const doc = new PDFDocument();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="养老金试算报告_${参保人信息.姓名 || '未知'}_${Date.now()}.pdf"`);
    
    doc.pipe(res);
    
    doc.fontSize(20).text('养老金领取试算报告', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(14).text(`姓名: ${参保人信息.姓名 || '未填写'}`);
    doc.text(`身份证号: ${参保人信息.身份证号 || '未填写'}`);
    doc.text(`试算时间: ${new Date().toLocaleString('zh-CN')}`);
    doc.moveDown();
    
    doc.fontSize(16).text('一、缴费明细', { underline: true });
    doc.fontSize(12);
    if (试算结果 && 试算结果.缴费明细) {
      doc.text(`累计缴费年限: ${试算结果.缴费明细.累计缴费年限} 年`);
      doc.text(`实际缴费年限: ${试算结果.缴费明细.实际缴费年限} 年`);
      doc.text(`视同缴费年限: ${试算结果.缴费明细.视同缴费年限} 年`);
      doc.text(`平均缴费指数: ${试算结果.缴费明细.平均缴费指数}`);
    }
    doc.moveDown();
    
    doc.fontSize(16).text('二、账户信息', { underline: true });
    doc.fontSize(12);
    if (试算结果 && 试算结果.账户信息) {
      doc.text(`个人账户储存额: ¥${试算结果.账户信息.个人账户储存额}`);
      doc.text(`计发月数: ${试算结果.账户信息.计发月数} 个月`);
    }
    doc.moveDown();
    
    doc.fontSize(16).text('三、养老金构成', { underline: true });
    doc.fontSize(12);
    if (试算结果 && 试算结果.养老金构成) {
      doc.text(`基础养老金: ¥${试算结果.养老金构成.基础养老金}/月`);
      doc.text(`个人账户养老金: ¥${试算结果.养老金构成.个人账户养老金}/月`);
      doc.text(`过渡性养老金: ¥${试算结果.养老金构成.过渡性养老金}/月`);
      doc.text(`过渡性调节金: ¥${试算结果.养老金构成.过渡性调节金}/月`);
      doc.fontSize(14).text(`每月领取总额: ¥${试算结果.养老金构成.每月领取总额}/月`, { bold: true });
    }
    doc.moveDown();
    
    doc.fontSize(16).text('四、领取地信息', { underline: true });
    doc.fontSize(12);
    if (试算结果 && 试算结果.领取地信息) {
      doc.text(`最终领取地: ${试算结果.领取地信息.最终领取地}`);
      doc.text(`领取依据: ${试算结果.领取地信息.领取依据}`);
      doc.text(`计发基数: ¥${试算结果.领取地信息.计发基数}`);
    }
    doc.moveDown();
    
    if (试算结果 && 试算结果.边界提示 && 试算结果.边界提示.length > 0) {
      doc.fontSize(16).text('五、边界提示', { underline: true });
      doc.fontSize(12);
      试算结果.边界提示.forEach((提示, index) => {
        doc.text(`${index + 1}. [${提示.severity}] ${提示.type}: ${提示.message}`);
      });
    }
    
    doc.end();
    
  } catch (error) {
    console.error('PDF导出错误:', error);
    res.status(500).json({
      success: false,
      message: 'PDF导出过程中发生错误: ' + error.message
    });
  }
});

app.listen(port, () => {
  console.log(`养老金试算系统后端服务运行在 http://localhost:${port}`);
});
