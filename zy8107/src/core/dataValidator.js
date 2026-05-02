export class DataValidator {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
  }

  validateAll() {
    const issues = [];
    
    issues.push(...this.checkCrossDayLifts());
    issues.push(...this.checkMissingParameters());
    issues.push(...this.checkLiftPlanConsistency());
    issues.push(...this.checkCraneSpecsConsistency());
    
    return issues;
  }

  checkCrossDayLifts() {
    const issues = [];
    const liftPlan = this.dataLoader.liftPlan;
    
    if (!liftPlan || liftPlan.length === 0) {
      return issues;
    }
    
    liftPlan.forEach(lift => {
      if (lift.start_time && lift.end_time) {
        const startDay = lift.start_time.toDateString();
        const endDay = lift.end_time.toDateString();
        
        if (startDay !== endDay) {
          issues.push({
            type: 'cross_day',
            severity: 'warning',
            category: '施工时间',
            lift_id: lift.lift_id,
            lift_name: lift.lift_name,
            title: '跨天施工',
            message: `吊装任务 "${lift.lift_name}" 涉及跨天作业`,
            details: {
              start_time: lift.start_time.toISOString(),
              end_time: lift.end_time.toISOString(),
              start_day: startDay,
              end_day: endDay,
              duration_hours: this.calculateDuration(lift.start_time, lift.end_time)
            },
            suggestion: '建议申请夜间施工许可，安排充足的照明和人员配置'
          });
        }
        
        const hour = lift.start_time.getHours();
        if (hour >= 22 || hour < 6) {
          issues.push({
            type: 'night_work',
            severity: 'warning',
            category: '施工时间',
            lift_id: lift.lift_id,
            lift_name: lift.lift_name,
            title: '夜间施工',
            message: `吊装任务 "${lift.lift_name}" 安排在夜间作业`,
            details: {
              start_time: lift.start_time.toISOString(),
              start_hour: hour
            },
            suggestion: '夜间施工需要特殊安全措施，建议增加照明和监护人员'
          });
        }
      }
    });
    
    return issues;
  }

  checkMissingParameters() {
    const issues = [];
    
    const siteLayout = this.dataLoader.siteLayout;
    if (siteLayout && siteLayout.missing_params_notes) {
      siteLayout.missing_params_notes.forEach(note => {
        issues.push({
          type: 'missing_param',
          severity: note.severity === 'high' ? 'danger' : 'warning',
          category: '参数缺失',
          title: `参数缺失: ${note.param}`,
          message: note.suggestion,
          details: {
            param: note.param,
            severity: note.severity
          },
          suggestion: note.suggestion
        });
      });
    }
    
    const craneSpecs = this.dataLoader.craneSpecs;
    if (craneSpecs && craneSpecs.missing_params) {
      craneSpecs.missing_params.forEach(missing => {
        const crane = this.dataLoader.getCraneById(missing.crane_id);
        const craneName = crane ? crane.name : missing.crane_id;
        
        missing.params.forEach(param => {
          issues.push({
            type: 'missing_param',
            severity: param.severity === 'high' ? 'danger' : 'warning',
            category: '参数缺失',
            crane_id: missing.crane_id,
            crane_name: craneName,
            title: `吊机参数缺失: ${param.name}`,
            message: param.description,
            details: {
              crane_id: missing.crane_id,
              param_name: param.name,
              severity: param.severity
            },
            suggestion: param.description
          });
        });
      });
    }
    
    const liftPlan = this.dataLoader.liftPlan;
    if (liftPlan) {
      liftPlan.forEach(lift => {
        const missingFields = [];
        
        if (!lift.weight || lift.weight <= 0) {
          missingFields.push('吊装重量');
        }
        if (!lift.crane_id) {
          missingFields.push('吊机ID');
        }
        if (!lift.boom_length || lift.boom_length <= 0) {
          missingFields.push('吊臂长度');
        }
        if (!lift.start_time) {
          missingFields.push('开始时间');
        }
        if (!lift.end_time) {
          missingFields.push('结束时间');
        }
        
        if (missingFields.length > 0) {
          issues.push({
            type: 'missing_param',
            severity: 'danger',
            category: '参数缺失',
            lift_id: lift.lift_id,
            lift_name: lift.lift_name,
            title: `吊装任务参数不完整`,
            message: `吊装任务 "${lift.lift_name}" 缺少以下参数: ${missingFields.join('、')}`,
            details: {
              lift_id: lift.lift_id,
              missing_fields: missingFields
            },
            suggestion: '请补充缺失的参数后重新进行预演'
          });
        }
        
        if (lift.crane_id) {
          const crane = this.dataLoader.getCraneById(lift.crane_id);
          if (!crane) {
            issues.push({
              type: 'invalid_reference',
              severity: 'danger',
              category: '数据错误',
              lift_id: lift.lift_id,
              lift_name: lift.lift_name,
              title: '无效的吊机引用',
              message: `吊装任务 "${lift.lift_name}" 引用的吊机 "${lift.crane_id}" 不存在`,
              details: {
                lift_id: lift.lift_id,
                crane_id: lift.crane_id
              },
              suggestion: '请检查吊机ID是否正确或在吊机规格中添加该吊机'
            });
          }
        }
      });
    }
    
    return issues;
  }

  checkLiftPlanConsistency() {
    const issues = [];
    const liftPlan = this.dataLoader.liftPlan;
    
    if (!liftPlan || liftPlan.length < 2) {
      return issues;
    }
    
    const craneTimeSlots = {};
    
    liftPlan.forEach(lift => {
      if (lift.crane_id && lift.start_time && lift.end_time) {
        if (!craneTimeSlots[lift.crane_id]) {
          craneTimeSlots[lift.crane_id] = [];
        }
        craneTimeSlots[lift.crane_id].push({
          lift_id: lift.lift_id,
          lift_name: lift.lift_name,
          start: lift.start_time,
          end: lift.end_time
        });
      }
    });
    
    Object.keys(craneTimeSlots).forEach(craneId => {
      const slots = craneTimeSlots[craneId];
      const crane = this.dataLoader.getCraneById(craneId);
      const craneName = crane ? crane.name : craneId;
      
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          if (this.timeSlotsOverlap(slots[i], slots[j])) {
            issues.push({
              type: 'time_conflict',
              severity: 'danger',
              category: '时间冲突',
              crane_id: craneId,
              crane_name: craneName,
              title: '吊机时间冲突',
              message: `吊机 "${craneName}" 在同一时间分配了多个吊装任务`,
              details: {
                crane_id: craneId,
                conflict_lifts: [
                  { lift_id: slots[i].lift_id, lift_name: slots[i].lift_name, start: slots[i].start.toISOString(), end: slots[i].end.toISOString() },
                  { lift_id: slots[j].lift_id, lift_name: slots[j].lift_name, start: slots[j].start.toISOString(), end: slots[j].end.toISOString() }
                ]
              },
              suggestion: '请调整吊装计划，避免同一吊机在同一时间执行多个任务'
            });
          }
        }
      }
    });
    
    return issues;
  }

  checkCraneSpecsConsistency() {
    const issues = [];
    const craneSpecs = this.dataLoader.craneSpecs;
    
    if (!craneSpecs || !craneSpecs.cranes) {
      return issues;
    }
    
    craneSpecs.cranes.forEach(crane => {
      if (crane.boom && crane.boom.load_chart) {
        crane.boom.load_chart.forEach(chart => {
          if (!chart.radius_data || chart.radius_data.length === 0) {
            issues.push({
              type: 'invalid_spec',
              severity: 'warning',
              category: '规格错误',
              crane_id: crane.crane_id,
              crane_name: crane.name,
              title: '吊机载荷表不完整',
              message: `吊机 "${crane.name}" 吊臂长度 ${chart.boom_length}m 的载荷表为空`,
              details: {
                crane_id: crane.crane_id,
                boom_length: chart.boom_length
              },
              suggestion: '请补充完整的吊机载荷表数据'
            });
          }
        });
      }
    });
    
    return issues;
  }

  timeSlotsOverlap(slot1, slot2) {
    return slot1.start < slot2.end && slot2.start < slot1.end;
  }

  calculateDuration(start, end) {
    if (!start || !end) return 0;
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  }
}
