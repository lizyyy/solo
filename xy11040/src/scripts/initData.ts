import { processingOrderService } from '../services/processingOrderService';
import { reworkService } from '../services/reworkService';
import { dataStore } from '../store/dataStore';
import { ProcessingOrderStatus, ReworkStatus, ReworkReason } from '../types';

export function initSampleData() {
  dataStore.clearAll();

  const order1Result = processingOrderService.createProcessingOrder({
    customerName: '张三',
    customerPhone: '138****1234',
    frameModel: '雷朋 RB3447',
    frameColor: '黑色',
    odPrescription: {
      sphere: -2.50,
      cylinder: -1.25,
      axis: 180,
      add: +1.50
    },
    osPrescription: {
      sphere: -2.75,
      cylinder: -1.00,
      axis: 10,
      add: +1.50
    },
    lensSpec: {
      material: '树脂',
      index: 1.67,
      coating: ['防蓝光', '防紫外线', '防刮'],
      design: '渐进多焦点',
      diameter: 70,
      thickness: 1.5
    },
    createdBy: '王验光师',
    notes: '顾客要求超薄镜片， frame 已确认库存'
  });

  const order1 = order1Result.data!;

  setTimeout(() => {
    processingOrderService.updateProcessingOrderStatus({
      processingOrderId: order1.id,
      targetStatus: ProcessingOrderStatus.IN_PRODUCTION,
      performedBy: '李主管',
      userRole: 'supervisor',
      assignedTechnician: '赵技师'
    });
  }, 100);

  setTimeout(() => {
    processingOrderService.updateProcessingOrderStatus({
      processingOrderId: order1.id,
      targetStatus: ProcessingOrderStatus.QUALITY_CHECK,
      performedBy: '赵技师',
      userRole: 'technician'
    });
  }, 200);

  const order2Result = processingOrderService.createProcessingOrder({
    customerName: '李四',
    customerPhone: '139****5678',
    frameModel: '欧克利 OO9208',
    frameColor: '枪灰色',
    odPrescription: {
      sphere: -4.00,
      cylinder: -1.75,
      axis: 90,
      add: +2.00
    },
    osPrescription: {
      sphere: -3.75,
      cylinder: -1.50,
      axis: 85,
      add: +2.00
    },
    lensSpec: {
      material: 'PC',
      index: 1.59,
      coating: ['防紫外线', '防眩光'],
      design: '单光',
      diameter: 65,
      thickness: 2.0
    },
    createdBy: '孙验光师',
    notes: '运动眼镜，需要抗冲击镜片'
  });

  const order2 = order2Result.data!;

  setTimeout(() => {
    processingOrderService.updateProcessingOrderStatus({
      processingOrderId: order2.id,
      targetStatus: ProcessingOrderStatus.IN_PRODUCTION,
      performedBy: '李主管',
      userRole: 'supervisor',
      assignedTechnician: '钱技师'
    });
  }, 300);

  setTimeout(() => {
    processingOrderService.updateProcessingOrderStatus({
      processingOrderId: order2.id,
      targetStatus: ProcessingOrderStatus.QUALITY_CHECK,
      performedBy: '钱技师',
      userRole: 'technician'
    });
  }, 400);

  setTimeout(() => {
    const reworkResult = reworkService.createReworkReport({
      processingOrderNumber: order2.orderNumber,
      reporter: '周质检',
      reporterRole: 'qc',
      reworkItems: [
        {
          eye: 'OD',
          reason: ReworkReason.AXIS_WRONG,
          description: '右眼散光轴位实际加工为 85 度，与处方 90 度不符',
          originalAxis: 90,
          correctedAxis: 90
        },
        {
          eye: 'OS',
          reason: ReworkReason.SURFACE_DEFECT,
          description: '左眼镜片表面有划痕，影响外观',
          originalAxis: 85,
          correctedAxis: 85
        }
      ],
      rootCause: '设备参数设置错误',
      correctiveAction: '重新磨边，调整设备校准',
      source: 'qc_system',
      userRole: 'qc'
    });

    if (reworkResult.data) {
      const reworkReport = reworkResult.data;

      setTimeout(() => {
        reworkService.updateReworkStatus({
          reworkReportId: reworkReport.id,
          targetStatus: ReworkStatus.REVIEWING,
          performedBy: '李主管',
          userRole: 'supervisor'
        });
      }, 100);

      setTimeout(() => {
        reworkService.updateReworkStatus({
          reworkReportId: reworkReport.id,
          targetStatus: ReworkStatus.APPROVED,
          performedBy: '李主管',
          userRole: 'supervisor',
          reviewComments: '同意返工，轴位错误需要严格按照处方执行'
        });
      }, 200);

      setTimeout(() => {
        reworkService.updateReworkStatus({
          reworkReportId: reworkReport.id,
          targetStatus: ReworkStatus.IN_REWORK,
          performedBy: '钱技师',
          userRole: 'technician',
          assignedTo: '钱技师'
        });
      }, 300);

      setTimeout(() => {
        reworkService.updateReworkStatus({
          reworkReportId: reworkReport.id,
          targetStatus: ReworkStatus.REWORK_COMPLETED,
          performedBy: '钱技师',
          userRole: 'technician'
        });
      }, 400);

      setTimeout(() => {
        reworkService.updateReworkStatus({
          reworkReportId: reworkReport.id,
          targetStatus: ReworkStatus.FINAL_INSPECTION,
          performedBy: '周质检',
          userRole: 'qc'
        });
      }, 500);
    }
  }, 500);

  const order3Result = processingOrderService.createProcessingOrder({
    customerName: '王五',
    customerPhone: '137****9012',
    frameModel: '精工 H01046',
    frameColor: '金色',
    odPrescription: {
      sphere: -6.00,
      cylinder: -2.00,
      axis: 45,
      add: +1.75
    },
    osPrescription: {
      sphere: -5.50,
      cylinder: -1.75,
      axis: 135,
      add: +1.75
    },
    lensSpec: {
      material: '树脂',
      index: 1.74,
      coating: ['防蓝光', '防紫外线', '防雾'],
      design: '双光',
      diameter: 75,
      thickness: 1.2
    },
    createdBy: '王验光师',
    notes: '高度近视，要求最薄镜片'
  });

  const order3 = order3Result.data!;

  setTimeout(() => {
    processingOrderService.updateProcessingOrderStatus({
      processingOrderId: order3.id,
      targetStatus: ProcessingOrderStatus.IN_PRODUCTION,
      performedBy: '李主管',
      userRole: 'supervisor',
      assignedTechnician: '孙技师'
    });
  }, 600);

  setTimeout(() => {
    processingOrderService.updateProcessingOrderStatus({
      processingOrderId: order3.id,
      targetStatus: ProcessingOrderStatus.QUALITY_CHECK,
      performedBy: '孙技师',
      userRole: 'technician'
    });
  }, 700);

  setTimeout(() => {
    processingOrderService.updateProcessingOrderStatus({
      processingOrderId: order3.id,
      targetStatus: ProcessingOrderStatus.COMPLETED,
      performedBy: '周质检',
      userRole: 'qc'
    });
  }, 800);

  return {
    processingOrders: [
      {
        orderNumber: order1.orderNumber,
        customer: order1.customerName,
        status: order1.status,
        description: '加工单流程演示 - 待质检'
      },
      {
        orderNumber: order2.orderNumber,
        customer: order2.customerName,
        status: order2.status,
        reworkCount: order2.reworkCount,
        description: '返工完整链路演示 - 轴位错误返工，返工流程进行中'
      },
      {
        orderNumber: order3.orderNumber,
        customer: order3.customerName,
        status: order3.status,
        description: '正常完成演示 - 质检通过，已完成'
      }
    ],
    axisSyncDemo: {
      description: '散光轴位一致性校验演示',
      scenario: '加工单轴位与返工报告修正轴位不一致时，系统自动检测并支持一键同步',
      steps: [
        '1. 创建加工单，设定处方轴位',
        '2. 质检发现轴位错误，创建返工报告',
        '3. 系统自动检测轴位不一致问题',
        '4. 调用同步接口将修正轴位同步到加工单'
      ]
    },
    statusTransitions: {
      allowed: '状态机控制，仅允许合法转换',
      rejected: '非法转换会被拒绝并返回允许的转换列表',
      roleBased: '基于角色权限控制，不同角色有不同操作权限'
    }
  };
}
