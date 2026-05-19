const { runQuery, getQuery, allQuery } = require('../config/database');

class DriverDAO {
  async create(driverData) {
    const { driver_id, name, phone, id_card, status = 'active' } = driverData;
    await runQuery(
      `INSERT INTO drivers (driver_id, name, phone, id_card, status) VALUES (?, ?, ?, ?, ?)`,
      [driver_id, name, phone, id_card, status]
    );
    return this.getById(driver_id);
  }

  async getById(driver_id) {
    return getQuery(`SELECT * FROM drivers WHERE driver_id = ?`, [driver_id]);
  }

  async getAll() {
    return allQuery(`SELECT * FROM drivers ORDER BY created_at DESC`);
  }

  async update(driver_id, driverData) {
    const fields = [];
    const values = [];
    for (const key in driverData) {
      if (key !== 'driver_id') {
        fields.push(`${key} = ?`);
        values.push(driverData[key]);
      }
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(driver_id);
    await runQuery(`UPDATE drivers SET ${fields.join(', ')} WHERE driver_id = ?`, values);
    return this.getById(driver_id);
  }
}

class BusDAO {
  async create(busData) {
    const { bus_id, plate_number, route_name, capacity, status = 'active' } = busData;
    await runQuery(
      `INSERT INTO buses (bus_id, plate_number, route_name, capacity, status) VALUES (?, ?, ?, ?, ?)`,
      [bus_id, plate_number, route_name, capacity, status]
    );
    return this.getById(bus_id);
  }

  async getById(bus_id) {
    return getQuery(`SELECT * FROM buses WHERE bus_id = ?`, [bus_id]);
  }

  async getAll() {
    return allQuery(`SELECT * FROM buses ORDER BY created_at DESC`);
  }
}

class StudentDAO {
  async create(studentData) {
    const { student_id, name, parent_name, parent_phone, school_class, route_id } = studentData;
    await runQuery(
      `INSERT INTO students (student_id, name, parent_name, parent_phone, school_class, route_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [student_id, name, parent_name, parent_phone, school_class, route_id]
    );
    return this.getById(student_id);
  }

  async getById(student_id) {
    return getQuery(`SELECT * FROM students WHERE student_id = ?`, [student_id]);
  }

  async getAll() {
    return allQuery(`SELECT * FROM students ORDER BY created_at DESC`);
  }
}

module.exports = {
  DriverDAO,
  BusDAO,
  StudentDAO
};