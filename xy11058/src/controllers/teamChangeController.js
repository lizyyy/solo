const teamChangeService = require('../services/teamChangeService');

async function createApplication(req, res) {
  try {
    const { operatorId, operatorName, ...data } = req.body;
    
    if (!operatorId || !operatorName) {
      return res.status(400).json({
        success: false,
        message: '操作人ID和姓名不能为空'
      });
    }

    const application = await teamChangeService.createApplication(data, operatorId, operatorName);
    
    res.json({
      success: true,
      data: application,
      message: '创建成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

async function submitApplication(req, res) {
  try {
    const { id } = req.params;
    const { operatorId, operatorName, ...data } = req.body;
    
    if (!operatorId || !operatorName) {
      return res.status(400).json({
        success: false,
        message: '操作人ID和姓名不能为空'
      });
    }

    const application = await teamChangeService.submitApplication(parseInt(id), operatorId, operatorName, data);
    
    res.json({
      success: true,
      data: application,
      message: '提交成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

async function withdrawApplication(req, res) {
  try {
    const { id } = req.params;
    const { operatorId, operatorName, reason } = req.body;
    
    if (!operatorId || !operatorName) {
      return res.status(400).json({
        success: false,
        message: '操作人ID和姓名不能为空'
      });
    }

    const application = await teamChangeService.withdrawApplication(parseInt(id), operatorId, operatorName, reason);
    
    res.json({
      success: true,
      data: application,
      message: '撤回成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

async function startManualProcessing(req, res) {
  try {
    const { id } = req.params;
    const { handlerId, handlerName, remark } = req.body;
    
    if (!handlerId || !handlerName) {
      return res.status(400).json({
        success: false,
        message: '处理人ID和姓名不能为空'
      });
    }

    const application = await teamChangeService.startManualProcessing(parseInt(id), handlerId, handlerName, remark);
    
    res.json({
      success: true,
      data: application,
      message: '已进入人工处理'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

async function addRemark(req, res) {
  try {
    const { id } = req.params;
    const { operatorId, operatorName, remark } = req.body;
    
    if (!operatorId || !operatorName || !remark) {
      return res.status(400).json({
        success: false,
        message: '操作人ID、姓名和备注不能为空'
      });
    }

    const application = await teamChangeService.addRemark(parseInt(id), operatorId, operatorName, remark);
    
    res.json({
      success: true,
      data: application,
      message: '备注添加成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

async function approveApplication(req, res) {
  try {
    const { id } = req.params;
    const { operatorId, operatorName, remark } = req.body;
    
    if (!operatorId || !operatorName) {
      return res.status(400).json({
        success: false,
        message: '操作人ID和姓名不能为空'
      });
    }

    const application = await teamChangeService.approveApplication(parseInt(id), operatorId, operatorName, remark);
    
    res.json({
      success: true,
      data: application,
      message: '审核通过'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

async function rejectApplication(req, res) {
  try {
    const { id } = req.params;
    const { operatorId, operatorName, reason } = req.body;
    
    if (!operatorId || !operatorName) {
      return res.status(400).json({
        success: false,
        message: '操作人ID和姓名不能为空'
      });
    }

    const application = await teamChangeService.rejectApplication(parseInt(id), operatorId, operatorName, reason);
    
    res.json({
      success: true,
      data: application,
      message: '审核拒绝'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

async function syncInsuranceList(req, res) {
  try {
    const { id } = req.params;
    const { operatorId, operatorName } = req.body;
    
    if (!operatorId || !operatorName) {
      return res.status(400).json({
        success: false,
        message: '操作人ID和姓名不能为空'
      });
    }

    const result = await teamChangeService.syncInsuranceList(parseInt(id), operatorId, operatorName);
    
    res.json({
      success: true,
      data: result,
      message: result.message
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

async function checkTeamConsistency(req, res) {
  try {
    const { id } = req.params;
    const { operatorId, operatorName } = req.body;
    
    if (!operatorId || !operatorName) {
      return res.status(400).json({
        success: false,
        message: '操作人ID和姓名不能为空'
      });
    }

    const result = await teamChangeService.checkTeamConsistency(parseInt(id), operatorId, operatorName);
    
    res.json({
      success: true,
      data: result,
      message: result.message
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

async function getApplicationList(req, res) {
  try {
    const result = await teamChangeService.getApplicationList(req.query);
    
    res.json({
      success: true,
      data: result,
      message: '查询成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

async function getApplicationDetail(req, res) {
  try {
    const { id } = req.params;
    const application = await teamChangeService.getApplicationDetail(parseInt(id));
    
    res.json({
      success: true,
      data: application,
      message: '查询成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

async function getApplicationHistory(req, res) {
  try {
    const { id } = req.params;
    const history = await teamChangeService.getApplicationHistory(parseInt(id));
    
    res.json({
      success: true,
      data: history,
      message: '查询成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

async function updateApplication(req, res) {
  try {
    const { id } = req.params;
    const { operatorId, operatorName, ...data } = req.body;
    
    if (!operatorId || !operatorName) {
      return res.status(400).json({
        success: false,
        message: '操作人ID和姓名不能为空'
      });
    }

    const application = await teamChangeService.updateApplication(parseInt(id), data, operatorId, operatorName);
    
    res.json({
      success: true,
      data: application,
      message: '更新成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

module.exports = {
  createApplication,
  submitApplication,
  withdrawApplication,
  startManualProcessing,
  addRemark,
  approveApplication,
  rejectApplication,
  syncInsuranceList,
  checkTeamConsistency,
  getApplicationList,
  getApplicationDetail,
  getApplicationHistory,
  updateApplication
};
