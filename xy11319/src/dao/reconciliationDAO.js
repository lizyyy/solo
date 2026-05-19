const { runQuery, getQuery, allQuery } = require('../config/database');

class DriverCheckinDAO {
  async create(checkinData) {
    const { checkin_id, driver_id, bus_id, checkin_time, checkout_time, location, latitude, longitude, checkin_type = 'morning', status = 'completed', import_batch_id } = checkinData;
    await runQuery(
      `INSERT INTO driver_checkins (checkin_id, driver_id, bus_id, checkin_time, checkout_time, location, latitude, longitude, checkin_type, status, import_batch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [checkin_id, driver_id, bus_id, checkin_time, checkout_time, location, latitude, longitude, checkin_type, status, import_batch_id]
    );
    return this.getById(checkin_id);
  }

  async getById(checkin_id) {
    return getQuery(`SELECT * FROM driver_checkins WHERE checkin_id = ?`, [checkin_id]);
  }

  async getByDriverAndDate(driver_id, date) {
    return allQuery(
      `SELECT * FROM driver_checkins WHERE driver_id = ? AND DATE(checkin_time) = ? ORDER BY checkin_time`,
      [driver_id, date]
    );
  }

  async getByBusAndDate(bus_id, date) {
    return allQuery(
      `SELECT * FROM driver_checkins WHERE bus_id = ? AND DATE(checkin_time) = ? ORDER BY checkin_time`,
      [bus_id, date]
    );
  }

  async getByDateRange(startDate, endDate) {
    return allQuery(
      `SELECT * FROM driver_checkins WHERE DATE(checkin_time) BETWEEN ? AND ? ORDER BY checkin_time DESC`,
      [startDate, endDate]
    );
  }

  async getAll() {
    return allQuery(`SELECT * FROM driver_checkins ORDER BY checkin_time DESC`);
  }

  async batchCreate(checkins) {
    const results = [];
    for (const checkin of checkins) {
      try {
        const result = await this.create(checkin);
        results.push({ success: true, data: result });
      } catch (error) {
        results.push({ success: false, error: error.message, data: checkin });
      }
    }
    return results;
  }
}

class GpsTrackDAO {
  async create(trackData) {
    const { track_id, bus_id, record_time, latitude, longitude, speed, heading, satellites, import_batch_id } = trackData;
    await runQuery(
      `INSERT INTO gps_tracks (track_id, bus_id, record_time, latitude, longitude, speed, heading, satellites, import_batch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [track_id, bus_id, record_time, latitude, longitude, speed, heading, satellites, import_batch_id]
    );
    return this.getById(track_id);
  }

  async getById(track_id) {
    return getQuery(`SELECT * FROM gps_tracks WHERE track_id = ?`, [track_id]);
  }

  async getByBusAndDate(bus_id, date) {
    return allQuery(
      `SELECT * FROM gps_tracks WHERE bus_id = ? AND DATE(record_time) = ? ORDER BY record_time`,
      [bus_id, date]
    );
  }

  async getByBusAndTimeRange(bus_id, startTime, endTime) {
    return allQuery(
      `SELECT * FROM gps_tracks WHERE bus_id = ? AND record_time BETWEEN ? AND ? ORDER BY record_time`,
      [bus_id, startTime, endTime]
    );
  }

  async getAll() {
    return allQuery(`SELECT * FROM gps_tracks ORDER BY record_time DESC LIMIT 1000`);
  }

  async batchCreate(tracks) {
    const results = [];
    for (const track of tracks) {
      try {
        const result = await this.create(track);
        results.push({ success: true, data: result });
      } catch (error) {
        results.push({ success: false, error: error.message, data: track });
      }
    }
    return results;
  }
}

class ParentComplaintDAO {
  async create(complaintData) {
    const { complaint_id, student_id, bus_id, complaint_date, complaint_type, description, expected_arrival, actual_arrival, status = 'pending', import_batch_id } = complaintData;
    await runQuery(
      `INSERT INTO parent_complaints (complaint_id, student_id, bus_id, complaint_date, complaint_type, description, expected_arrival, actual_arrival, status, import_batch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [complaint_id, student_id, bus_id, complaint_date, complaint_type, description, expected_arrival, actual_arrival, status, import_batch_id]
    );
    return this.getById(complaint_id);
  }

  async getById(complaint_id) {
    return getQuery(`SELECT * FROM parent_complaints WHERE complaint_id = ?`, [complaint_id]);
  }

  async getByDateRange(startDate, endDate) {
    return allQuery(
      `SELECT * FROM parent_complaints WHERE complaint_date BETWEEN ? AND ? ORDER BY complaint_date DESC`,
      [startDate, endDate]
    );
  }

  async getByStatus(status) {
    return allQuery(
      `SELECT * FROM parent_complaints WHERE status = ? ORDER BY created_at DESC`,
      [status]
    );
  }

  async getAll() {
    return allQuery(`SELECT * FROM parent_complaints ORDER BY created_at DESC`);
  }

  async updateStatus(complaint_id, status) {
    await runQuery(
      `UPDATE parent_complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE complaint_id = ?`,
      [status, complaint_id]
    );
    return this.getById(complaint_id);
  }

  async batchCreate(complaints) {
    const results = [];
    for (const complaint of complaints) {
      try {
        const result = await this.create(complaint);
        results.push({ success: true, data: result });
      } catch (error) {
        results.push({ success: false, error: error.message, data: complaint });
      }
    }
    return results;
  }
}

module.exports = {
  DriverCheckinDAO,
  GpsTrackDAO,
  ParentComplaintDAO
};