const { Obstacle, FloorPlan, SafetyReport } = require('./models');

class ObstacleService {
  static importObstacle(data) {
    const hasBlockedTag = this.detectBlockedAlarmTag(data);
    
    const obstacleData = {
      ...data,
      alarmTagBlocked: hasBlockedTag,
      status: hasBlockedTag ? 'blocked_tag_pending_review' : 'pending_floor_plan'
    };

    if (hasBlockedTag) {
      obstacleData.blockReason = data.blockReason || '移动端截图遮挡告警标签';
      obstacleData.assignedTo = '施工经理';
      obstacleData.nextAction = '请施工经理复核告警标签遮挡情况，确认障碍物真实位置';
    }

    const obstacle = Obstacle.create(obstacleData);
    
    const report = SafetyReport.generateForObstacle(obstacle);
    report.save();

    return { obstacle, report };
  }

  static detectBlockedAlarmTag(data) {
    if (data.alarmTagBlocked !== undefined) {
      return data.alarmTagBlocked;
    }
    
    if (data.mobileScreenshot && data.mobileScreenshot.blockedTags) {
      return data.mobileScreenshot.blockedTags.length > 0;
    }
    
    return false;
  }

  static getObstacleWithDetails(id) {
    const obstacle = Obstacle.getById(id);
    if (!obstacle) return null;

    const floorPlan = obstacle.floorPlanId ? FloorPlan.getById(obstacle.floorPlanId) : null;
    const reports = SafetyReport.getByObstacle(id);

    return {
      obstacle,
      floorPlan,
      reports,
      evidenceSummary: {
        obstacleRemark: obstacle.remark || '',
        floorPlanSketch: floorPlan ? floorPlan.name : '',
        alarmTagBlocked: obstacle.alarmTagBlocked
      }
    };
  }

  static reviewByManager(obstacleId, reviewData) {
    const obstacle = Obstacle.getById(obstacleId);
    if (!obstacle) throw new Error('障碍物不存在');

    const updateData = {
      reviewedByManager: true,
      status: reviewData.approved ? 'manager_approved' : 'needs_correction',
      remark: reviewData.remark || obstacle.remark
    };

    if (reviewData.approved) {
      updateData.assignedTo = '园区运维小陶';
      updateData.nextAction = '请园区运维小陶补录楼层剖面草图';
    } else {
      updateData.assignedTo = '施工经理';
      updateData.nextAction = reviewData.correctionNote || '请修正障碍物信息后重新提交';
    }

    const updated = Obstacle.update(obstacleId, updateData);
    
    const floorPlan = updated.floorPlanId ? FloorPlan.getById(updated.floorPlanId) : null;
    const report = SafetyReport.generateForObstacle(updated, floorPlan);
    report.save();

    return { obstacle: updated, report };
  }

  static attachFloorPlan(obstacleId, floorPlanId) {
    const obstacle = Obstacle.getById(obstacleId);
    const floorPlan = FloorPlan.getById(floorPlanId);
    
    if (!obstacle) throw new Error('障碍物不存在');
    if (!floorPlan) throw new Error('楼层剖面草图不存在');

    const updated = Obstacle.update(obstacleId, {
      floorPlanId,
      status: 'floor_plan_attached',
      assignedTo: '园区运维小陶',
      nextAction: '请园区运维小陶确认楼层剖面草图关联是否正确'
    });

    const report = SafetyReport.generateForObstacle(updated, floorPlan);
    report.save();

    return { obstacle: updated, floorPlan, report };
  }

  static reviewByTao(obstacleId, reviewData) {
    const obstacle = Obstacle.getById(obstacleId);
    if (!obstacle) throw new Error('障碍物不存在');

    if (!obstacle.floorPlanId) throw new Error('请先关联楼层剖面草图');

    const floorPlan = FloorPlan.getById(obstacle.floorPlanId);

    const updateData = {
      status: reviewData.approved ? 'tao_approved' : 'floor_plan_needs_revision',
      assignedTo: reviewData.approved ? '施工经理' : '园区运维小陶',
      nextAction: reviewData.approved 
        ? '所有材料已齐全，请施工经理最终确认' 
        : reviewData.correctionNote || '请修正楼层剖面草图'
    };

    const updated = Obstacle.update(obstacleId, updateData);
    
    if (floorPlan) {
      FloorPlan.update(floorPlan.id, { reviewedByTao: reviewData.approved });
    }

    const report = SafetyReport.generateForObstacle(updated, floorPlan);
    report.save();

    return { obstacle: updated, report };
  }

  static createFloorPlan(data) {
    return FloorPlan.create(data);
  }

  static getAllObstacles() {
    return Obstacle.getAll();
  }

  static getAllFloorPlans() {
    return FloorPlan.getAll();
  }

  static getAllReports() {
    return SafetyReport.getAll();
  }

  static getStatistics() {
    const obstacles = Obstacle.getAll();
    const floorPlans = FloorPlan.getAll();
    const reports = SafetyReport.getAll();

    const blockedTags = obstacles.filter(o => o.alarmTagBlocked).length;
    const pendingManagerReview = obstacles.filter(o => !o.reviewedByManager).length;
    const pendingFloorPlan = obstacles.filter(o => !o.floorPlanId).length;
    const completed = obstacles.filter(o => o.status === 'tao_approved').length;

    return {
      totalObstacles: obstacles.length,
      totalFloorPlans: floorPlans.length,
      totalReports: reports.length,
      blockedTags,
      pendingManagerReview,
      pendingFloorPlan,
      completed
    };
  }
}

module.exports = { ObstacleService };
