import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { Project, OperationLog, ChangeHistory, ConstructionNode, OwnerVote, BudgetQuote, PublicObjection } from '../models';

export const exportReport = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { responsiblePerson, startDate, endDate } = req.query;
    
    const project = await Project.findByPk(projectId, {
      include: [
        { association: 'votes' },
        { association: 'quotes' },
        { association: 'nodes', order: [['nodeOrder', 'ASC']] },
        { association: 'photos' },
        { association: 'objections' },
        { association: 'changeHistories', order: [['changeTime', 'DESC']] },
        { association: 'operationLogs', order: [['operationTime', 'DESC']] }
      ]
    });
    
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '维修基金管理系统';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('项目报告');

    worksheet.columns = [
      { header: '项目名称', key: 'name', width: 30 },
      { header: '位置', key: 'location', width: 20 },
      { header: '责任人', key: 'responsiblePerson', width: 15 },
      { header: '当前状态', key: 'status', width: 15 },
      { header: '预算金额', key: 'estimatedAmount', width: 15 },
      { header: '实际金额', key: 'actualAmount', width: 15 }
    ];

    worksheet.addRow({
      name: project.name,
      location: project.location,
      responsiblePerson: project.responsiblePerson,
      status: project.status,
      estimatedAmount: project.estimatedAmount,
      actualAmount: project.actualAmount
    });

    worksheet.addRow([]);
    worksheet.addRow(['责任节点明细']);
    worksheet.addRow(['节点名称', '责任人', '完成时间', '扣减金额', '状态', '备注']);

    const nodes = (project as any).nodes || [];
    for (const node of nodes) {
      let filtered = true;
      if (responsiblePerson && node.completedBy !== responsiblePerson) filtered = false;
      if (startDate && node.completedTime && new Date(node.completedTime) < new Date(startDate as string)) filtered = false;
      if (endDate && node.completedTime && new Date(node.completedTime) > new Date(endDate as string)) filtered = false;
      
      if (filtered || !node.completedTime) {
        worksheet.addRow([
          node.nodeName,
          node.completedBy || '-',
          node.completedTime ? new Date(node.completedTime).toLocaleDateString() : '-',
          node.deductionAmount || 0,
          node.isCompleted ? '已完成' : '未完成',
          node.remarks || ''
        ]);
      }
    }

    worksheet.addRow([]);
    worksheet.addRow(['修改历史记录']);
    worksheet.addRow(['实体类型', '字段', '旧值', '新值', '修改人', '修改时间']);

    const histories = (project as any).changeHistories || [];
    for (const history of histories) {
      let filtered = true;
      if (responsiblePerson && history.changedBy !== responsiblePerson) filtered = false;
      if (startDate && new Date(history.changeTime) < new Date(startDate as string)) filtered = false;
      if (endDate && new Date(history.changeTime) > new Date(endDate as string)) filtered = false;
      
      if (filtered) {
        worksheet.addRow([
          history.entityType,
          history.fieldName,
          history.oldValue || '-',
          history.newValue || '-',
          history.changedBy,
          new Date(history.changeTime).toLocaleDateString()
        ]);
      }
    }

    worksheet.addRow([]);
    worksheet.addRow(['操作日志']);
    worksheet.addRow(['操作类型', '内容', '操作人', '操作时间', '状态变更']);

    const logs = (project as any).operationLogs || [];
    for (const log of logs) {
      let filtered = true;
      if (responsiblePerson && log.operator !== responsiblePerson) filtered = false;
      if (startDate && new Date(log.operationTime) < new Date(startDate as string)) filtered = false;
      if (endDate && new Date(log.operationTime) > new Date(endDate as string)) filtered = false;
      
      if (filtered) {
        worksheet.addRow([
          log.operationType,
          log.operationContent,
          log.operator,
          new Date(log.operationTime).toLocaleDateString(),
          log.fromStatus ? `${log.fromStatus} → ${log.toStatus}` : '-'
        ]);
      }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=project-report-${projectId}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: '导出报告失败' });
  }
};

export const getReportData = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { responsiblePerson, startDate, endDate } = req.query;
    
    const project = await Project.findByPk(projectId, {
      include: [
        { association: 'votes' },
        { association: 'quotes' },
        { association: 'nodes', order: [['nodeOrder', 'ASC']] },
        { association: 'photos' },
        { association: 'objections' },
        { association: 'changeHistories', order: [['changeTime', 'DESC']] },
        { association: 'operationLogs', order: [['operationTime', 'DESC']] }
      ]
    });
    
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    const projectData = project.toJSON();
    
    const filterByPersonAndDate = (item: any, personField: string, dateField: string) => {
      if (responsiblePerson && item[personField] !== responsiblePerson) return false;
      if (startDate && item[dateField] && new Date(item[dateField]) < new Date(startDate as string)) return false;
      if (endDate && item[dateField] && new Date(item[dateField]) > new Date(endDate as string)) return false;
      return true;
    };

    const filteredNodes = projectData.nodes.filter((n: any) => 
      filterByPersonAndDate(n, 'completedBy', 'completedTime')
    );
    
    const filteredHistories = projectData.changeHistories.filter((h: any) => 
      filterByPersonAndDate(h, 'changedBy', 'changeTime')
    );
    
    const filteredLogs = projectData.operationLogs.filter((l: any) => 
      filterByPersonAndDate(l, 'operator', 'operationTime')
    );

    const report = {
      project: {
        name: projectData.name,
        location: projectData.location,
        responsiblePerson: projectData.responsiblePerson,
        status: projectData.status,
        estimatedAmount: projectData.estimatedAmount,
        actualAmount: projectData.actualAmount
      },
      responsibilityNodes: filteredNodes.map((n: any) => ({
        nodeName: n.nodeName,
        responsiblePerson: n.completedBy || '-',
        completedTime: n.completedTime,
        deductionAmount: n.deductionAmount,
        isCompleted: n.isCompleted,
        remarks: n.remarks
      })),
      changeHistories: filteredHistories.map((h: any) => ({
        entityType: h.entityType,
        fieldName: h.fieldName,
        oldValue: h.oldValue,
        newValue: h.newValue,
        changedBy: h.changedBy,
        changeTime: h.changeTime
      })),
      operationLogs: filteredLogs.map((l: any) => ({
        operationType: l.operationType,
        operationContent: l.operationContent,
        operator: l.operator,
        operationTime: l.operationTime,
        statusTransition: l.fromStatus ? `${l.fromStatus} → ${l.toStatus}` : null
      }))
    };

    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取报告数据失败' });
  }
};
