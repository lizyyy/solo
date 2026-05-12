const moment = require('moment');
const store = require('../store');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

class ReportService {
  getSummary(date) {
    const targetDate = date || moment().format('YYYY-MM-DD');
    
    const requests = Array.from(store.temporaryStopRequests.values())
      .filter(r => r.effectiveDate === targetDate);
    
    const stops = Array.from(store.studentStops.values())
      .filter(s => s.scheduledDate === targetDate);
    
    const safetyRecords = Array.from(store.safetyRecords.values())
      .filter(r => moment(r.recordedAt).format('YYYY-MM-DD') === targetDate);

    const temporaryStops = stops.filter(s => s.isTemporary);
    const regularStops = stops.filter(s => !s.isTemporary);

    return {
      success: true,
      data: {
        date: targetDate,
        requests: {
          total: requests.length,
          pending: requests.filter(r => r.status === 'pending').length,
          approved: requests.filter(r => r.status === 'approved').length,
          implemented: requests.filter(r => r.status === 'implemented').length,
          completed: requests.filter(r => r.status === 'completed').length,
          cancelled: requests.filter(r => r.status === 'cancelled').length,
          withdrawn: requests.filter(r => r.status === 'withdrawn').length
        },
        stops: {
          total: stops.length,
          temporary: temporaryStops.length,
          regular: regularStops.length,
          pending: stops.filter(s => s.status === 'pending').length,
          completed: stops.filter(s => s.status === 'completed').length
        },
        safety: {
          total: safetyRecords.length,
          temporaryStopsCovered: safetyRecords.filter(r => r.isTemporary).length,
          totalStudents: safetyRecords.reduce((sum, r) => sum + r.studentCount, 0),
          totalBoarding: safetyRecords.reduce((sum, r) => sum + r.boardingCount, 0),
          totalAlighting: safetyRecords.reduce((sum, r) => sum + r.alightingCount, 0)
        }
      }
    };
  }

  async exportDailyReport(date) {
    const summary = this.getSummary(date);
    if (!summary.success) {
      return summary;
    }

    const targetDate = summary.data.date;
    const exportDir = path.join(process.cwd(), 'exports');
    
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filePath = path.join(exportDir, `daily-report-${targetDate}.csv`);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'type', title: '类型' },
        { id: 'date', title: '日期' },
        { id: 'routeId', title: '线路ID' },
        { id: 'stopName', title: '站点名称' },
        { id: 'isTemporary', title: '是否临停' },
        { id: 'scheduledTime', title: '计划时间' },
        { id: 'actualTime', title: '实际时间' },
        { id: 'studentCount', title: '计划学生数' },
        { id: 'actualStudentCount', title: '实际学生数' },
        { id: 'status', title: '状态' },
        { id: 'safetyRecorded', title: '安全记录' }
      ]
    });

    const stops = Array.from(store.studentStops.values())
      .filter(s => s.scheduledDate === targetDate)
      .map(s => ({
        type: '站点',
        date: targetDate,
        routeId: s.routeId,
        stopName: s.stopName,
        isTemporary: s.isTemporary ? '是' : '否',
        scheduledTime: s.scheduledTime,
        actualTime: s.actualTime || '-',
        studentCount: s.studentCount,
        actualStudentCount: s.actualStudentCount || '-',
        status: s.status,
        safetyRecorded: s.safetyRecordId ? '已记录' : '未记录'
      }));

    await csvWriter.writeRecords(stops);

    return {
      success: true,
      data: {
        filePath,
        summary: summary.data
      }
    };
  }

  getDetailedReport(date) {
    const targetDate = date || moment().format('YYYY-MM-DD');
    
    const requests = Array.from(store.temporaryStopRequests.values())
      .filter(r => r.effectiveDate === targetDate);
    
    const stops = Array.from(store.studentStops.values())
      .filter(s => s.scheduledDate === targetDate);
    
    const safetyRecords = Array.from(store.safetyRecords.values())
      .filter(r => moment(r.recordedAt).format('YYYY-MM-DD') === targetDate);

    return {
      success: true,
      data: {
        summary: this.getSummary(date).data,
        temporaryStopRequests: requests,
        studentStops: stops,
        safetyRecords: safetyRecords
      }
    };
  }
}

module.exports = new ReportService();