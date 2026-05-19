const logger = require('../config/logger');
const { maskForLog, maskForResponse } = require('../utils/maskSensitive');
const { DriverCheckinDAO, GpsTrackDAO, ParentComplaintDAO } = require('../dao/reconciliationDAO');
const { ReconciliationRecordDAO, OperationLogDAO } = require('../dao/recordDAO');
const { DriverDAO, BusDAO, StudentDAO } = require('../dao/baseDAO');

const driverCheckinDAO = new DriverCheckinDAO();
const gpsTrackDAO = new GpsTrackDAO();
const parentComplaintDAO = new ParentComplaintDAO();
const reconciliationRecordDAO = new ReconciliationRecordDAO();
const operationLogDAO = new OperationLogDAO();
const driverDAO = new DriverDAO();
const busDAO = new BusDAO();
const studentDAO = new StudentDAO();

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const RECONCILIATION_RULES = {
  LATE_THRESHOLD_MINUTES: 10,
  GPS_DISTANCE_THRESHOLD_METERS: 500,
  CHECKIN_TIME_WINDOW_MINUTES: 30
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function getMinutesDifference(dateTime1, dateTime2) {
  const d1 = new Date(dateTime1);
  const d2 = new Date(dateTime2);
  return Math.round((d1 - d2) / (1000 * 60));
}

class ReconciliationService {
  async analyzeComplaint(complaintId) {
    const complaint = await parentComplaintDAO.getById(complaintId);
    if (!complaint) {
      throw new Error(`Complaint ${complaintId} not found`);
    }

    logger.info('Starting reconciliation analysis', maskForLog({ complaintId }));

    const student = await studentDAO.getById(complaint.student_id);
    const bus = complaint.bus_id ? await busDAO.getById(complaint.bus_id) : null;

    const date = complaint.complaint_date;
    
    const checkins = complaint.bus_id 
      ? await driverCheckinDAO.getByBusAndDate(complaint.bus_id, date)
      : [];
    
    const gpsTracks = complaint.bus_id
      ? await gpsTrackDAO.getByBusAndDate(complaint.bus_id, date)
      : [];

    const analysis = {
      complaint,
      student: maskForResponse(student),
      bus,
      checkins,
      gpsTracks: gpsTracks.slice(0, 100),
      findings: []
    };

    if (checkins.length > 0 && complaint.expected_arrival) {
      const expectedMinutes = parseTimeToMinutes(complaint.expected_arrival);
      
      for (const checkin of checkins) {
        const checkinDate = new Date(checkin.checkin_time);
        const checkinMinutes = checkinDate.getHours() * 60 + checkinDate.getMinutes();
        const diff = checkinMinutes - expectedMinutes;

        if (diff > RECONCILIATION_RULES.LATE_THRESHOLD_MINUTES) {
          analysis.findings.push({
            type: 'LATE_CHECKIN',
            severity: 'HIGH',
            message: `司机打卡迟到 ${diff} 分钟`,
            details: { checkinTime: checkin.checkin_time, expectedArrival: complaint.expected_arrival, diffMinutes: diff }
          });
        }
      }
    }

    if (gpsTracks.length > 0 && complaint.expected_arrival && checkins.length > 0) {
      const schoolLocation = { lat: 31.2304, lon: 121.4737 };
      
      let arrivalTrack = null;
      for (const track of gpsTracks) {
        const distance = calculateDistance(
          track.latitude, track.longitude,
          schoolLocation.lat, schoolLocation.lon
        );
        if (distance < RECONCILIATION_RULES.GPS_DISTANCE_THRESHOLD_METERS) {
          arrivalTrack = track;
          break;
        }
      }

      if (arrivalTrack && checkins.length > 0) {
        const gpsTime = new Date(arrivalTrack.record_time);
        const checkinTime = new Date(checkins[0].checkin_time);
        const timeDiff = getMinutesDifference(checkinTime, gpsTime);

        if (Math.abs(timeDiff) > RECONCILIATION_RULES.CHECKIN_TIME_WINDOW_MINUTES) {
          analysis.findings.push({
            type: 'GPS_CHECKIN_MISMATCH',
            severity: 'CRITICAL',
            message: `GPS到达与司机打卡相差 ${Math.abs(timeDiff)} 分钟`,
            details: { gpsArrivalTime: arrivalTrack.record_time, checkinTime: checkins[0].checkin_time, diffMinutes: Math.abs(timeDiff) }
          });
        }
      }
    }

    if (checkins.length === 0) {
      analysis.findings.push({
        type: 'NO_CHECKIN',
        severity: 'HIGH',
        message: '当日无司机打卡记录'
      });
    }

    if (gpsTracks.length === 0) {
      analysis.findings.push({
        type: 'NO_GPS_DATA',
        severity: 'HIGH',
        message: '当日无GPS轨迹数据'
      });
    }

    return analysis;
  }

  async createReconciliation(complaintId, operator = 'system') {
    const existingRecord = await reconciliationRecordDAO.getByComplaintId(complaintId);
    if (existingRecord) {
      return existingRecord;
    }

    const analysis = await this.analyzeComplaint(complaintId);
    const { complaint, checkins, gpsTracks, findings } = analysis;

    let checkinTime = null;
    let gpsArrivalTime = null;
    let timeDifference = null;
    let result = 'pending';
    let responsibility = 'pending';

    if (checkins.length > 0) {
      checkinTime = checkins[0].checkin_time;
    }

    const schoolLocation = { lat: 31.2304, lon: 121.4737 };
    let arrivalTrack = null;
    for (const track of gpsTracks) {
      const distance = calculateDistance(
        track.latitude, track.longitude,
        schoolLocation.lat, schoolLocation.lon
      );
      if (distance < RECONCILIATION_RULES.GPS_DISTANCE_THRESHOLD_METERS) {
        arrivalTrack = track;
        break;
      }
    }
    if (arrivalTrack) {
      gpsArrivalTime = arrivalTrack.record_time;
    }

    if (checkinTime && gpsArrivalTime) {
      timeDifference = getMinutesDifference(new Date(checkinTime), new Date(gpsArrivalTime));
      
      const criticalFindings = findings.filter(f => f.severity === 'CRITICAL');
      const highFindings = findings.filter(f => f.severity === 'HIGH');

      if (criticalFindings.length > 0) {
        result = 'data_mismatch';
        responsibility = 'to_review';
      } else if (highFindings.some(f => f.type === 'LATE_CHECKIN')) {
        result = 'late_confirmed';
        responsibility = 'driver';
      } else {
        result = 'normal';
        responsibility = 'none';
      }
    } else if (checkins.length === 0) {
      result = 'no_checkin_data';
      responsibility = 'to_review';
    } else if (gpsTracks.length === 0) {
      result = 'no_gps_data';
      responsibility = 'to_review';
    }

    const reconciliationId = generateId('RECON');

    const record = await reconciliationRecordDAO.create({
      reconciliation_id: reconciliationId,
      complaint_id: complaintId,
      bus_id: complaint.bus_id,
      driver_id: checkins.length > 0 ? checkins[0].driver_id : null,
      reconciliation_date: complaint.complaint_date,
      checkin_time: checkinTime,
      gps_arrival_time: gpsArrivalTime,
      time_difference: timeDifference,
      status: 'pending_review',
      result,
      responsibility,
      notes: findings.map(f => f.message).join('; ')
    });

    await parentComplaintDAO.updateStatus(complaintId, 'processing');

    await operationLogDAO.create({
      log_id: generateId('LOG'),
      operator,
      operation_type: 'create_reconciliation',
      target_type: 'reconciliation',
      target_id: reconciliationId,
      details: JSON.stringify({ complaintId, findings: findings.length })
    });

    logger.info('Reconciliation record created', maskForLog({ reconciliationId, complaintId }));

    return record;
  }

  async reviewReconciliation(reconciliationId, status, result, responsibility, notes, reviewedBy) {
    const validStatuses = ['approved', 'rejected', 'need_more_info'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const record = await reconciliationRecordDAO.review(
      reconciliationId,
      status,
      result,
      responsibility,
      notes,
      reviewedBy
    );

    if (record.complaint_id) {
      let complaintStatus = 'pending';
      if (status === 'approved') {
        complaintStatus = result === 'normal' ? 'resolved_no_issue' : 'resolved_issue';
      }
      await parentComplaintDAO.updateStatus(record.complaint_id, complaintStatus);
    }

    await operationLogDAO.create({
      log_id: generateId('LOG'),
      operator: reviewedBy,
      operation_type: 'review_reconciliation',
      target_type: 'reconciliation',
      target_id: reconciliationId,
      details: JSON.stringify({ status, result, responsibility })
    });

    logger.info('Reconciliation reviewed', maskForLog({ reconciliationId, status, reviewedBy }));

    return record;
  }

  async autoReconcilePendingComplaints(operator = 'system') {
    const pendingComplaints = await parentComplaintDAO.getByStatus('pending');
    const results = [];

    for (const complaint of pendingComplaints) {
      try {
        const record = await this.createReconciliation(complaint.complaint_id, operator);
        results.push({
          success: true,
          complaintId: complaint.complaint_id,
          reconciliationId: record.reconciliation_id
        });
      } catch (error) {
        results.push({
          success: false,
          complaintId: complaint.complaint_id,
          error: error.message
        });
        logger.error('Auto reconcile failed', maskForLog({ complaintId: complaint.complaint_id, error: error.message }));
      }
    }

    return {
      total: pendingComplaints.length,
      successCount: results.filter(r => r.success).length,
      failedCount: results.filter(r => !r.success).length,
      details: results
    };
  }

  async getReconciliationList(filters = {}) {
    const { status, startDate, endDate } = filters;

    let records;
    if (status) {
      records = await reconciliationRecordDAO.getByStatus(status);
    } else if (startDate && endDate) {
      records = await reconciliationRecordDAO.getByDateRange(startDate, endDate);
    } else {
      records = await reconciliationRecordDAO.getAll();
    }

    return maskForResponse(records);
  }

  async getReconciliationDetail(reconciliationId) {
    const record = await reconciliationRecordDAO.getById(reconciliationId);
    if (!record) {
      throw new Error(`Reconciliation ${reconciliationId} not found`);
    }
    return maskForResponse(record);
  }

  async getStatistics() {
    const complaints = await parentComplaintDAO.getAll();
    const reconciliations = await reconciliationRecordDAO.getAll();

    return {
      totalComplaints: complaints.length,
      pendingComplaints: complaints.filter(c => c.status === 'pending').length,
      processingComplaints: complaints.filter(c => c.status === 'processing').length,
      resolvedComplaints: complaints.filter(c => c.status.startsWith('resolved')).length,
      totalReconciliations: reconciliations.length,
      pendingReview: reconciliations.filter(r => r.status === 'pending_review').length,
      approved: reconciliations.filter(r => r.status === 'approved').length,
      driverResponsibility: reconciliations.filter(r => r.responsibility === 'driver').length,
      dataMismatch: reconciliations.filter(r => r.result === 'data_mismatch').length
    };
  }
}

module.exports = ReconciliationService;