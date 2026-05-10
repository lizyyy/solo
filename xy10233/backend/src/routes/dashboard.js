const express = require('express');
const router = express.Router();

const TankModel = require('../models/tank');
const BatchModel = require('../models/batch');
const AlertModel = require('../models/alert');
const DeathLossModel = require('../models/deathLoss');
const WaterQualityModel = require('../models/waterQuality');

router.get('/', (req, res) => {
  const tanks = TankModel.getAll();
  const batches = BatchModel.getAll();
  const activeAlerts = AlertModel.getActive();
  const deathLosses = DeathLossModel.getAll();
  
  const stats = {
    tanks: {
      total: tanks.length,
      normal: tanks.filter(t => t.status === 'normal').length,
      warning: tanks.filter(t => t.status === 'warning').length,
      alert: tanks.filter(t => t.status === 'alert').length,
      offline: tanks.filter(t => t.status === 'offline').length
    },
    batches: {
      total: batches.length,
      pending: batches.filter(b => b.status === 'pending').length,
      active: batches.filter(b => b.status === 'active').length,
      completed: batches.filter(b => b.status === 'completed').length,
      partial: batches.filter(b => b.status === 'partial').length
    },
    alerts: {
      total: activeAlerts.length,
      temperature: activeAlerts.filter(a => a.alert_type.includes('temperature')).length,
      salinity: activeAlerts.filter(a => a.alert_type.includes('salinity')).length,
      oxygen: activeAlerts.filter(a => a.alert_type.includes('oxygen')).length
    },
    deathLoss: {
      pending: deathLosses.filter(d => d.attribution_status === 'pending').length,
      analyzing: deathLosses.filter(d => d.attribution_status === 'analyzing').length,
      completed: deathLosses.filter(d => d.attribution_status === 'completed').length
    }
  };
  
  const recentAlerts = activeAlerts.slice(0, 5);
  
  const pendingAttributions = deathLosses
    .filter(d => d.attribution_status === 'pending' || d.attribution_status === 'analyzing')
    .slice(0, 5);
  
  const activeBatches = batches.filter(b => b.status === 'active');
  
  const bottlenecks = [];
  
  if (stats.alerts.total > 0) {
    bottlenecks.push({
      type: 'critical',
      title: `${stats.alerts.total}条未处理报警`,
      description: `温度报警:${stats.alerts.temperature}, 盐度报警:${stats.alerts.salinity}, 溶氧报警:${stats.alerts.oxygen}`,
      action: '建议立即查看并处理报警'
    });
  }
  
  if (stats.deathLoss.pending > 0) {
    bottlenecks.push({
      type: 'warning',
      title: `${stats.deathLoss.pending}条死耗待归因`,
      description: '及时归因有助于明确责任、优化管理',
      action: '建议进行死耗原因分析'
    });
  }
  
  if (stats.tanks.alert > 0) {
    bottlenecks.push({
      type: 'danger',
      title: `${stats.tanks.alert}个暂养池状态异常`,
      description: '异常暂养池中的海鲜面临高风险',
      action: '建议立即检查水质并采取措施'
    });
  }
  
  if (bottlenecks.length === 0) {
    bottlenecks.push({
      type: 'normal',
      title: '系统运行正常',
      description: '当前没有发现关键问题',
      action: '继续保持良好的管理习惯'
    });
  }
  
  const recommendations = [];
  
  if (stats.alerts.temperature > 0) {
    recommendations.push({
      priority: 'high',
      title: '检查温控系统',
      description: '温度异常可能导致海鲜死亡，请立即检查温控设备'
    });
  }
  
  if (stats.alerts.oxygen > 0) {
    recommendations.push({
      priority: 'high',
      title: '检查增氧设备',
      description: '溶氧不足是海鲜死亡的主要原因之一'
    });
  }
  
  if (stats.deathLoss.pending > 0) {
    recommendations.push({
      priority: 'medium',
      title: '完成死耗归因',
      description: '及时分析死耗原因，避免类似问题再次发生'
    });
  }
  
  if (stats.batches.pending > 0) {
    recommendations.push({
      priority: 'low',
      title: '绑定待入库批次',
      description: `${stats.batches.pending}个批次等待分配暂养池`
    });
  }
  
  res.json({
    success: true,
    data: {
      stats,
      recentAlerts,
      pendingAttributions,
      activeBatches,
      bottlenecks,
      recommendations,
      tanks: tanks.map(t => ({
        id: t.id,
        name: t.name,
        status: t.status,
        current_temperature: t.current_temperature,
        current_salinity: t.current_salinity,
        current_oxygen: t.current_oxygen,
        last_check_time: t.last_check_time
      }))
    }
  });
});

router.get('/overview', (req, res) => {
  const tanks = TankModel.getAll();
  const batches = BatchModel.getAll();
  
  const tankSummary = tanks.map(tank => {
    const tankBatches = batches.filter(b => b.tank_id === tank.id && b.status === 'active');
    const latestWQ = WaterQualityModel.getLatestByTankId(tank.id);
    
    return {
      ...tank,
      activeBatches: tankBatches.length,
      totalQuantity: tankBatches.reduce((sum, b) => sum + (b.quantity - b.death_quantity), 0),
      latestReading: latestWQ
    };
  });
  
  res.json({
    success: true,
    data: tankSummary
  });
});

module.exports = router;
