import { Router } from 'express';
import { startOfWeek, endOfWeek, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { prisma } from '../index.js';

const router = Router();

const parseSkills = (worker) => {
  if (!worker) return worker;
  let skills = [];
  if (typeof worker.skills === 'string') {
    try {
      skills = JSON.parse(worker.skills);
    } catch {
      skills = [];
    }
  } else if (Array.isArray(worker.skills)) {
    skills = worker.skills;
  }
  return { ...worker, skills };
};

router.get('/', async (req, res, next) => {
  try {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    
    const [
      repairOrderStats,
      overdueCount,
      thisWeekPatrolTasks,
      workersWithLoad,
      recentRepairOrders
    ] = await Promise.all([
      prisma.repairOrder.groupBy({
        by: ['status'],
        _count: { id: true }
      }),
      prisma.repairOrder.count({
        where: {
          AND: [
            { dueDate: { lt: now } },
            { status: { notIn: ['closed'] } }
          ]
        }
      }),
      prisma.patrolTask.findMany({
        where: {
          createdAt: {
            gte: weekStart,
            lte: weekEnd
          }
        },
        include: {
          items: true
        }
      }),
      prisma.worker.findMany({
        include: {
          _count: {
            select: {
              repairOrders: {
                where: {
                  status: { in: ['in_progress', 'pending_review'] }
                }
              }
            }
          },
          repairOrders: {
            where: {
              status: { in: ['in_progress', 'pending_review'] }
            },
            select: {
              estimatedMinutes: true,
              status: true
            }
          }
        }
      }),
      prisma.repairOrder.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          device: { include: { building: true } },
          worker: true
        }
      })
    ]);
    
    const repairOrderByStatus = {};
    repairOrderStats.forEach(s => {
      repairOrderByStatus[s.status] = s._count.id;
    });
    
    const totalRepairOrders = repairOrderStats.reduce((sum, s) => sum + s._count.id, 0);
    
    let abnormalTasksThisWeek = 0;
    let totalTasksThisWeek = thisWeekPatrolTasks.length;
    
    thisWeekPatrolTasks.forEach(task => {
      const hasAbnormal = task.items.some(item => item.isAbnormal === true);
      if (hasAbnormal) abnormalTasksThisWeek++;
    });
    
    const abnormalRate = totalTasksThisWeek > 0 
      ? Math.round((abnormalTasksThisWeek / totalTasksThisWeek) * 100)
      : 0;
    
    const workerLoads = workersWithLoad.map(worker => {
      const parsedWorker = parseSkills(worker);
      const activeOrders = worker.repairOrders;
      const totalEstimatedMinutes = activeOrders.reduce((sum, o) => sum + (o.estimatedMinutes || 0), 0);
      
      return {
        id: parsedWorker.id,
        name: parsedWorker.name,
        skills: parsedWorker.skills,
        phone: parsedWorker.phone,
        activeTaskCount: worker._count.repairOrders,
        totalEstimatedMinutes,
        totalEstimatedHours: Math.round(totalEstimatedMinutes / 60 * 10) / 10
      };
    });
    
    const statusLabels = {
      'pending_assignment': '待分派',
      'in_progress': '处理中',
      'pending_review': '待复核',
      'closed': '已关闭'
    };
    
    const recentOrdersWithLabels = recentRepairOrders.map(order => ({
      ...order,
      statusLabel: statusLabels[order.status] || order.status
    }));
    
    res.json({
      overview: {
        totalRepairOrders,
        byStatus: repairOrderByStatus,
        overdueCount,
        thisWeekPatrolCount: totalTasksThisWeek,
        thisWeekAbnormalCount: abnormalTasksThisWeek,
        abnormalRate
      },
      workerLoads: workerLoads.sort((a, b) => b.activeTaskCount - a.activeTaskCount),
      recentRepairOrders: recentOrdersWithLabels
    });
  } catch (error) {
    next(error);
  }
});

router.get('/repair-trend', async (req, res, next) => {
  try {
    const now = new Date();
    const last7Days = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      last7Days.push({
        date: date.toISOString().split('T')[0],
        start: startOfDay(date),
        end: endOfDay(date)
      });
    }
    
    const dailyStats = [];
    
    for (const day of last7Days) {
      const [created, closed] = await Promise.all([
        prisma.repairOrder.count({
          where: {
            createdAt: {
              gte: day.start,
              lte: day.end
            }
          }
        }),
        prisma.repairOrder.count({
          where: {
            completedAt: {
              gte: day.start,
              lte: day.end
            }
          }
        })
      ]);
      
      dailyStats.push({
        date: day.date,
        created,
        closed
      });
    }
    
    res.json(dailyStats);
  } catch (error) {
    next(error);
  }
});

router.get('/building-stats', async (req, res, next) => {
  try {
    const buildings = await prisma.building.findMany({
      include: {
        devices: {
          include: {
            repairOrders: true
          }
        }
      }
    });
    
    const buildingStats = buildings.map(building => {
      const deviceCount = building.devices.length;
      const repairOrderCount = building.devices.reduce((sum, d) => sum + d.repairOrders.length, 0);
      
      const activeRepairOrders = building.devices.reduce((sum, d) => 
        sum + d.repairOrders.filter(o => o.status !== 'closed').length, 0
      );
      
      return {
        id: building.id,
        name: building.name,
        description: building.description,
        deviceCount,
        repairOrderCount,
        activeRepairOrders
      };
    });
    
    res.json(buildingStats);
  } catch (error) {
    next(error);
  }
});

router.get('/device-type-stats', async (req, res, next) => {
  try {
    const devices = await prisma.device.findMany({
      include: {
        _count: {
          select: { patrolTasks: true }
        }
      }
    });
    
    const typeMap = new Map();
    
    devices.forEach(device => {
      if (!typeMap.has(device.type)) {
        typeMap.set(device.type, {
          type: device.type,
          deviceCount: 0,
          patrolCount: 0
        });
      }
      const stats = typeMap.get(device.type);
      stats.deviceCount++;
      stats.patrolCount += device._count.patrolTasks;
    });
    
    const typeStats = Array.from(typeMap.values()).sort((a, b) => b.deviceCount - a.deviceCount);
    
    res.json(typeStats);
  } catch (error) {
    next(error);
  }
});

export default router;
