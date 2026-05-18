export class RepairDispatcher {
  constructor(logger) {
    this.logger = logger;
    this.technicians = [
      { id: 'T001', name: '张师傅', skills: ['水电', '空调'], area: '东区' },
      { id: 'T002', name: '李师傅', skills: ['门窗', '家具'], area: '西区' },
      { id: 'T003', name: '王师傅', skills: ['卫浴', '其他'], area: '南区' },
      { id: 'T004', name: '赵师傅', skills: ['网络', '水电'], area: '北区' }
    ];
  }

  dispatch(validRepairs, existingDispatches = []) {
    this.logger.verbose(`开始派单，共 ${validRepairs.length} 条有效报修`);
    
    const unassignedRepairs = validRepairs.filter(repair => {
      return !existingDispatches.some(d => d.id === repair.id);
    });
    
    this.logger.verbose(`其中 ${unassignedRepairs.length} 条为新报修，需要派单`);
    
    const sortedRepairs = this.sortRepairs(unassignedRepairs);
    const dispatches = [...existingDispatches];
    
    for (const repair of sortedRepairs) {
      const assigned = this.assignTechnician(repair);
      dispatches.push(assigned);
      
      if (repair.priority === 'urgent') {
        this.logger.verbose(`急修单已派单: ${repair.id} -> ${assigned.assignedTo}`);
      }
    }
    
    return this.ensureIdempotency(dispatches);
  }

  sortRepairs(repairs) {
    const priorityOrder = { urgent: 0, normal: 1, low: 2 };
    
    return [...repairs].sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      
      return new Date(a.reportTime) - new Date(b.reportTime);
    });
  }

  assignTechnician(repair) {
    const availableTechs = this.technicians.filter(tech => {
      const skillMatch = tech.skills.includes(repair.repairType);
      const areaMatch = !repair.area || tech.area === repair.area;
      return skillMatch || areaMatch;
    });
    
    let selectedTech;
    if (repair.priority === 'urgent') {
      selectedTech = availableTechs[0] || this.technicians[0];
    } else {
      selectedTech = availableTechs.find(t => t.skills.includes(repair.repairType)) ||
                     availableTechs[0] ||
                     this.technicians[0];
    }
    
    return {
      ...repair,
      assignedTo: selectedTech.name,
      technicianId: selectedTech.id,
      assignedTime: new Date().toISOString(),
      status: 'assigned'
    };
  }

  ensureIdempotency(dispatches) {
    const seen = new Map();
    const result = [];
    
    for (const dispatch of dispatches) {
      if (!seen.has(dispatch.id)) {
        seen.set(dispatch.id, dispatch);
        result.push(dispatch);
      }
    }
    
    return this.sortRepairs(result);
  }

  getDispatchSummary(dispatches) {
    const urgent = dispatches.filter(d => d.priority === 'urgent').length;
    const normal = dispatches.filter(d => d.priority === 'normal').length;
    const byTech = {};
    
    for (const dispatch of dispatches) {
      const tech = dispatch.assignedTo || '未分配';
      byTech[tech] = (byTech[tech] || 0) + 1;
    }
    
    return {
      total: dispatches.length,
      urgent,
      normal,
      byTechnician: byTech
    };
  }
}
