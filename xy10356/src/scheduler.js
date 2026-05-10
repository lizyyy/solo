class Scheduler {
  constructor(dataStore) {
    this.store = dataStore;
  }

  isTimeOverlap(start1, end1, start2, end2) {
    return start1 < end2 && start2 < end1;
  }

  isDateOverlap(date1Start, date1End, date2Start, date2End) {
    return new Date(date1Start) <= new Date(date2End) && new Date(date2Start) <= new Date(date1End);
  }

  validateContract(contract) {
    const errors = [];
    if (!contract.id) errors.push('合同ID不能为空');
    if (!contract.client) errors.push('客户名称不能为空');
    if (!contract.startDate) errors.push('合同开始日期不能为空');
    if (!contract.endDate) errors.push('合同结束日期不能为空');
    if (new Date(contract.startDate) > new Date(contract.endDate)) {
      errors.push('合同开始日期不能晚于结束日期');
    }
    if (typeof contract.giftDays !== 'number' || contract.giftDays < 0) {
      errors.push('赠送天数限制必须是非负数');
    }
    if (!contract.placements || !Array.isArray(contract.placements) || contract.placements.length === 0) {
      errors.push('合同必须包含至少一个投放时段');
    }
    return errors;
  }

  validatePlacement(placement, contract) {
    const errors = [];
    const screens = this.store.getScreens();
    
    if (!placement.screenId) {
      errors.push('投放时段必须指定屏幕ID');
    } else if (!screens.find(s => s.id === placement.screenId)) {
      errors.push(`屏幕 ${placement.screenId} 不存在`);
    }
    
    if (!placement.date) errors.push('投放日期不能为空');
    
    if (placement.date < contract.startDate || placement.date > contract.endDate) {
      errors.push(`投放日期 ${placement.date} 不在合同有效期 [${contract.startDate}, ${contract.endDate}] 内`);
    }
    
    if (!placement.startTime || !placement.endTime) {
      errors.push('投放时段必须指定开始和结束时间');
    } else if (placement.startTime >= placement.endTime) {
      errors.push('开始时间必须早于结束时间');
    }
    
    return errors;
  }

  validateGift(gift, contract) {
    const errors = [];
    const screens = this.store.getScreens();
    const gifts = this.store.getGifts().filter(g => g.contractId === contract.id);
    const totalGiftDays = gifts.reduce((sum, g) => sum + g.days, 0);
    
    if (!gift.screenId || !screens.find(s => s.id === gift.screenId)) {
      errors.push(`赠送时段的屏幕 ${gift.screenId} 不存在`);
    }
    
    if (!gift.startDate || !gift.endDate) {
      errors.push('赠送时段必须指定开始和结束日期');
    } else if (new Date(gift.startDate) > new Date(gift.endDate)) {
      errors.push('赠送开始日期不能晚于结束日期');
    }
    
    const giftDays = Math.ceil((new Date(gift.endDate) - new Date(gift.startDate)) / (1000 * 60 * 60 * 24)) + 1;
    if (totalGiftDays + giftDays > contract.giftDays) {
      errors.push(`赠送天数超过合同限制: 已使用 ${totalGiftDays} 天, 本次申请 ${giftDays} 天, 合同限制 ${contract.giftDays} 天`);
    }
    
    return errors;
  }

  validateChange(change) {
    const errors = [];
    const contracts = this.store.getContracts();
    const contract = contracts.find(c => c.id === change.contractId);
    
    if (!contract) {
      errors.push(`合同 ${change.contractId} 不存在`);
    }
    
    if (!change.newMaterial && !change.materialUploaded) {
      errors.push('换刊申请必须提供新素材或标记素材已上传');
    }
    
    if (!change.effectiveDate) {
      errors.push('换刊申请必须指定生效日期');
    }
    
    return errors;
  }

  checkPlacementConflict(newPlacement) {
    const conflicts = [];
    const allPlacements = this.store.getPlacements();
    
    for (const existing of allPlacements) {
      if (existing.screenId === newPlacement.screenId &&
          existing.date === newPlacement.date &&
          this.isTimeOverlap(
            this.timeToMinutes(existing.startTime),
            this.timeToMinutes(existing.endTime),
            this.timeToMinutes(newPlacement.startTime),
            this.timeToMinutes(newPlacement.endTime)
          )) {
        conflicts.push({
          type: 'time-overlap',
          screenId: newPlacement.screenId,
          date: newPlacement.date,
          existing: {
            contractId: existing.contractId,
            startTime: existing.startTime,
            endTime: existing.endTime
          },
          new: {
            contractId: newPlacement.contractId,
            startTime: newPlacement.startTime,
            endTime: newPlacement.endTime
          },
          message: `屏幕 ${newPlacement.screenId} 在 ${newPlacement.date} 时段 [${newPlacement.startTime}-${newPlacement.endTime}] 与已有投放冲突`
        });
      }
    }
    
    return conflicts;
  }

  checkGiftConflict(gift) {
    const conflicts = [];
    const allPlacements = this.store.getPlacements();
    const allGifts = this.store.getGifts();
    
    const giftStart = new Date(gift.startDate);
    const giftEnd = new Date(gift.endDate);
    
    for (const placement of allPlacements) {
      if (placement.screenId === gift.screenId &&
          placement.date >= gift.startDate && 
          placement.date <= gift.endDate) {
        if (this.isTimeOverlap(
          this.timeToMinutes(placement.startTime),
          this.timeToMinutes(placement.endTime),
          this.timeToMinutes(gift.startTime),
          this.timeToMinutes(gift.endTime)
        )) {
          conflicts.push({
            type: 'gift-conflict-with-placement',
            screenId: gift.screenId,
            date: placement.date,
            placement: {
              contractId: placement.contractId,
              startTime: placement.startTime,
              endTime: placement.endTime
            },
            gift: {
              contractId: gift.contractId,
              startTime: gift.startTime,
              endTime: gift.endTime
            },
            message: `赠送时段与屏幕 ${gift.screenId} 在 ${placement.date} 的已有投放冲突`
          });
        }
      }
    }
    
    for (const existingGift of allGifts) {
      if (existingGift.screenId === gift.screenId &&
          this.isDateOverlap(existingGift.startDate, existingGift.endDate, gift.startDate, gift.endDate)) {
        if (this.isTimeOverlap(
          this.timeToMinutes(existingGift.startTime),
          this.timeToMinutes(existingGift.endTime),
          this.timeToMinutes(gift.startTime),
          this.timeToMinutes(gift.endTime)
        )) {
          conflicts.push({
            type: 'gift-conflict-with-gift',
            screenId: gift.screenId,
            existingGift: existingGift,
            newGift: gift,
            message: `赠送时段与屏幕 ${gift.screenId} 的已有赠送时段冲突`
          });
        }
      }
    }
    
    return conflicts;
  }

  timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  importContract(contractData) {
    const errors = [];
    const warnings = [];
    const contracts = this.store.getContracts();
    
    if (contracts.find(c => c.id === contractData.id)) {
      errors.push(`合同 ${contractData.id} 已存在，不能重复导入`);
      return { success: false, errors, warnings };
    }
    
    const contractErrors = this.validateContract(contractData);
    errors.push(...contractErrors);
    
    if (errors.length > 0) {
      return { success: false, errors, warnings };
    }
    
    const validPlacements = [];
    for (const placement of contractData.placements) {
      const fullPlacement = {
        ...placement,
        contractId: contractData.id,
        client: contractData.client
      };
      
      const placementErrors = this.validatePlacement(fullPlacement, contractData);
      const placementConflicts = this.checkPlacementConflict(fullPlacement);
      
      if (placementErrors.length > 0) {
        errors.push(...placementErrors);
      } else if (placementConflicts.length > 0) {
        errors.push(...placementConflicts.map(c => c.message));
      } else {
        validPlacements.push(fullPlacement);
      }
    }
    
    if (errors.length > 0) {
      return { success: false, errors, warnings };
    }
    
    this.store.addContract({
      id: contractData.id,
      client: contractData.client,
      startDate: contractData.startDate,
      endDate: contractData.endDate,
      giftDays: contractData.giftDays
    });
    
    for (const placement of validPlacements) {
      this.store.addPlacement(placement);
    }
    
    return {
      success: true,
      contractId: contractData.id,
      placementsAdded: validPlacements.length,
      warnings
    };
  }

  processChange(changeData) {
    const errors = [];
    const changeErrors = this.validateChange(changeData);
    errors.push(...changeErrors);
    
    if (errors.length > 0) {
      return { success: false, errors };
    }
    
    const contracts = this.store.getContracts();
    const contract = contracts.find(c => c.id === changeData.contractId);
    
    if (changeData.effectiveDate < contract.startDate || 
        changeData.effectiveDate > contract.endDate) {
      errors.push(`换刊生效日期 ${changeData.effectiveDate} 不在合同有效期内`);
    }
    
    if (errors.length > 0) {
      return { success: false, errors };
    }
    
    this.store.addChange({
      id: changeData.id || `CHANGE-${Date.now()}`,
      contractId: changeData.contractId,
      screenId: changeData.screenId,
      effectiveDate: changeData.effectiveDate,
      newMaterial: changeData.newMaterial,
      materialUploaded: changeData.materialUploaded || false,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    
    return { success: true };
  }

  addGift(giftData) {
    const errors = [];
    const contracts = this.store.getContracts();
    const contract = contracts.find(c => c.id === giftData.contractId);
    
    if (!contract) {
      errors.push(`合同 ${giftData.contractId} 不存在`);
      return { success: false, errors };
    }
    
    const giftErrors = this.validateGift(giftData, contract);
    const giftConflicts = this.checkGiftConflict(giftData);
    
    errors.push(...giftErrors);
    errors.push(...giftConflicts.map(c => c.message));
    
    if (errors.length > 0) {
      return { success: false, errors };
    }
    
    this.store.addGift({
      ...giftData,
      client: contract.client
    });
    
    return { success: true };
  }

  generateSchedule(startDate, endDate) {
    const schedule = {};
    const screens = this.store.getScreens();
    const placements = this.store.getPlacements();
    const gifts = this.store.getGifts();
    const changes = this.store.getChanges();
    
    for (const screen of screens) {
      schedule[screen.id] = {
        screenName: screen.name,
        location: screen.location,
        dailySchedule: {}
      };
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = this.formatDate(d);
      
      for (const screen of screens) {
        schedule[screen.id].dailySchedule[dateStr] = {
          placements: [],
          gifts: [],
          status: 'normal',
          pendingReasons: []
        };
        
        const dayPlacements = placements.filter(p => 
          p.screenId === screen.id && p.date === dateStr
        );
        
        for (const placement of dayPlacements) {
          const relevantChanges = changes.filter(c => 
            c.contractId === placement.contractId &&
            c.screenId === screen.id &&
            new Date(c.effectiveDate) <= new Date(dateStr) &&
            c.status === 'pending'
          );
          
          let status = 'normal';
          let pendingReasons = [];
          
          if (relevantChanges.length > 0) {
            for (const change of relevantChanges) {
              if (!change.materialUploaded) {
                status = 'waiting-material';
                pendingReasons.push(`换刊申请 ${change.id} 缺少素材`);
              } else {
                status = 'waiting-approval';
                pendingReasons.push(`换刊申请 ${change.id} 等待审批`);
              }
            }
          }
          
          schedule[screen.id].dailySchedule[dateStr].placements.push({
            contractId: placement.contractId,
            client: placement.client,
            startTime: placement.startTime,
            endTime: placement.endTime,
            material: placement.material,
            status,
            pendingReasons
          });
        }
        
        const dayGifts = gifts.filter(g => 
          g.screenId === screen.id &&
          new Date(g.startDate) <= new Date(dateStr) &&
          new Date(g.endDate) >= new Date(dateStr)
        );
        
        for (const gift of dayGifts) {
          schedule[screen.id].dailySchedule[dateStr].gifts.push({
            contractId: gift.contractId,
            client: gift.client,
            startTime: gift.startTime,
            endTime: gift.endTime,
            material: gift.material
          });
        }
      }
    }
    
    return schedule;
  }

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getWeekDates(baseDate) {
    const date = new Date(baseDate);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      dates.push(this.formatDate(d));
    }
    
    return dates;
  }

  confirmPublish() {
    const changes = this.store.getChanges();
    const placements = this.store.getPlacements();
    const updatedPlacements = [...placements];
    
    for (const change of changes) {
      if (change.status === 'pending' && change.materialUploaded) {
        this.store.updateChange(change.id, { status: 'published' });
        
        for (let i = 0; i < updatedPlacements.length; i++) {
          const p = updatedPlacements[i];
          if (p.contractId === change.contractId &&
              p.screenId === change.screenId &&
              new Date(p.date) >= new Date(change.effectiveDate)) {
            updatedPlacements[i] = {
              ...p,
              material: change.newMaterial || p.material
            };
          }
        }
      }
    }
    
    const published = {
      publishDate: new Date().toISOString(),
      placements: updatedPlacements,
      gifts: this.store.getGifts(),
      changes: this.store.getChanges()
    };
    
    this.store.setPublished(published);
    return published;
  }
}

module.exports = Scheduler;
