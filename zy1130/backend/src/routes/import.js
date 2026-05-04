const express = require('express');
const router = express.Router();
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const jobRepository = require('../repositories/JobRepository');
const workerRepository = require('../repositories/WorkerRepository');
const { runAsync } = require('../database');

const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 CSV 和 JSON 格式的文件'));
    }
  }
});

router.post('/jobs', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '没有上传文件'
      });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    let jobs = [];

    if (ext === '.csv') {
      jobs = await parseJobsCSV(req.file.path);
    } else if (ext === '.json') {
      const content = fs.readFileSync(req.file.path, 'utf-8');
      const data = JSON.parse(content);
      jobs = Array.isArray(data) ? data : [data];
    }

    const { clearExisting } = req.body;
    if (clearExisting) {
      await jobRepository.deleteAll();
    }

    const created = [];
    const errors = [];

    for (let i = 0; i < jobs.length; i++) {
      try {
        const job = await jobRepository.create(jobs[i]);
        created.push(job.toJSON());
      } catch (error) {
        errors.push({
          index: i,
          data: jobs[i],
          error: error.message
        });
      }
    }

    await logImport('jobs', req.file.originalname, created.length, errors.length);

    res.json({
      success: true,
      data: {
        created: created.length,
        errors: errors.length,
        createdJobs: created,
        errorDetails: errors
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/workers', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '没有上传文件'
      });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    let workers = [];

    if (ext === '.csv') {
      workers = await parseWorkersCSV(req.file.path);
    } else if (ext === '.json') {
      const content = fs.readFileSync(req.file.path, 'utf-8');
      const data = JSON.parse(content);
      workers = Array.isArray(data) ? data : [data];
    }

    const { clearExisting } = req.body;
    if (clearExisting) {
      await workerRepository.deleteAll();
    }

    const created = [];
    const errors = [];

    for (let i = 0; i < workers.length; i++) {
      try {
        const worker = await workerRepository.create(workers[i]);
        created.push(worker.toJSON());
      } catch (error) {
        errors.push({
          index: i,
          data: workers[i],
          error: error.message
        });
      }
    }

    await logImport('workers', req.file.originalname, created.length, errors.length);

    res.json({
      success: true,
      data: {
        created: created.length,
        errors: errors.length,
        createdWorkers: created,
        errorDetails: errors
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/travel-times', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '没有上传文件'
      });
    }

    const content = fs.readFileSync(req.file.path, 'utf-8');
    const data = JSON.parse(content);

    const targetPath = path.join(__dirname, '../../../data/travel-times.json');
    fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));

    await logImport('travel-times', req.file.originalname, 1, 0);

    res.json({
      success: true,
      message: '行程时间数据已更新'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/road-rules', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '没有上传文件'
      });
    }

    const content = fs.readFileSync(req.file.path, 'utf-8');
    const data = JSON.parse(content);

    const targetPath = path.join(__dirname, '../../../data/road-rules.json');
    fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));

    await logImport('road-rules', req.file.originalname, 1, 0);

    res.json({
      success: true,
      message: '道路规则数据已更新'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function parseJobsCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        results.push({
          id: row.id,
          clientName: row.client_name || row.clientName,
          address: row.address,
          lat: parseFloat(row.lat),
          lng: parseFloat(row.lng),
          serviceType: row.service_type || row.serviceType,
          timeWindowStart: row.time_window_start || row.timeWindowStart,
          timeWindowEnd: row.time_window_end || row.timeWindowEnd,
          serviceDuration: parseInt(row.service_duration || row.serviceDuration || 30, 10),
          priority: row.priority || 'medium',
          notes: row.notes
        });
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

function parseWorkersCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        results.push({
          id: row.id,
          name: row.name,
          phone: row.phone,
          skills: row.skills,
          startLocation: {
            lat: parseFloat(row.start_location_lat),
            lng: parseFloat(row.start_location_lng)
          },
          endLocation: {
            lat: parseFloat(row.end_location_lat),
            lng: parseFloat(row.end_location_lng)
          },
          workStartTime: row.work_start_time || row.workStartTime,
          workEndTime: row.work_end_time || row.workEndTime,
          lunchStart: row.lunch_start || row.lunchStart,
          lunchEnd: row.lunch_end || row.lunchEnd,
          maxJobsPerDay: parseInt(row.max_jobs_per_day || row.maxJobsPerDay || 10, 10),
          vehicleType: row.vehicle_type || row.vehicleType || 'electric_bike'
        });
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

async function logImport(fileType, fileName, recordCount, errorCount) {
  const now = new Date().toISOString();
  const status = errorCount > 0 ? 'partial' : 'success';
  
  await runAsync(`
    INSERT INTO imports (id, file_type, file_name, record_count, status, error_message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    uuidv4(),
    fileType,
    fileName,
    recordCount,
    status,
    errorCount > 0 ? `${errorCount} 条记录导入失败` : null,
    now
  ]);
}

module.exports = router;
