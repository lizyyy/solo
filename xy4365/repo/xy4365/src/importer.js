const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');

class DataImporter {
  constructor(db) {
    this.db = db;
  }

  // 导入预约CSV
  async importAppointments(csvPath) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      let rowCount = 0;

      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (data) => {
          rowCount++;
          try {
            const appointment = this.parseAppointmentRow(data, rowCount);
            results.push(appointment);
          } catch (error) {
            errors.push({ row: rowCount, error: error.message });
          }
        })
        .on('end', () => {
          if (results.length > 0) {
            this.saveAppointments(results);
          }
          resolve({
            success: results.length,
            errors: errors,
            total: rowCount
          });
        })
        .on('error', reject);
    });
  }

  parseAppointmentRow(data, rowCount) {
    // 检查必填字段
    const requiredFields = ['appointment_id', 'user_id', 'machine_id', 'start_time', 'end_time'];
    for (const field of requiredFields) {
      if (!data[field] || data[field].trim() === '') {
        throw new Error(`缺少必填字段: ${field}`);
      }
    }

    // 解析时间
    const startTime = new Date(data.start_time.trim());
    const endTime = new Date(data.end_time.trim());

    if (isNaN(startTime.getTime())) {
      throw new Error(`无效的开始时间格式: ${data.start_time}`);
    }
    if (isNaN(endTime.getTime())) {
      throw new Error(`无效的结束时间格式: ${data.end_time}`);
    }
    if (startTime >= endTime) {
      throw new Error(`开始时间必须早于结束时间`);
    }

    return {
      appointment_id: data.appointment_id.trim(),
      user_id: data.user_id.trim(),
      machine_id: data.machine_id.trim(),
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      material_type: data.material_type ? data.material_type.trim() : null,
      material_thickness: data.material_thickness ? parseFloat(data.material_thickness) : null,
      power: data.power ? parseFloat(data.power) : null,
      speed: data.speed ? parseFloat(data.speed) : null,
      status: data.status ? data.status.trim() : 'pending'
    };
  }

  saveAppointments(appointments) {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO appointments 
      (appointment_id, user_id, machine_id, start_time, end_time, 
       material_type, material_thickness, power, speed, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items) => {
      for (const item of items) {
        insert.run(
          item.appointment_id,
          item.user_id,
          item.machine_id,
          item.start_time,
          item.end_time,
          item.material_type,
          item.material_thickness,
          item.power,
          item.speed,
          item.status
        );
      }
    });

    insertMany(appointments);
  }

  // 导入材料安全表JSON
  async importMaterials(jsonPath) {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const materials = Array.isArray(data) ? data : [data];
    const results = [];
    const errors = [];

    for (let i = 0; i < materials.length; i++) {
      try {
        const material = this.parseMaterial(materials[i], i + 1);
        results.push(material);
      } catch (error) {
        errors.push({ index: i + 1, error: error.message });
      }
    }

    if (results.length > 0) {
      this.saveMaterials(results);
    }

    return {
      success: results.length,
      errors: errors,
      total: materials.length
    };
  }

  parseMaterial(data, index) {
    const requiredFields = ['material_type', 'material_name'];
    for (const field of requiredFields) {
      if (!data[field] || data[field].toString().trim() === '') {
        throw new Error(`缺少必填字段: ${field}`);
      }
    }

    return {
      material_type: data.material_type.toString().trim(),
      material_name: data.material_name.toString().trim(),
      min_thickness: data.min_thickness ? parseFloat(data.min_thickness) : null,
      max_thickness: data.max_thickness ? parseFloat(data.max_thickness) : null,
      recommended_power_min: data.recommended_power_min ? parseFloat(data.recommended_power_min) : null,
      recommended_power_max: data.recommended_power_max ? parseFloat(data.recommended_power_max) : null,
      recommended_speed_min: data.recommended_speed_min ? parseFloat(data.recommended_speed_min) : null,
      recommended_speed_max: data.recommended_speed_max ? parseFloat(data.recommended_speed_max) : null,
      is_forbidden: data.is_forbidden === true || data.is_forbidden === 'true' || data.is_forbidden === 1 ? 1 : 0,
      safety_notes: data.safety_notes ? data.safety_notes.toString().trim() : null
    };
  }

  saveMaterials(materials) {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO materials 
      (material_type, material_name, min_thickness, max_thickness, 
       recommended_power_min, recommended_power_max, 
       recommended_speed_min, recommended_speed_max, 
       is_forbidden, safety_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items) => {
      for (const item of items) {
        insert.run(
          item.material_type,
          item.material_name,
          item.min_thickness,
          item.max_thickness,
          item.recommended_power_min,
          item.recommended_power_max,
          item.recommended_speed_min,
          item.recommended_speed_max,
          item.is_forbidden,
          item.safety_notes
        );
      }
    });

    insertMany(materials);
  }

  // 导入维护时段
  async importMaintenanceSlots(jsonPath) {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const slots = Array.isArray(data) ? data : [data];
    const results = [];
    const errors = [];

    for (let i = 0; i < slots.length; i++) {
      try {
        const slot = this.parseMaintenanceSlot(slots[i], i + 1);
        results.push(slot);
      } catch (error) {
        errors.push({ index: i + 1, error: error.message });
      }
    }

    if (results.length > 0) {
      this.saveMaintenanceSlots(results);
    }

    return {
      success: results.length,
      errors: errors,
      total: slots.length
    };
  }

  parseMaintenanceSlot(data, index) {
    const requiredFields = ['slot_id', 'machine_id', 'start_time', 'end_time'];
    for (const field of requiredFields) {
      if (!data[field] || data[field].toString().trim() === '') {
        throw new Error(`缺少必填字段: ${field}`);
      }
    }

    const startTime = new Date(data.start_time.trim());
    const endTime = new Date(data.end_time.trim());

    if (isNaN(startTime.getTime())) {
      throw new Error(`无效的开始时间格式: ${data.start_time}`);
    }
    if (isNaN(endTime.getTime())) {
      throw new Error(`无效的结束时间格式: ${data.end_time}`);
    }
    if (startTime >= endTime) {
      throw new Error(`开始时间必须早于结束时间`);
    }

    return {
      slot_id: data.slot_id.toString().trim(),
      machine_id: data.machine_id.toString().trim(),
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      maintenance_type: data.maintenance_type ? data.maintenance_type.toString().trim() : null,
      description: data.description ? data.description.toString().trim() : null
    };
  }

  saveMaintenanceSlots(slots) {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO maintenance_slots 
      (slot_id, machine_id, start_time, end_time, maintenance_type, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items) => {
      for (const item of items) {
        insert.run(
          item.slot_id,
          item.machine_id,
          item.start_time,
          item.end_time,
          item.maintenance_type,
          item.description
        );
      }
    });

    insertMany(slots);
  }

  // 导入开机记录
  async importOperationRecords(jsonPath) {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const records = Array.isArray(data) ? data : [data];
    const results = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      try {
        const record = this.parseOperationRecord(records[i], i + 1);
        results.push(record);
      } catch (error) {
        errors.push({ index: i + 1, error: error.message });
      }
    }

    if (results.length > 0) {
      this.saveOperationRecords(results);
    }

    return {
      success: results.length,
      errors: errors,
      total: records.length
    };
  }

  parseOperationRecord(data, index) {
    const requiredFields = ['record_id', 'machine_id', 'user_id', 'start_time'];
    for (const field of requiredFields) {
      if (!data[field] || data[field].toString().trim() === '') {
        throw new Error(`缺少必填字段: ${field}`);
      }
    }

    const startTime = new Date(data.start_time.trim());
    const endTime = data.end_time ? new Date(data.end_time.trim()) : null;

    if (isNaN(startTime.getTime())) {
      throw new Error(`无效的开始时间格式: ${data.start_time}`);
    }
    if (endTime && isNaN(endTime.getTime())) {
      throw new Error(`无效的结束时间格式: ${data.end_time}`);
    }
    if (endTime && startTime >= endTime) {
      throw new Error(`开始时间必须早于结束时间`);
    }

    return {
      record_id: data.record_id.toString().trim(),
      machine_id: data.machine_id.toString().trim(),
      user_id: data.user_id.toString().trim(),
      start_time: startTime.toISOString(),
      end_time: endTime ? endTime.toISOString() : null,
      actual_power: data.actual_power ? parseFloat(data.actual_power) : null,
      actual_speed: data.actual_speed ? parseFloat(data.actual_speed) : null,
      material_used: data.material_used ? data.material_used.toString().trim() : null,
      material_thickness_actual: data.material_thickness_actual ? parseFloat(data.material_thickness_actual) : null,
      notes: data.notes ? data.notes.toString().trim() : null
    };
  }

  saveOperationRecords(records) {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO operation_records 
      (record_id, machine_id, user_id, start_time, end_time, 
       actual_power, actual_speed, material_used, material_thickness_actual, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items) => {
      for (const item of items) {
        insert.run(
          item.record_id,
          item.machine_id,
          item.user_id,
          item.start_time,
          item.end_time,
          item.actual_power,
          item.actual_speed,
          item.material_used,
          item.material_thickness_actual,
          item.notes
        );
      }
    });

    insertMany(records);
  }

  // 导入用户数据（可选，用于培训状态检查）
  async importUsers(jsonPath) {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const users = Array.isArray(data) ? data : [data];
    const results = [];
    const errors = [];

    for (let i = 0; i < users.length; i++) {
      try {
        const user = this.parseUser(users[i], i + 1);
        results.push(user);
      } catch (error) {
        errors.push({ index: i + 1, error: error.message });
      }
    }

    if (results.length > 0) {
      this.saveUsers(results);
    }

    return {
      success: results.length,
      errors: errors,
      total: users.length
    };
  }

  parseUser(data, index) {
    const requiredFields = ['user_id', 'name'];
    for (const field of requiredFields) {
      if (!data[field] || data[field].toString().trim() === '') {
        throw new Error(`缺少必填字段: ${field}`);
      }
    }

    return {
      user_id: data.user_id.toString().trim(),
      name: data.name.toString().trim(),
      is_trained: data.is_trained === true || data.is_trained === 'true' || data.is_trained === 1 ? 1 : 0,
      training_date: data.training_date ? new Date(data.training_date).toISOString() : null
    };
  }

  saveUsers(users) {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO users 
      (user_id, name, is_trained, training_date)
      VALUES (?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items) => {
      for (const item of items) {
        insert.run(
          item.user_id,
          item.name,
          item.is_trained,
          item.training_date
        );
      }
    });

    insertMany(users);
  }
}

module.exports = DataImporter;
