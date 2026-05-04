const Job = require('../src/models/Job');
const Worker = require('../src/models/Worker');

describe('Models', () => {
  describe('Job Model', () => {
    test('should create a valid job', () => {
      const validJob = {
        id: 'job1',
        locationName: '阳光花园1号楼101',
        address: '阳光路88号',
        lat: 31.234,
        lng: 121.456,
        serviceType: '维修',
        timeWindowStart: '09:00',
        timeWindowEnd: '11:00',
        serviceDurationMinutes: 30,
        priority: 1
      };

      const job = new Job(validJob);
      expect(job.id).toBe('job1');
      expect(job.locationName).toBe('阳光花园1号楼101');
      expect(job.serviceType).toBe('维修');
    });

    test('should validate required fields', () => {
      const invalidJob = {
        id: 'job1'
      };

      const job = new Job(invalidJob);
      const validation = job.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('locationName is required');
      expect(validation.errors).toContain('serviceType is required');
    });

    test('should validate time formats', () => {
      const invalidJob = {
        id: 'job1',
        locationName: 'Test',
        address: 'Test',
        lat: 31.234,
        lng: 121.456,
        serviceType: '维修',
        timeWindowStart: 'invalid',
        timeWindowEnd: '25:00',
        serviceDurationMinutes: 30,
        priority: 1
      };

      const job = new Job(invalidJob);
      const validation = job.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('timeWindowStart format is invalid (use HH:MM)');
      expect(validation.errors).toContain('timeWindowEnd format is invalid (use HH:MM)');
    });

    test('should validate time window order', () => {
      const invalidJob = {
        id: 'job1',
        locationName: 'Test',
        address: 'Test',
        lat: 31.234,
        lng: 121.456,
        serviceType: '维修',
        timeWindowStart: '11:00',
        timeWindowEnd: '09:00',
        serviceDurationMinutes: 30,
        priority: 1
      };

      const job = new Job(invalidJob);
      const validation = job.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('timeWindowStart must be before timeWindowEnd');
    });

    test('should validate coordinate range', () => {
      const invalidJob = {
        id: 'job1',
        locationName: 'Test',
        address: 'Test',
        lat: 100,
        lng: 200,
        serviceType: '维修',
        timeWindowStart: '09:00',
        timeWindowEnd: '11:00',
        serviceDurationMinutes: 30,
        priority: 1
      };

      const job = new Job(invalidJob);
      const validation = job.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('lat must be between -90 and 90');
      expect(validation.errors).toContain('lng must be between -180 and 180');
    });

    test('should validate service duration', () => {
      const invalidJob = {
        id: 'job1',
        locationName: 'Test',
        address: 'Test',
        lat: 31.234,
        lng: 121.456,
        serviceType: '维修',
        timeWindowStart: '09:00',
        timeWindowEnd: '11:00',
        serviceDurationMinutes: -10,
        priority: 1
      };

      const job = new Job(invalidJob);
      const validation = job.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('serviceDurationMinutes must be positive');
    });

    test('should validate priority range', () => {
      const invalidJob = {
        id: 'job1',
        locationName: 'Test',
        address: 'Test',
        lat: 31.234,
        lng: 121.456,
        serviceType: '维修',
        timeWindowStart: '09:00',
        timeWindowEnd: '11:00',
        serviceDurationMinutes: 30,
        priority: 6
      };

      const job = new Job(invalidJob);
      const validation = job.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('priority must be between 1 and 5');
    });
  });

  describe('Worker Model', () => {
    test('should create a valid worker', () => {
      const validWorker = {
        id: 'worker1',
        name: '张师傅',
        phone: '13800138001',
        skills: ['维修', '保洁'],
        startLocationName: '站点A',
        startLat: 31.230,
        startLng: 121.450,
        endLocationName: '站点A',
        endLat: 31.230,
        endLng: 121.450,
        workStartTime: '08:00',
        workEndTime: '18:00',
        maxJobs: 6,
        vehicleType: '电动车'
      };

      const worker = new Worker(validWorker);
      expect(worker.id).toBe('worker1');
      expect(worker.name).toBe('张师傅');
      expect(worker.skills).toEqual(['维修', '保洁']);
    });

    test('should validate required fields', () => {
      const invalidWorker = {
        id: 'worker1'
      };

      const worker = new Worker(invalidWorker);
      const validation = worker.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('name is required');
    });

    test('should validate skills is array', () => {
      const invalidWorker = {
        id: 'worker1',
        name: '张师傅',
        skills: 'not an array',
        startLocationName: '站点A',
        startLat: 31.230,
        startLng: 121.450,
        workStartTime: '08:00',
        workEndTime: '18:00'
      };

      const worker = new Worker(invalidWorker);
      const validation = worker.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('skills must be an array');
    });

    test('should validate time formats', () => {
      const invalidWorker = {
        id: 'worker1',
        name: '张师傅',
        skills: ['维修'],
        startLocationName: '站点A',
        startLat: 31.230,
        startLng: 121.450,
        workStartTime: 'invalid',
        workEndTime: '25:00'
      };

      const worker = new Worker(invalidWorker);
      const validation = worker.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('workStartTime format is invalid (use HH:MM)');
      expect(validation.errors).toContain('workEndTime format is invalid (use HH:MM)');
    });

    test('should validate work time order', () => {
      const invalidWorker = {
        id: 'worker1',
        name: '张师傅',
        skills: ['维修'],
        startLocationName: '站点A',
        startLat: 31.230,
        startLng: 121.450,
        workStartTime: '18:00',
        workEndTime: '08:00'
      };

      const worker = new Worker(invalidWorker);
      const validation = worker.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('workStartTime must be before workEndTime');
    });

    test('should validate maxJobs is positive', () => {
      const invalidWorker = {
        id: 'worker1',
        name: '张师傅',
        skills: ['维修'],
        startLocationName: '站点A',
        startLat: 31.230,
        startLng: 121.450,
        workStartTime: '08:00',
        workEndTime: '18:00',
        maxJobs: -5
      };

      const worker = new Worker(invalidWorker);
      const validation = worker.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('maxJobs must be positive');
    });

    test('should validate coordinates when provided', () => {
      const invalidWorker = {
        id: 'worker1',
        name: '张师傅',
        skills: ['维修'],
        startLocationName: '站点A',
        startLat: 100,
        startLng: 200,
        workStartTime: '08:00',
        workEndTime: '18:00'
      };

      const worker = new Worker(invalidWorker);
      const validation = worker.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('startLat must be between -90 and 90');
      expect(validation.errors).toContain('startLng must be between -180 and 180');
    });

    test('should check skill match', () => {
      const worker = new Worker({
        id: 'worker1',
        name: '张师傅',
        skills: ['维修', '保洁'],
        startLocationName: '站点A',
        startLat: 31.230,
        startLng: 121.450,
        workStartTime: '08:00',
        workEndTime: '18:00'
      });

      expect(worker.hasSkill('维修')).toBe(true);
      expect(worker.hasSkill('保洁')).toBe(true);
      expect(worker.hasSkill('洗衣')).toBe(false);
    });
  });
});
