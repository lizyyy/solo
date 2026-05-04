const {
  runAllRiskDetections,
  saveRiskDetections,
  reviewRiskDetection,
  getRiskDetections,
  getRiskStats,
  riskTypeNames,
} = require('../services/riskDetectionService');

async function runDetectionHandler(req, res) {
  try {
    const risks = await runAllRiskDetections();
    const savedRisks = await saveRiskDetections(risks);
    
    res.json({
      success: true,
      message: `风险检测完成，共检测到 ${risks.length} 个风险项`,
      data: savedRisks,
    });
  } catch (error) {
    console.error('风险检测失败:', error);
    res.status(500).json({
      success: false,
      message: '风险检测失败: ' + error.message,
    });
  }
}

async function getRiskListHandler(req, res) {
  try {
    const { status, riskType, pageNumber } = req.query;
    
    const filters = {};
    if (status) filters.status = status;
    if (riskType) filters.riskType = riskType;
    if (pageNumber) filters.pageNumber = parseInt(pageNumber);
    
    const risks = await getRiskDetections(filters);
    
    res.json({
      success: true,
      data: risks,
    });
  } catch (error) {
    console.error('获取风险列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取风险列表失败: ' + error.message,
    });
  }
}

async function reviewRiskHandler(req, res) {
  try {
    const { id } = req.params;
    const { newStatus, reviewer, comment } = req.body;
    
    if (!newStatus) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: newStatus',
      });
    }
    
    const validStatuses = ['pending', 'reviewed', 'overruled', 'resolved', 'ignored'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `无效的状态值，有效值为: ${validStatuses.join(', ')}`,
      });
    }
    
    const updatedRisk = await reviewRiskDetection(
      parseInt(id),
      newStatus,
      reviewer || '未指定复核人',
      comment
    );
    
    res.json({
      success: true,
      message: '复核完成',
      data: updatedRisk,
    });
  } catch (error) {
    console.error('复核风险项失败:', error);
    res.status(500).json({
      success: false,
      message: '复核失败: ' + error.message,
    });
  }
}

async function getRiskStatsHandler(req, res) {
  try {
    const stats = await getRiskStats();
    
    res.json({
      success: true,
      data: {
        ...stats,
        riskTypeNames,
      },
    });
  } catch (error) {
    console.error('获取风险统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取风险统计失败: ' + error.message,
    });
  }
}

module.exports = {
  runDetectionHandler,
  getRiskListHandler,
  reviewRiskHandler,
  getRiskStatsHandler,
};
