const { db, generateId, now } = require('./database');

class Customer {
  static create(data) {
    return new Promise((resolve, reject) => {
      const id = generateId();
      const currentTime = now();
      const { name, phone, id_card, address } = data;
      
      db.run(
        'INSERT INTO customers (id, name, phone, id_card, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, name, phone, id_card, address, currentTime, currentTime],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id, name, phone, id_card, address, created_at: currentTime, updated_at: currentTime });
          }
        }
      );
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM customers ORDER BY created_at DESC', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM customers WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  static update(id, data) {
    return new Promise((resolve, reject) => {
      const currentTime = now();
      const { name, phone, id_card, address } = data;
      
      db.run(
        'UPDATE customers SET name = ?, phone = ?, id_card = ?, address = ?, updated_at = ? WHERE id = ?',
        [name, phone, id_card, address, currentTime, id],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id, name, phone, id_card, address, updated_at: currentTime });
          }
        }
      );
    });
  }
}

class Vehicle {
  static async create(data, operator = 'system', source = 'web') {
    const id = generateId();
    const currentTime = now();
    const { customer_id, plate_number, brand, model, year, vin, engine_number } = data;

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(
          'INSERT INTO vehicles (id, customer_id, plate_number, brand, model, year, vin, engine_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, customer_id, plate_number, brand, model, year, vin, engine_number, currentTime, currentTime],
          function(err) {
            if (err) {
              reject(err);
            } else {
              const materialTypes = global.MATERIAL_TYPES;
              const materialPromises = materialTypes.map(type => {
                return new Promise((resolveMat, rejectMat) => {
                  const materialId = generateId();
                  db.run(
                    'INSERT INTO materials (id, vehicle_id, material_type, is_collected, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
                    [materialId, id, type, currentTime, currentTime],
                    (errMat) => {
                      if (errMat) {
                        rejectMat(errMat);
                      } else {
                        resolveMat();
                      }
                    }
                  );
                };
              });

              Promise.all(materialPromises).then(() => {
                const statusId = generateId();
                db.run(
                  'INSERT INTO vehicle_status (id, vehicle_id, status, operator, source, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                  [statusId, id, 'created', operator, source, currentTime],
                  (errStatus) => {
                    if (errStatus) {
                      reject(errStatus);
                    } else {
                      const logId = generateId();
                      db.run(
                        'INSERT INTO operation_logs (id, vehicle_id, action, details, operator, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [logId, id, '创建车辆', `创建车辆 ${plate_number}`, operator, source, currentTime],
                        (errLog) => {
                          if (errLog) {
                            reject(errLog);
                          } else {
                            resolve({ id, customer_id, plate_number, brand, model, year, vin, engine_number, created_at: currentTime, updated_at: currentTime, status: 'created' });
                          }
                        }
                      );
                    }
                  }
                );
              }).catch(reject);
            }
          }
        );
      });
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT v.*, c.name as customer_name, c.phone as customer_phone,
               (SELECT status FROM vehicle_status vs WHERE vs.vehicle_id = v.id ORDER BY vs.created_at DESC LIMIT 1) as status
        FROM vehicles v
        LEFT JOIN customers c ON v.customer_id = c.id
        ORDER BY v.updated_at DESC
      `;
      db.all(query, (err, rows) => {
        if (err) {
          reject(err);
        } else {
            resolve(rows);
          }
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT v.*, c.name as customer_name, c.phone as customer_phone, c.id_card as customer_id_card, c.address as customer_address,
               (SELECT status FROM vehicle_status vs WHERE vs.vehicle_id = v.id ORDER BY vs.created_at DESC LIMIT 1) as status
        FROM vehicles v
        LEFT JOIN customers c ON v.customer_id = c.id
        WHERE v.id = ?
      `;
      db.get(query, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
            resolve(row);
          }
        }
      );
    });
  }

  static getCurrentStatus(vehicleId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT status FROM vehicle_status WHERE vehicle_id = ? ORDER BY created_at DESC LIMIT 1',
        [vehicleId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row ? row.status : null);
          }
        }
      );
    });
  }

  static async canTransitionTo(fromStatus, toStatus) {
    const transitions = global.STATUS_TRANSITIONS;
    const allowed = transitions[fromStatus] || [];
    return allowed.includes(toStatus);
  }

  static async changeStatus(vehicleId, newStatus, notes, operator = 'system', source = 'web') {
    const currentStatus = await this.getCurrentStatus(vehicleId);
    
    if (newStatus === 'inspection_failed' && !notes) {
      throw new Error('检测失败必须记录原因');
    }
    
    const canTransition = await this.canTransitionTo(currentStatus, newStatus);
    if (!canTransition) {
      throw new Error(`状态转换不允许: ${currentStatus} -> ${newStatus}`);
    }
    
    const id = generateId();
    const currentTime = now();
    
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(
          'INSERT INTO vehicle_status (id, vehicle_id, status, notes, operator, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, vehicleId, newStatus, notes, operator, source, currentTime],
          (errStatus) => {
            if (errStatus) {
              reject(errStatus);
            } else {
              const logId = generateId();
              const statusName = global.STATUS_NAMES[newStatus] || newStatus;
              db.run(
                'INSERT INTO operation_logs (id, vehicle_id, action, details, operator, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [logId, vehicleId, '状态变更', `状态变更为: ${statusName}${notes ? ` (备注: ${notes})` : ''}`, operator, source, currentTime],
                (errLog) => {
                  if (errLog) {
                    reject(errLog);
                  } else {
                    db.run(
                      'UPDATE vehicles SET updated_at = ? WHERE id = ?',
                      [currentTime, vehicleId],
                      (errUpdate) => {
                        if (errUpdate) {
                          reject(errUpdate);
                        } else {
                          resolve({ id, vehicle_id: vehicleId, status: newStatus, notes, operator, source, created_at: currentTime });
                        }
                      }
                    );
                  }
                }
              );
            }
          }
        );
      });
    });
  }

  static getStatusHistory(vehicleId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM vehicle_status WHERE vehicle_id = ? ORDER BY created_at ASC',
        [vehicleId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  static getOperationLogs(vehicleId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM operation_logs WHERE vehicle_id = ? ORDER BY created_at DESC',
        [vehicleId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }
}

class Material {
  static findByVehicleId(vehicleId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM materials WHERE vehicle_id = ? ORDER BY material_type', [vehicleId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static async collectMaterial(vehicleId, materialType, operator = 'system', source = 'web') {
    const currentTime = now();
    
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM materials WHERE vehicle_id = ? AND material_type = ?', [vehicleId, materialType], (err, material) => {
        if (err) {
          reject(err);
        } else if (!material) {
          reject(new Error(`材料不存在: ${materialType}`));
        } else {
          db.run(
            'UPDATE materials SET is_collected = 1, collected_at = ?, collected_by = ?, updated_at = ? WHERE id = ?',
            [currentTime, operator, currentTime, material.id],
            (errUpdate) => {
              if (errUpdate) {
                reject(errUpdate);
              } else {
                const logId = generateId();
                db.run(
                  'INSERT INTO operation_logs (id, vehicle_id, action, details, operator, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                  [logId, vehicleId, '收集材料', `收集材料: ${materialType}`, operator, source, currentTime],
                  (errLog) => {
                    if (errLog) {
                      reject(errLog);
                    } else {
                      resolve({ ...material, is_collected: 1, collected_at: currentTime, collected_by: operator });
                    }
                  }
                );
              }
            }
          );
        }
      });
    });
  }

  static async checkAllMaterialsCollected(vehicleId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count, SUM(CASE WHEN is_collected = 1 THEN 1 ELSE 0 END) as collected FROM materials WHERE vehicle_id = ?', [vehicleId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count > 0 && row.count === row.collected);
        }
      });
    });
  }
}

class Appointment {
  static async create(data, operator = 'system', source = 'web') {
    const id = generateId();
    const currentTime = now();
    const { vehicle_id, appointment_date, appointment_time, inspection_station } = data;

    const currentStatus = await Vehicle.getCurrentStatus(vehicle_id);
    if (currentStatus !== 'materials_collected' && currentStatus !== 'inspection_failed') {
      throw new Error('只有材料收齐后或检测失败后才能预约');
    }

    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO appointments (id, vehicle_id, appointment_date, appointment_time, inspection_station, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, vehicle_id, appointment_date, appointment_time, inspection_station, 'scheduled', currentTime, currentTime],
        function(err) {
          if (err) {
            reject(err);
          } else {
            const logId = generateId();
            db.run(
              'INSERT INTO operation_logs (id, vehicle_id, action, details, operator, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [logId, vehicle_id, '创建预约', `预约检测站: ${inspection_station}, 时间: ${appointment_date} ${appointment_time || ''}`, operator, source, currentTime],
              (errLog) => {
                if (errLog) {
                  reject(errLog);
                } else {
                  resolve({ id, vehicle_id, appointment_date, appointment_time, inspection_station, status: 'scheduled', created_at: currentTime, updated_at: currentTime });
                }
              }
            );
          }
        }
      );
    });
  }

  static findByVehicleId(vehicleId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM appointments WHERE vehicle_id = ? ORDER BY created_at DESC', [vehicleId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
            resolve(rows);
          }
        }
      );
    });
  }

  static update(id, data) {
    return new Promise((resolve, reject) => {
      const currentTime = now();
      const { appointment_date, appointment_time, inspection_station, status, inspection_result, failure_reason, inspector, notes } = data;
      
      db.run(
        'UPDATE appointments SET appointment_date = ?, appointment_time = ?, inspection_station = ?, status = ?, inspection_result = ?, failure_reason = ?, inspector = ?, notes = ?, updated_at = ? WHERE id = ?',
        [appointment_date, appointment_time, inspection_station, status, inspection_result, failure_reason, inspector, notes, currentTime, id],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id, appointment_date, appointment_time, inspection_station, status, inspection_result, failure_reason, inspector, notes, updated_at: currentTime });
          }
        }
      );
    });
  }
}

module.exports = {
  Customer,
  Vehicle,
  Material,
  Appointment
};
