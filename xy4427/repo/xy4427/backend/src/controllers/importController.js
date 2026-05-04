const {
  importOriginalTexts,
  importBrailleProofreadings,
  importTemperatureCurves,
  importStudentFeedbacks,
} = require('../services/importService');

async function importOriginalTextsHandler(req, res) {
  try {
    const data = req.body;
    
    if (!Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        message: '数据格式错误，应为数组格式',
      });
    }
    
    const imported = await importOriginalTexts(data);
    
    res.json({
      success: true,
      message: `成功导入 ${imported.length} 条原文段落记录`,
      data: imported,
    });
  } catch (error) {
    console.error('导入原文段落失败:', error);
    res.status(500).json({
      success: false,
      message: '导入失败: ' + error.message,
    });
  }
}

async function importBrailleProofreadingsHandler(req, res) {
  try {
    const data = req.body;
    
    if (!Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        message: '数据格式错误，应为数组格式',
      });
    }
    
    const imported = await importBrailleProofreadings(data);
    
    res.json({
      success: true,
      message: `成功导入 ${imported.length} 条盲文校对记录`,
      data: imported,
    });
  } catch (error) {
    console.error('导入盲文校对记录失败:', error);
    res.status(500).json({
      success: false,
      message: '导入失败: ' + error.message,
    });
  }
}

async function importTemperatureCurvesHandler(req, res) {
  try {
    const data = req.body;
    
    if (!Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        message: '数据格式错误，应为数组格式',
      });
    }
    
    const imported = await importTemperatureCurves(data);
    
    res.json({
      success: true,
      message: `成功导入 ${imported.length} 条温度曲线记录`,
      data: imported,
    });
  } catch (error) {
    console.error('导入温度曲线记录失败:', error);
    res.status(500).json({
      success: false,
      message: '导入失败: ' + error.message,
    });
  }
}

async function importStudentFeedbacksHandler(req, res) {
  try {
    const data = req.body;
    
    if (!Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        message: '数据格式错误，应为数组格式',
      });
    }
    
    const imported = await importStudentFeedbacks(data);
    
    res.json({
      success: true,
      message: `成功导入 ${imported.length} 条学生试读反馈`,
      data: imported,
    });
  } catch (error) {
    console.error('导入学生试读反馈失败:', error);
    res.status(500).json({
      success: false,
      message: '导入失败: ' + error.message,
    });
  }
}

module.exports = {
  importOriginalTextsHandler,
  importBrailleProofreadingsHandler,
  importTemperatureCurvesHandler,
  importStudentFeedbacksHandler,
};
