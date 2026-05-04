const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const jobRepository = require('../repositories/JobRepository');
const workerRepository = require('../repositories/WorkerRepository');
const planRepository = require('../repositories/PlanRepository');

const TravelTimeService = require('../services/TravelTimeService');
const ConstraintChecker = require('../services/ConstraintChecker');
const RouteOptimizer = require('../services/RouteOptimizer');

const dataPath = path.join(__dirname, '../../../data');

let travelTimeService = null;
let constraintChecker = null;
let routeOptimizer = null;

function loadServices() {
  try {
    const travelTimesPath = path.join(dataPath, 'travel-times.json');
    const roadRulesPath = path.join(dataPath, 'road-rules.json');
    
    let travelTimesData = { times: {}, locations: [] };
    let roadRulesData = {};
    
    if (fs.existsSync(travelTimesPath)) {
      travelTimesData = JSON.parse(fs.readFileSync(travelTimesPath, 'utf-8'));
    }
    if (fs.existsSync(roadRulesPath)) {
      roadRulesData = JSON.parse(fs.readFileSync(roadRulesPath, 'utf-8'));
    }
    
    travelTimeService = new TravelTimeService(travelTimesData, roadRulesData);
    constraintChecker = new ConstraintChecker(roadRulesData, travelTimeService);
    routeOptimizer = new RouteOptimizer(travelTimeService, constraintChecker, roadRulesData);
  } catch (error) {
    console.error('Failed to load optimization services:', error);
  }
}

loadServices();

router.post('/', async (req, res) => {
  try {
    const { 
      jobIds, 
      workerIds, 
      strategy = 'greedy',
      date = new Date().toISOString().split('T')[0],
      name,
      description
    } = req.body;
    
    if (!routeOptimizer) {
      loadServices();
      if (!routeOptimizer) {
        return res.status(500).json({
          success: false,
          error: '优化服务未初始化'
        });
      }
    }
    
    let jobs = await jobRepository.findAll();
    let workers = await workerRepository.findAll({ status: 'active' });
    
    if (jobIds && Array.isArray(jobIds) && jobIds.length > 0) {
      jobs = jobs.filter(j => jobIds.includes(j.id));
    }
    
    if (workerIds && Array.isArray(workerIds) && workerIds.length > 0) {
      workers = workers.filter(w => workerIds.includes(w.id));
    }
    
    if (jobs.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有待优化的任务'
      });
    }
    
    if (workers.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有可用的师傅'
      });
    }
    
    const plan = routeOptimizer.optimize(jobs, workers, {
      date: new Date(date),
      strategy
    });
    
    const savedPlan = await planRepository.create({
      name: name || `方案 ${date}`,
      description: description || '自动生成的派单方案',
      date,
      strategy,
      planData: plan,
      isActive: false
    });
    
    res.json({
      success: true,
      data: {
        planId: savedPlan.id,
        ...savedPlan.planData,
        summary: savedPlan.planData.summary
      }
    });
  } catch (error) {
    console.error('Optimization error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/reoptimize-route', async (req, res) => {
  try {
    const { planId, workerId, jobIds } = req.body;
    
    if (!routeOptimizer) {
      loadServices();
    }
    
    const plan = await planRepository.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: '方案不存在'
      });
    }
    
    const worker = await workerRepository.findById(workerId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        error: '师傅不存在'
      });
    }
    
    let jobs = [];
    if (jobIds && Array.isArray(jobIds)) {
      for (const jobId of jobIds) {
        const job = await jobRepository.findById(jobId);
        if (job) jobs.push(job);
      }
    }
    
    const existingRoute = plan.planData.routes[workerId];
    if (existingRoute && existingRoute.stops) {
      for (const stop of existingRoute.stops) {
        if (stop.type === 'job' && stop.jobId) {
          if (!jobs.find(j => j.id === stop.jobId)) {
            const job = await jobRepository.findById(stop.jobId);
            if (job) jobs.push(job);
          }
        }
      }
    }
    
    const allJobs = await jobRepository.findAll();
    const newRoute = routeOptimizer.reoptimizeRoute(
      { stops: jobs.map(j => ({ type: 'job', jobId: j.id })) },
      worker,
      allJobs
    );
    
    res.json({
      success: true,
      data: newRoute
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/recalculate-eta', async (req, res) => {
  try {
    const { planId, workerId, stops } = req.body;
    
    if (!routeOptimizer) {
      loadServices();
    }
    
    const worker = await workerRepository.findById(workerId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        error: '师傅不存在'
      });
    }
    
    const allJobs = await jobRepository.findAll();
    const jobsMap = {};
    allJobs.forEach(j => jobsMap[j.id] = j);
    
    const route = {
      stops: stops || []
    };
    
    routeOptimizer.calculateRouteETA(route, worker, allJobs);
    
    if (constraintChecker) {
      const check = constraintChecker.checkAll(route, worker, jobsMap);
      route.constraintCheck = check;
      route.riskScore = check.riskScore;
    }
    
    res.json({
      success: true,
      data: route
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/move-job', async (req, res) => {
  try {
    const { planId, jobId, fromWorkerId, toWorkerId, insertPosition } = req.body;
    
    const plan = await planRepository.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: '方案不存在'
      });
    }
    
    const job = await jobRepository.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    const toWorker = await workerRepository.findById(toWorkerId);
    if (!toWorker) {
      return res.status(404).json({
        success: false,
        error: '目标师傅不存在'
      });
    }
    
    if (!toWorker.canServeJob(job)) {
      return res.status(400).json({
        success: false,
        error: `师傅 ${toWorker.name} 没有 ${job.serviceType} 技能`,
        skillMismatch: true
      });
    }
    
    const planData = plan.planData;
    
    if (fromWorkerId && planData.routes[fromWorkerId]) {
      planData.routes[fromWorkerId].stops = planData.routes[fromWorkerId].stops.filter(
        s => !(s.type === 'job' && s.jobId === jobId)
      );
    }
    
    if (!planData.routes[toWorkerId]) {
      planData.routes[toWorkerId] = {
        workerId: toWorkerId,
        workerName: toWorker.name,
        stops: [],
        totalDistanceKm: 0,
        totalDurationMinutes: 0,
        jobCount: 0
      };
    }
    
    const stopToAdd = {
      type: 'job',
      jobId: job.id,
      job: {
        id: job.id,
        clientName: job.clientName,
        address: job.address,
        lat: job.lat,
        lng: job.lng,
        serviceType: job.serviceType,
        timeWindowStart: job.timeWindowStart,
        timeWindowEnd: job.timeWindowEnd,
        serviceDuration: job.serviceDuration,
        priority: job.priority
      }
    };
    
    const targetRoute = planData.routes[toWorkerId];
    if (insertPosition !== undefined && insertPosition >= 0) {
      targetRoute.stops.splice(insertPosition, 0, stopToAdd);
    } else {
      targetRoute.stops.push(stopToAdd);
    }
    
    targetRoute.jobCount = targetRoute.stops.filter(s => s.type === 'job').length;
    
    const allJobs = await jobRepository.findAll();
    if (routeOptimizer) {
      routeOptimizer.calculateRouteETA(targetRoute, toWorker, allJobs);
      
      if (constraintChecker) {
        const jobsMap = {};
        allJobs.forEach(j => jobsMap[j.id] = j);
        const check = constraintChecker.checkAll(targetRoute, toWorker, jobsMap);
        targetRoute.constraintCheck = check;
        targetRoute.riskScore = check.riskScore;
      }
    }
    
    await planRepository.update(planId, {
      planData,
      changeLog: `将任务 ${job.clientName} (${jobId}) 从 ${fromWorkerId || '未分配'} 移动到 ${toWorkerId}`
    });
    
    res.json({
      success: true,
      data: {
        planId,
        updatedRoutes: {
          [toWorkerId]: targetRoute,
          ...(fromWorkerId && planData.routes[fromWorkerId] ? { [fromWorkerId]: planData.routes[fromWorkerId] } : {})
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/add-job', async (req, res) => {
  try {
    const { planId, jobData, workerId, insertPosition } = req.body;
    
    const plan = await planRepository.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: '方案不存在'
      });
    }
    
    const Job = require('../models/Job');
    const newJob = new Job(jobData);
    await jobRepository.create(newJob.toJSON());
    
    let targetWorkerId = workerId;
    let bestPosition = insertPosition;
    
    if (!targetWorkerId && routeOptimizer) {
      const workers = await workerRepository.findAll({ status: 'active' });
      const capableWorkers = workers.filter(w => w.canServeJob(newJob));
      
      if (capableWorkers.length === 0) {
        return res.status(400).json({
          success: false,
          error: '没有具备对应技能的师傅',
          skillMismatch: true
        });
      }
      
      targetWorkerId = capableWorkers[0].id;
    }
    
    const planData = plan.planData;
    const targetWorker = await workerRepository.findById(targetWorkerId);
    
    if (!planData.routes[targetWorkerId]) {
      planData.routes[targetWorkerId] = {
        workerId: targetWorkerId,
        workerName: targetWorker.name,
        stops: [],
        totalDistanceKm: 0,
        totalDurationMinutes: 0,
        jobCount: 0
      };
    }
    
    const stopToAdd = {
      type: 'job',
      jobId: newJob.id,
      job: {
        id: newJob.id,
        clientName: newJob.clientName,
        address: newJob.address,
        lat: newJob.lat,
        lng: newJob.lng,
        serviceType: newJob.serviceType,
        timeWindowStart: newJob.timeWindowStart,
        timeWindowEnd: newJob.timeWindowEnd,
        serviceDuration: newJob.serviceDuration,
        priority: newJob.priority
      }
    };
    
    const targetRoute = planData.routes[targetWorkerId];
    if (bestPosition !== undefined && bestPosition >= 0) {
      targetRoute.stops.splice(bestPosition, 0, stopToAdd);
    } else {
      targetRoute.stops.push(stopToAdd);
    }
    
    targetRoute.jobCount = targetRoute.stops.filter(s => s.type === 'job').length;
    
    const allJobs = await jobRepository.findAll();
    if (routeOptimizer) {
      routeOptimizer.calculateRouteETA(targetRoute, targetWorker, allJobs);
      
      if (constraintChecker) {
        const jobsMap = {};
        allJobs.forEach(j => jobsMap[j.id] = j);
        const check = constraintChecker.checkAll(targetRoute, targetWorker, jobsMap);
        targetRoute.constraintCheck = check;
        targetRoute.riskScore = check.riskScore;
      }
    }
    
    await planRepository.update(planId, {
      planData,
      changeLog: `临时加单: ${newJob.clientName} (${newJob.id}) 分配给 ${targetWorker.name}`
    });
    
    res.json({
      success: true,
      data: {
        planId,
        newJob: newJob.toJSON(),
        assignedWorkerId: targetWorkerId,
        updatedRoute: targetRoute
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
