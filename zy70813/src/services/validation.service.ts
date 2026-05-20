import moment from 'moment';
import { VesselSchedule, Berth, TideRecord, ValidationRule } from '../types';

export const validationRules: ValidationRule[] = [
  {
    name: '吃水限制规则',
    description: '检查船舶吃水是否在泊位深度限制范围内，结合潮汐情况',
    validate: (schedule, berths, tides) => {
      const berth = berths.find(b => b.id === schedule.berthId);
      
      if (!berth) {
        return {
          valid: false,
          status: 'failed',
          errorReason: `泊位 ${schedule.berthId} 不存在`,
          suggestions: ['请检查泊位编号是否正确', '参考泊位列表确认有效泊位ID']
        };
      }

      if (!berth.isAvailable) {
        return {
          valid: false,
          status: 'pending',
          errorReason: `泊位 ${berth.name} 当前不可用`,
          suggestions: ['联系码头管理员确认泊位状态', '检查是否有维护计划']
        };
      }

      const arrivalMoment = moment(schedule.arrivalTime);
      const departureMoment = moment(schedule.departureTime);
      
      const relevantTides = tides.filter(tide => {
        const tideTime = moment(`${tide.date} ${tide.time}`);
        return tideTime.isBetween(arrivalMoment, departureMoment, 'hour', '[]');
      });

      const minTideHeight = relevantTides.length > 0 
        ? Math.min(...relevantTides.map(t => t.height))
        : berth.minDepth;

      const effectiveMinDepth = berth.minDepth + minTideHeight;
      const requiredDraft = schedule.draft + 0.5;

      if (schedule.draft > berth.maxDepth) {
        return {
          valid: false,
          status: 'failed',
          errorReason: `船舶吃水 ${schedule.draft}m 超过泊位最大深度 ${berth.maxDepth}m`,
          suggestions: [
            '建议减载以降低吃水',
            `选择最大深度大于 ${schedule.draft}m 的泊位`,
            '等待大潮期间进港'
          ]
        };
      }

      if (requiredDraft > effectiveMinDepth) {
        return {
          valid: false,
          status: 'pending',
          errorReason: `考虑潮汐后的有效水深 ${effectiveMinDepth.toFixed(2)}m 不足（需要 ${requiredDraft}m）`,
          suggestions: [
            '调整到高潮时段靠泊',
            '建议减载 0.3-0.5 米',
            `联系引航站确认 ${arrivalMoment.format('MM-DD')} 潮汐窗口`
          ]
        };
      }

      if (schedule.draft > berth.maxDepth * 0.9) {
        return {
          valid: true,
          status: 'pending',
          errorReason: `吃水接近泊位极限，建议确认`,
          suggestions: ['确认船舶实际吃水', '安排实时水深测量']
        };
      }

      return { valid: true, status: 'normal' };
    }
  },

  {
    name: '跨日窗口规则',
    description: '检查装卸窗口是否跨日，以及窗口时长是否合理',
    validate: (schedule, berths) => {
      const arrivalMoment = moment(schedule.arrivalTime);
      const departureMoment = moment(schedule.departureTime);
      
      if (!arrivalMoment.isValid() || !departureMoment.isValid()) {
        return {
          valid: false,
          status: 'failed',
          errorReason: '时间格式无效',
          suggestions: ['请使用 ISO 格式 (YYYY-MM-DDTHH:mm:ss)', '检查日期是否正确']
        };
      }

      if (departureMoment.isBefore(arrivalMoment)) {
        return {
          valid: false,
          status: 'failed',
          errorReason: '离港时间早于到港时间',
          suggestions: ['请核对到港和离港时间', '确认船期表是否颠倒']
        };
      }

      const durationHours = departureMoment.diff(arrivalMoment, 'hours');
      
      if (durationHours < 2) {
        return {
          valid: false,
          status: 'failed',
          errorReason: `装卸窗口过短（${durationHours}小时）`,
          suggestions: ['至少需要2小时完成靠离泊作业', '请延长停泊时间']
        };
      }

      if (durationHours > 72) {
        return {
          valid: false,
          status: 'pending',
          errorReason: `停泊时间过长（${durationHours}小时）`,
          suggestions: ['确认是否需要这么长的停泊时间', '考虑分批次作业']
        };
      }

      const isCrossDay = !arrivalMoment.isSame(departureMoment, 'day');
      
      if (isCrossDay) {
        const berth = berths.find(b => b.id === schedule.berthId);
        const nightOperationAllowed = berth?.allowedCargoTypes.includes(schedule.cargoType);
        
        if (!nightOperationAllowed && schedule.cargoType === '危险品') {
          return {
            valid: false,
            status: 'pending',
            errorReason: '危险品跨日作业需要特别审批',
            suggestions: ['申请夜间作业许可', '调整到日间作业窗口']
          };
        }

        return {
          valid: true,
          status: 'pending',
          errorReason: '跨日作业，需确认夜班安排',
          suggestions: ['通知夜班调度', '确认拖轮 availability']
        };
      }

      return { valid: true, status: 'normal' };
    }
  },

  {
    name: '临时插队规则',
    description: '检查泊位时间冲突，处理优先级船舶插队合理性',
    validate: (schedule, berths, tides, existingSchedules) => {
      const berthSchedules = existingSchedules.filter(
        s => s.berthId === schedule.berthId && s.status !== 'failed'
      );

      const arrivalMoment = moment(schedule.arrivalTime);
      const departureMoment = moment(schedule.departureTime);

      const conflictingSchedules = berthSchedules.filter(s => {
        const sArrival = moment(s.arrivalTime);
        const sDeparture = moment(s.departureTime);
        return arrivalMoment.isBetween(sArrival, sDeparture, 'minute', '[]') ||
               departureMoment.isBetween(sArrival, sDeparture, 'minute', '[]') ||
               sArrival.isBetween(arrivalMoment, departureMoment, 'minute', '[]');
      });

      if (conflictingSchedules.length > 0) {
        const conflictVessels = conflictingSchedules.map(s => s.vesselName).join(', ');

        if (schedule.isPriority) {
          if (!schedule.confirmedByAgent) {
            return {
              valid: false,
              status: 'pending',
              errorReason: `优先级船舶与现有船期冲突：${conflictVessels}`,
              suggestions: [
                '需要船代书面确认插队申请',
                '联系受影响船舶的船代协调',
                '考虑调整到其他空闲泊位'
              ]
            };
          }

          return {
            valid: true,
            status: 'pending',
            errorReason: `插队已确认，需通知受影响的 ${conflictVessels}`,
            suggestions: ['立即通知调度室调整计划', '准备补偿方案']
          };
        }

        return {
          valid: false,
          status: 'failed',
          errorReason: `与已有船期时间冲突：${conflictVessels}`,
          suggestions: [
            '调整到其他泊位',
            '修改作业时间窗口',
            '如需插队请设置优先级并提交插队申请'
          ]
        };
      }

      if (schedule.isPriority && !schedule.confirmedByAgent) {
        return {
          valid: true,
          status: 'pending',
          errorReason: '优先级船舶需要船代确认',
          suggestions: ['请上传船代确认函', '联系代理完成确认流程']
        };
      }

      return { valid: true, status: 'normal' };
    }
  },

  {
    name: '货种匹配规则',
    description: '检查泊位是否允许该类货物作业',
    validate: (schedule, berths) => {
      const berth = berths.find(b => b.id === schedule.berthId);
      
      if (!berth) {
        return {
          valid: false,
          status: 'failed',
          errorReason: `泊位 ${schedule.berthId} 不存在`,
          suggestions: ['请检查泊位编号']
        };
      }

      if (!berth.allowedCargoTypes.includes(schedule.cargoType)) {
        return {
          valid: false,
          status: 'failed',
          errorReason: `泊位 ${berth.name} 不允许 ${schedule.cargoType} 作业`,
          suggestions: [
            `允许的货种: ${berth.allowedCargoTypes.join(', ')}`,
            '请选择合适的泊位'
          ]
        };
      }

      if (schedule.cargoType === '危险品' && !schedule.confirmedByAgent) {
        return {
          valid: false,
          status: 'pending',
          errorReason: '危险品作业需要船代确认',
          suggestions: ['提交危险品申报单', '获得海事部门批准']
        };
      }

      return { valid: true, status: 'normal' };
    }
  },

  {
    name: '维护期冲突规则',
    description: '检查泊位维护期冲突',
    validate: (schedule, berths) => {
      const berth = berths.find(b => b.id === schedule.berthId);
      
      if (!berth || !berth.maintenanceStart || !berth.maintenanceEnd) {
        return { valid: true, status: 'normal' };
      }

      const arrivalMoment = moment(schedule.arrivalTime);
      const departureMoment = moment(schedule.departureTime);
      const maintenanceStart = moment(berth.maintenanceStart);
      const maintenanceEnd = moment(berth.maintenanceEnd);

      const hasConflict = arrivalMoment.isBetween(maintenanceStart, maintenanceEnd, 'minute', '[]') ||
                         departureMoment.isBetween(maintenanceStart, maintenanceEnd, 'minute', '[]') ||
                         maintenanceStart.isBetween(arrivalMoment, departureMoment, 'minute', '[]');

      if (hasConflict) {
        return {
          valid: false,
          status: 'failed',
          errorReason: `船期与泊位维护期冲突（${maintenanceStart.format('MM-DD')} 至 ${maintenanceEnd.format('MM-DD')}）`,
          suggestions: [
            '调整到维护期后作业',
            '联系工程部门确认维护是否可延期'
          ]
        };
      }

      return { valid: true, status: 'normal' };
    }
  }
];

export function validateSchedule(
  schedule: VesselSchedule,
  berths: Berth[],
  tides: TideRecord[],
  existingSchedules: VesselSchedule[]
): {
  status: 'normal' | 'pending' | 'failed';
  errorReason?: string;
  suggestions: string[];
  violatedRules: string[];
} {
  let finalStatus: 'normal' | 'pending' | 'failed' = 'normal';
  const allSuggestions: string[] = [];
  const allErrors: string[] = [];
  const violatedRules: string[] = [];

  for (const rule of validationRules) {
    const result = rule.validate(schedule, berths, tides, existingSchedules);
    
    if (!result.valid || result.status !== 'normal') {
      violatedRules.push(rule.name);
      
      if (result.status === 'failed') {
        finalStatus = 'failed';
      } else if (result.status === 'pending' && finalStatus !== 'failed') {
        finalStatus = 'pending';
      }

      if (result.errorReason) {
        allErrors.push(result.errorReason);
      }

      if (result.suggestions) {
        allSuggestions.push(...result.suggestions);
      }
    }
  }

  return {
    status: finalStatus,
    errorReason: allErrors.join('; '),
    suggestions: [...new Set(allSuggestions)],
    violatedRules
  };
}