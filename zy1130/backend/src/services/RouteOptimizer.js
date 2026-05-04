const { v4: uuidv4 } = require('uuid');
const timeUtils = require('../utils/time');

class RouteOptimizer {
  constructor(travelTimeService, constraintChecker, roadRulesData) {
    this.travelTimeService = travelTimeService;
    this.constraintChecker = constraintChecker;
    this.roadRules = roadRulesData || {};
    this.priorityWeights = roadRulesData.priority_weights || {
      high: { weight: 3.0 },
      medium: { weight: 1.5 },
      low: { weight: 1.0 }
    };
  }

  optimize(jobs, workers, options = {}) {
    const { 
      date = new Date(),
      strategy = 'greedy',
      considerRestrictions = true
    } = options;

    const assignedJobs = new Set();
    const routes = {};
    const unassignedJobs = [];

    workers.forEach(worker => {
      routes[worker.id] = this.createEmptyRoute(worker);
    });

    const sortedJobs = [...jobs].sort((a, b) => {
      const weightA = this.priorityWeights[a.priority]?.weight || 1;
      const weightB = this.priorityWeights[b.priority]?.weight || 1;
      return weightB - weightA;
    });

    for (const job of sortedJobs) {
      let bestWorker = null;
      let bestPosition = -1;
      let bestCost = Infinity;

      for (const worker of workers) {
        if (!worker.canServeJob(job)) continue;

        const currentRoute = routes[worker.id];
        const positions = this.findInsertionPositions(currentRoute, job, worker);

        for (const pos of positions) {
          const cost = this.evaluateInsertion(currentRoute, job, worker, pos, jobs);
          
          if (cost < bestCost) {
            bestCost = cost;
            bestWorker = worker;
            bestPosition = pos;
          }
        }
      }

      if (bestWorker && bestPosition >= 0) {
        this.insertJobIntoRoute(routes[bestWorker.id], job, bestWorker, bestPosition, jobs);
        assignedJobs.add(job.id);
      } else {
        unassignedJobs.push(job);
      }
    }

    let totalDistance = 0;
    let totalDuration = 0;
    let totalJobs = 0;
    const allIssues = [];
    const allWarnings = [];

    const jobsMap = {};
    jobs.forEach(j => jobsMap[j.id] = j);

    for (const workerId of Object.keys(routes)) {
      const worker = workers.find(w => w.id === workerId);
      const route = routes[workerId];
      
      this.calculateRouteETA(route, worker, jobs);
      
      totalDistance += route.totalDistanceKm || 0;
      totalDuration += route.totalDurationMinutes || 0;
      totalJobs += route.jobCount || 0;

      if (this.constraintChecker) {
        const check = this.constraintChecker.checkAll(route, worker, jobsMap);
        route.constraintCheck = check;
        allIssues.push(...check.issues);
        allWarnings.push(...check.warnings);
        route.riskScore = check.riskScore;
      }
    }

    return {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      strategy,
      routes,
      summary: {
        totalWorkers: workers.length,
        totalJobs: jobs.length,
        assignedJobs: assignedJobs.size,
        unassignedJobs: unassignedJobs.length,
        unassignedJobIds: unassignedJobs.map(j => j.id),
        totalDistanceKm: totalDistance,
        totalDurationMinutes: totalDuration,
        issues: allIssues,
        warnings: allWarnings,
        overallRiskScore: this.calculateOverallRiskScore(allIssues, allWarnings)
      }
    };
  }

  createEmptyRoute(worker) {
    return {
      workerId: worker.id,
      workerName: worker.name,
      stops: [],
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      totalTravelMinutes: 0,
      totalServiceMinutes: 0,
      jobCount: 0,
      riskScore: 0,
      constraintCheck: null
    };
  }

  findInsertionPositions(route, job, worker) {
    const positions = [];
    const maxPositions = route.stops.length + 1;
    
    for (let i = 0; i <= maxPositions; i++) {
      positions.push(i);
    }
    
    return positions;
  }

  evaluateInsertion(route, job, worker, position, allJobs) {
    let cost = 0;
    
    const tempRoute = JSON.parse(JSON.stringify(route));
    tempRoute.stops.splice(position, 0, {
      type: 'job',
      jobId: job.id,
      eta: null,
      etd: null
    });
    
    this.calculateRouteETA(tempRoute, worker, allJobs);
    
    const addedDistance = tempRoute.totalDistanceKm - (route.totalDistanceKm || 0);
    cost += addedDistance * 10;
    
    if (tempRoute.constraintCheck) {
      cost += tempRoute.constraintCheck.riskScore * 5;
    }
    
    const priorityWeight = this.priorityWeights[job.priority]?.weight || 1;
    cost = cost / priorityWeight;
    
    return cost;
  }

  insertJobIntoRoute(route, job, worker, position, allJobs) {
    const stop = {
      id: uuidv4(),
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
      },
      eta: null,
      etd: null,
      travelMinutes: 0,
      waitMinutes: 0
    };
    
    route.stops.splice(position, 0, stop);
    route.jobCount++;
  }

  calculateRouteETA(route, worker, allJobs) {
    if (!this.travelTimeService) {
      return route;
    }

    const jobsMap = {};
    allJobs.forEach(j => jobsMap[j.id] = j);

    let currentTime = timeUtils.timeToMinutes(worker.workStartTime);
    let totalDistance = 0;
    let totalTravel = 0;
    let totalService = 0;
    let prevLocationId = `DEPOT_${worker.id}`;

    for (let i = 0; i < route.stops.length; i++) {
      const stop = route.stops[i];
      
      if (stop.type === 'job') {
        const job = jobsMap[stop.jobId] || stop.job;
        if (!job) continue;

        const travelTime = this.travelTimeService.getTravelTime(
          prevLocationId,
          job.id,
          worker.vehicleType,
          timeUtils.minutesToTime(currentTime)
        );

        const arrivalTime = currentTime + travelTime;
        
        const twStart = timeUtils.timeToMinutes(job.timeWindowStart);
        let waitTime = 0;
        if (arrivalTime < twStart) {
          waitTime = twStart - arrivalTime;
        }

        const serviceStart = arrivalTime + waitTime;
        const serviceEnd = serviceStart + job.serviceDuration;

        stop.eta = timeUtils.minutesToTime(arrivalTime);
        stop.etd = timeUtils.minutesToTime(serviceEnd);
        stop.travelMinutes = travelTime;
        stop.waitMinutes = waitTime;
        stop.serviceMinutes = job.serviceDuration;
        stop.arrivalMinutes = arrivalTime;
        stop.serviceStartMinutes = serviceStart;
        stop.serviceEndMinutes = serviceEnd;

        totalTravel += travelTime;
        totalService += job.serviceDuration;
        totalDistance += this.estimateDistance(prevLocationId, job.id);

        currentTime = serviceEnd;
        prevLocationId = job.id;

        if (this.needsLunchBreak(currentTime, worker)) {
          const lunchStart = Math.max(currentTime, timeUtils.timeToMinutes(worker.lunchStart));
          const lunchEnd = lunchStart + 60;
          
          const lunchStop = {
            id: uuidv4(),
            type: 'break',
            breakType: 'lunch',
            eta: timeUtils.minutesToTime(lunchStart),
            etd: timeUtils.minutesToTime(lunchEnd),
            durationMinutes: 60
          };
          
          route.stops.splice(i + 1, 0, lunchStop);
          currentTime = lunchEnd;
          i++;
        }
      }
    }

    const returnToDepotTime = this.travelTimeService.getTravelTime(
      prevLocationId,
      `DEPOT_${worker.id}`,
      worker.vehicleType,
      timeUtils.minutesToTime(currentTime)
    );
    
    totalTravel += returnToDepotTime;
    totalDistance += this.estimateDistance(prevLocationId, `DEPOT_${worker.id}`);
    currentTime += returnToDepotTime;

    route.totalDistanceKm = totalDistance;
    route.totalTravelMinutes = totalTravel;
    route.totalServiceMinutes = totalService;
    route.totalDurationMinutes = currentTime - timeUtils.timeToMinutes(worker.workStartTime);
    route.endTime = timeUtils.minutesToTime(currentTime);

    return route;
  }

  estimateDistance(fromId, toId) {
    if (!this.travelTimeService) return 0;
    
    const fromLoc = this.travelTimeService.getLocation(fromId);
    const toLoc = this.travelTimeService.getLocation(toId);
    
    if (!fromLoc || !toLoc) return 1;

    const R = 6371;
    const dLat = (toLoc.lat - fromLoc.lat) * Math.PI / 180;
    const dLng = (toLoc.lng - fromLoc.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(fromLoc.lat * Math.PI / 180) * Math.cos(toLoc.lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  needsLunchBreak(currentTimeMinutes, worker) {
    const lunchStart = timeUtils.timeToMinutes(worker.lunchStart);
    const lunchEnd = timeUtils.timeToMinutes(worker.lunchEnd);
    
    return currentTimeMinutes >= lunchStart && currentTimeMinutes < lunchEnd;
  }

  calculateOverallRiskScore(issues, warnings) {
    let score = 0;
    
    issues.forEach(issue => {
      if (issue.severity === 'error') {
        score += 20;
      } else {
        score += 10;
      }
    });
    
    warnings.forEach(warning => {
      score += 5;
    });
    
    return Math.min(100, score);
  }

  reoptimizeRoute(route, worker, allJobs, options = {}) {
    const jobsInRoute = route.stops
      .filter(s => s.type === 'job')
      .map(s => allJobs.find(j => j.id === s.jobId))
      .filter(Boolean);

    const newRoute = this.createEmptyRoute(worker);
    
    if (jobsInRoute.length === 0) {
      return newRoute;
    }

    const unassigned = [...jobsInRoute];
    let currentLocationId = `DEPOT_${worker.id}`;
    let currentTime = timeUtils.timeToMinutes(worker.workStartTime);

    while (unassigned.length > 0) {
      let bestJob = null;
      let bestCost = Infinity;
      let bestIndex = -1;

      for (let i = 0; i < unassigned.length; i++) {
        const job = unassigned[i];
        const travelTime = this.travelTimeService.getTravelTime(
          currentLocationId,
          job.id,
          worker.vehicleType,
          timeUtils.minutesToTime(currentTime)
        );
        
        const arrivalTime = currentTime + travelTime;
        const twEnd = timeUtils.timeToMinutes(job.timeWindowEnd);
        
        let cost = travelTime;
        
        if (arrivalTime > twEnd) {
          cost += (arrivalTime - twEnd) * 10;
        }
        
        const priorityWeight = this.priorityWeights[job.priority]?.weight || 1;
        cost = cost / priorityWeight;

        if (cost < bestCost) {
          bestCost = cost;
          bestJob = job;
          bestIndex = i;
        }
      }

      if (bestJob) {
        this.insertJobIntoRoute(newRoute, bestJob, worker, newRoute.stops.length, allJobs);
        unassigned.splice(bestIndex, 1);
        
        const travelTime = this.travelTimeService.getTravelTime(
          currentLocationId,
          bestJob.id,
          worker.vehicleType,
          timeUtils.minutesToTime(currentTime)
        );
        
        currentTime += travelTime + bestJob.serviceDuration;
        currentLocationId = bestJob.id;
      } else {
        break;
      }
    }

    this.calculateRouteETA(newRoute, worker, allJobs);
    
    const jobsMap = {};
    allJobs.forEach(j => jobsMap[j.id] = j);
    
    if (this.constraintChecker) {
      const check = this.constraintChecker.checkAll(newRoute, worker, jobsMap);
      newRoute.constraintCheck = check;
      newRoute.riskScore = check.riskScore;
    }

    return newRoute;
  }
}

module.exports = RouteOptimizer;
