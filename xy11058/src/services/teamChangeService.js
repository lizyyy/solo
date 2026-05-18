const { TeamChangeApplication, TeamChangeHistory, InsuranceList, TeamMember, sequelize } = require('../models');

const STATUS_FLOW = {
  '草稿': ['待审核', '已取消'],
  '待审核': ['审核中', '已撤回', '已取消'],
  '审核中': ['人工处理中', '已通过', '已拒绝', '已撤回'],
  '人工处理中': ['已通过', '已拒绝', '已撤回'],
  '已通过': [],
  '已拒绝': ['待审核'],
  '已撤回': ['待审核'],
  '已取消': []
};

function generateApplicationNo() {
  const date = new Date();
  const dateStr = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `GD${dateStr}${random}`;
}

async function validateStatusTransition(currentStatus, targetStatus) {
  const allowedNextStatuses = STATUS_FLOW[currentStatus];
  if (!allowedNextStatuses.includes(targetStatus)) {
    throw new Error(`状态流转不允许: 从 ${currentStatus} 不能变为 ${targetStatus}`);
  }
  return true;
}

async function recordHistory(applicationId, operationType, operatorId, operatorName, options = {}) {
  const { previousStatus, newStatus, operationRemark, changedFields, originalDataSnapshot, newDataSnapshot } = options;
  
  return await TeamChangeHistory.create({
    applicationId,
    operationType,
    previousStatus,
    newStatus,
    operatorId,
    operatorName,
    operationRemark,
    changedFields: changedFields ? JSON.stringify(changedFields) : null,
    originalDataSnapshot: originalDataSnapshot ? JSON.stringify(originalDataSnapshot) : null,
    newDataSnapshot: newDataSnapshot ? JSON.stringify(newDataSnapshot) : null
  });
}

async function createApplication(data, operatorId, operatorName) {
  const t = await sequelize.transaction();
  
  try {
    const applicationNo = generateApplicationNo();
    
    const application = await TeamChangeApplication.create({
      ...data,
      applicationNo,
      applicantId: operatorId,
      applicantName: operatorName,
      status: '草稿'
    }, { transaction: t });

    await recordHistory(
      application.id,
      '创建',
      operatorId,
      operatorName,
      {
        previousStatus: null,
        newStatus: '草稿',
        operationRemark: '创建改队申请草稿',
        newDataSnapshot: application.toJSON()
      }
    );

    await t.commit();
    return application;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

async function submitApplication(applicationId, operatorId, operatorName, data = {}) {
  const t = await sequelize.transaction();
  
  try {
    const application = await TeamChangeApplication.findByPk(applicationId, { transaction: t });
    
    if (!application) {
      throw new Error('改队申请不存在');
    }

    if (application.status !== '草稿' && application.status !== '已撤回' && application.status !== '已拒绝') {
      throw new Error('当前状态不允许提交');
    }

    const originalData = application.toJSON();
    const updateData = { ...data, status: '待审核', submitTime: new Date() };

    await application.update(updateData, { transaction: t });

    const changedFields = Object.keys(data);
    await recordHistory(
      applicationId,
      '提交',
      operatorId,
      operatorName,
      {
        previousStatus: originalData.status,
        newStatus: '待审核',
        operationRemark: '提交改队申请',
        changedFields,
        originalDataSnapshot: originalData,
        newDataSnapshot: application.toJSON()
      }
    );

    await t.commit();
    return application;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

async function withdrawApplication(applicationId, operatorId, operatorName, reason) {
  const t = await sequelize.transaction();
  
  try {
    const application = await TeamChangeApplication.findByPk(applicationId, { transaction: t });
    
    if (!application) {
      throw new Error('改队申请不存在');
    }

    await validateStatusTransition(application.status, '已撤回');

    const originalData = application.toJSON();

    await application.update({
      status: '已撤回'
    }, { transaction: t });

    await recordHistory(
      applicationId,
      '撤回',
      operatorId,
      operatorName,
      {
        previousStatus: originalData.status,
        newStatus: '已撤回',
        operationRemark: reason || '撤回改队申请',
        originalDataSnapshot: originalData,
        newDataSnapshot: application.toJSON()
      }
    );

    await t.commit();
    return application;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

async function startManualProcessing(applicationId, handlerId, handlerName, remark) {
  const t = await sequelize.transaction();
  
  try {
    const application = await TeamChangeApplication.findByPk(applicationId, { transaction: t });
    
    if (!application) {
      throw new Error('改队申请不存在');
    }

    if (application.status !== '审核中') {
      throw new Error('只有审核中状态才能进入人工处理');
    }

    const originalData = application.toJSON();

    await application.update({
      status: '人工处理中',
      currentHandlerId: handlerId,
      currentHandlerName: handlerName,
      remark: remark
    }, { transaction: t });

    await recordHistory(
      applicationId,
      '人工处理',
      handlerId,
      handlerName,
      {
        previousStatus: originalData.status,
        newStatus: '人工处理中',
        operationRemark: remark || '进入人工处理流程',
        originalDataSnapshot: originalData,
        newDataSnapshot: application.toJSON()
      }
    );

    await t.commit();
    return application;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

async function addRemark(applicationId, operatorId, operatorName, remark) {
  const t = await sequelize.transaction();
  
  try {
    const application = await TeamChangeApplication.findByPk(applicationId, { transaction: t });
    
    if (!application) {
      throw new Error('改队申请不存在');
    }

    const originalData = application.toJSON();
    const newRemark = originalData.remark ? `${originalData.remark}\n${remark}` : remark;

    await application.update({
      remark: newRemark
    }, { transaction: t });

    await recordHistory(
      applicationId,
      '添加备注',
      operatorId,
      operatorName,
      {
        previousStatus: application.status,
        newStatus: application.status,
        operationRemark: remark,
        originalDataSnapshot: originalData,
        newDataSnapshot: application.toJSON()
      }
    );

    await t.commit();
    return application;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

async function approveApplication(applicationId, operatorId, operatorName, remark) {
  const t = await sequelize.transaction();
  
  try {
    const application = await TeamChangeApplication.findByPk(applicationId, { transaction: t });
    
    if (!application) {
      throw new Error('改队申请不存在');
    }

    await validateStatusTransition(application.status, '已通过');

    const originalData = application.toJSON();

    await application.update({
      status: '已通过',
      approveTime: new Date()
    }, { transaction: t });

    await recordHistory(
      applicationId,
      '审核通过',
      operatorId,
      operatorName,
      {
        previousStatus: originalData.status,
        newStatus: '已通过',
        operationRemark: remark || '改队申请审核通过',
        originalDataSnapshot: originalData,
        newDataSnapshot: application.toJSON()
      }
    );

    await t.commit();
    return application;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

async function rejectApplication(applicationId, operatorId, operatorName, reason) {
  const t = await sequelize.transaction();
  
  try {
    const application = await TeamChangeApplication.findByPk(applicationId, { transaction: t });
    
    if (!application) {
      throw new Error('改队申请不存在');
    }

    await validateStatusTransition(application.status, '已拒绝');

    const originalData = application.toJSON();

    await application.update({
      status: '已拒绝'
    }, { transaction: t });

    await recordHistory(
      applicationId,
      '审核拒绝',
      operatorId,
      operatorName,
      {
        previousStatus: originalData.status,
        newStatus: '已拒绝',
        operationRemark: reason || '改队申请被拒绝',
        originalDataSnapshot: originalData,
        newDataSnapshot: application.toJSON()
      }
    );

    await t.commit();
    return application;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

async function syncInsuranceList(applicationId, operatorId, operatorName) {
  const t = await sequelize.transaction();
  
  try {
    const application = await TeamChangeApplication.findByPk(applicationId, { transaction: t });
    
    if (!application) {
      throw new Error('改队申请不存在');
    }

    if (application.status !== '已通过') {
      throw new Error('只有已通过的申请才能同步保险名单');
    }

    const originalInsurance = await InsuranceList.findOne({
      where: {
        studyProgramId: application.studyProgramId,
        teamId: application.originalTeamId,
        studentId: application.studentId
      },
      transaction: t
    });

    if (!originalInsurance) {
      throw new Error('原分队保险名单中未找到该学生');
    }

    const existingInsurance = await InsuranceList.findOne({
      where: {
        studyProgramId: application.studyProgramId,
        teamId: application.targetTeamId,
        studentId: application.studentId
      },
      transaction: t
    });

    if (existingInsurance) {
      throw new Error('目标分队保险名单中已存在该学生');
    }

    await originalInsurance.update({
      status: '已变更'
    }, { transaction: t });

    await InsuranceList.create({
      studyProgramId: application.studyProgramId,
      teamId: application.targetTeamId,
      studentId: application.studentId,
      studentName: application.studentName,
      studentIdCard: application.studentIdCard,
      insurancePolicyNo: originalInsurance.insurancePolicyNo,
      insuranceType: originalInsurance.insuranceType,
      effectiveDate: originalInsurance.effectiveDate,
      expiryDate: originalInsurance.expiryDate,
      status: '有效',
      lastSyncTime: new Date()
    }, { transaction: t });

    await application.update({
      insuranceSynced: true
    }, { transaction: t });

    await recordHistory(
      applicationId,
      '保险同步',
      operatorId,
      operatorName,
      {
        previousStatus: application.status,
        newStatus: application.status,
        operationRemark: '保险名单同步完成',
        changedFields: ['insuranceSynced']
      }
    );

    await t.commit();
    return { success: true, message: '保险名单同步成功' };
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

async function checkTeamConsistency(applicationId, operatorId, operatorName) {
  const t = await sequelize.transaction();
  
  try {
    const application = await TeamChangeApplication.findByPk(applicationId, { transaction: t });
    
    if (!application) {
      throw new Error('改队申请不存在');
    }

    if (application.status !== '已通过') {
      throw new Error('只有已通过的申请才能校验分队表一致性');
    }

    const originalTeamMember = await TeamMember.findOne({
      where: {
        studyProgramId: application.studyProgramId,
        teamId: application.originalTeamId,
        studentId: application.studentId,
        isActive: true
      },
      transaction: t
    });

    if (!originalTeamMember) {
      throw new Error('原分队表中未找到该学生或该学生已不在队');
    }

    const targetTeamMember = await TeamMember.findOne({
      where: {
        studyProgramId: application.studyProgramId,
        teamId: application.targetTeamId,
        studentId: application.studentId,
        isActive: true
      },
      transaction: t
    });

    if (targetTeamMember) {
      throw new Error('目标分队表中已存在该学生');
    }

    await originalTeamMember.update({
      isActive: false
    }, { transaction: t });

    await TeamMember.create({
      studyProgramId: application.studyProgramId,
      teamId: application.targetTeamId,
      teamName: application.targetTeamName,
      studentId: application.studentId,
      studentName: application.studentName,
      studentIdCard: application.studentIdCard,
      parentContact: application.parentContact,
      role: '队员',
      isActive: true,
      joinTime: new Date()
    }, { transaction: t });

    await application.update({
      teamConsistent: true
    }, { transaction: t });

    await recordHistory(
      applicationId,
      '分队校验',
      operatorId,
      operatorName,
      {
        previousStatus: application.status,
        newStatus: application.status,
        operationRemark: '分队表一致性校验通过',
        changedFields: ['teamConsistent']
      }
    );

    await t.commit();
    return { success: true, message: '分队表一致性校验通过' };
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

async function getApplicationList(query = {}) {
  const { page = 1, pageSize = 10, status, studyProgramId, studentName } = query;
  const offset = (page - 1) * pageSize;
  
  const where = {};
  if (status) where.status = status;
  if (studyProgramId) where.studyProgramId = studyProgramId;
  if (studentName) where.studentName = { [require('sequelize').Op.like]: `%${studentName}%` };

  const { count, rows } = await TeamChangeApplication.findAndCountAll({
    where,
    offset,
    limit: pageSize,
    order: [['createdAt', 'DESC']]
  });

  return {
    total: count,
    page,
    pageSize,
    list: rows
  };
}

async function getApplicationDetail(applicationId) {
  const application = await TeamChangeApplication.findByPk(applicationId, {
    include: [{
      model: TeamChangeHistory,
      as: 'history',
      order: [['operationTime', 'DESC']]
    }]
  });

  if (!application) {
    throw new Error('改队申请不存在');
  }

  return application;
}

async function getApplicationHistory(applicationId) {
  const history = await TeamChangeHistory.findAll({
    where: { applicationId },
    order: [['operationTime', 'DESC']]
  });

  return history.map(item => ({
    ...item.toJSON(),
    changedFields: item.changedFields ? JSON.parse(item.changedFields) : null,
    originalDataSnapshot: item.originalDataSnapshot ? JSON.parse(item.originalDataSnapshot) : null,
    newDataSnapshot: item.newDataSnapshot ? JSON.parse(item.newDataSnapshot) : null
  }));
}

async function updateApplication(applicationId, data, operatorId, operatorName) {
  const t = await sequelize.transaction();
  
  try {
    const application = await TeamChangeApplication.findByPk(applicationId, { transaction: t });
    
    if (!application) {
      throw new Error('改队申请不存在');
    }

    if (application.status !== '草稿') {
      throw new Error('只有草稿状态才能修改');
    }

    const originalData = application.toJSON();
    const changedFields = Object.keys(data);

    await application.update(data, { transaction: t });

    await recordHistory(
      applicationId,
      '修改',
      operatorId,
      operatorName,
      {
        previousStatus: application.status,
        newStatus: application.status,
        operationRemark: '修改改队申请信息',
        changedFields,
        originalDataSnapshot: originalData,
        newDataSnapshot: application.toJSON()
      }
    );

    await t.commit();
    return application;
  } catch (error) {
    await t.rollback();
    throw error;
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
  updateApplication,
  validateStatusTransition
};
