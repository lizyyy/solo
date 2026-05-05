const fs = require('fs');
const csv = require('csv-parser');
const moment = require('moment');
const db = require('../database/database');

async function importOrdersFromCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const errors = [];
    let importedCount = 0;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          for (const row of results) {
            try {
              const existing = await db.get(
                'SELECT id FROM artworks WHERE order_number = ?',
                [row.订单号 || row.order_number || row.OrderNumber]
              );

              const orderNumber = row.订单号 || row.order_number || row.OrderNumber;
              const artworkName = row.作品名称 || row.artwork_name || row.ArtworkName;
              const clientName = row.客户名称 || row.client_name || row.ClientName;
              const type = row.类型 || row.type || row.Type;
              const description = row.描述 || row.description || row.Description;
              const startDate = row.开始日期 || row.start_date || row.StartDate;
              const expectedDate = row.预计完成日期 || row.expected_completion_date || row.ExpectedCompletionDate;

              if (!orderNumber || !artworkName) {
                errors.push({ row, error: '缺少订单号或作品名称' });
                continue;
              }

              if (existing) {
                await db.run(`
                  UPDATE artworks 
                  SET client_name = ?, artwork_name = ?, type = ?, 
                      description = ?, start_date = ?, expected_completion_date = ?,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?
                `, [clientName, artworkName, type, description, startDate, expectedDate, existing.id]);
                importedCount++;
              } else {
                await db.run(`
                  INSERT INTO artworks 
                  (order_number, client_name, artwork_name, type, description, start_date, expected_completion_date)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [orderNumber, clientName, artworkName, type, description, startDate, expectedDate]);
                importedCount++;
              }
            } catch (err) {
              errors.push({ row, error: err.message });
            }
          }

          resolve({
            total: results.length,
            imported: importedCount,
            errors: errors.length,
            errorDetails: errors
          });
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject);
  });
}

async function importWetroomReadingsFromJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  const readings = Array.isArray(data) ? data : (data.readings || data.data || []);
  const errors = [];
  let importedCount = 0;

  for (const reading of readings) {
    try {
      const cabinetId = reading.cabinet_id || reading.cabinetId || reading.柜号 || reading.cabinet;
      const readingTime = reading.reading_time || reading.timestamp || reading.读数时间 || reading.time;
      const temperature = reading.temperature || reading.温度 || reading.temp;
      const humidity = reading.humidity || reading.湿度;
      const recordedBy = reading.recorded_by || reading.记录人 || reading.recordedBy;
      const notes = reading.notes || reading.备注;

      if (!cabinetId || !readingTime || temperature === undefined || humidity === undefined) {
        errors.push({ reading, error: '缺少柜号、读数时间、温度或湿度' });
        continue;
      }

      const existing = await db.get(
        'SELECT id FROM wetroom_readings WHERE cabinet_id = ? AND reading_time = ?',
        [cabinetId, readingTime]
      );

      if (existing) {
        await db.run(`
          UPDATE wetroom_readings 
          SET temperature = ?, humidity = ?, recorded_by = ?, notes = ?
          WHERE id = ?
        `, [temperature, humidity, recordedBy, notes, existing.id]);
        importedCount++;
      } else {
        await db.run(`
          INSERT INTO wetroom_readings 
          (cabinet_id, reading_time, temperature, humidity, recorded_by, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [cabinetId, readingTime, temperature, humidity, recordedBy, notes]);
        importedCount++;
      }
    } catch (err) {
      errors.push({ reading, error: err.message });
    }
  }

  return {
    total: readings.length,
    imported: importedCount,
    errors: errors.length,
    errorDetails: errors
  };
}

async function importLayerProcessesFromCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const errors = [];
    let importedCount = 0;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          for (const row of results) {
            try {
              const orderNumber = row.订单号 || row.order_number || row.OrderNumber;
              const layerNumber = parseInt(row.层数 || row.layer_number || row.LayerNumber) || 1;
              const lacquerType = row.漆型 || row.lacquer_type || row.LacquerType;
              const thickness = row.厚度 || row.thickness || row.Thickness;
              const color = row.颜色 || row.color || row.Color;
              const layerNotes = row.层次备注 || row.layer_notes || row.LayerNotes;
              
              const processType = row.工序 || row.process_type || row.ProcessType;
              const startTime = row.开始时间 || row.start_time || row.StartTime;
              const endTime = row.结束时间 || row.end_time || row.EndTime;
              const duration = parseFloat(row.时长 || row.duration || row.Duration) || 0;
              const status = row.状态 || row.status || row.Status || 'pending';
              const operator = row.操作人 || row.operator || row.Operator;
              const processNotes = row.工序备注 || row.process_notes || row.ProcessNotes;

              if (!orderNumber) {
                errors.push({ row, error: '缺少订单号' });
                continue;
              }

              let artwork = await db.get(
                'SELECT id FROM artworks WHERE order_number = ?',
                [orderNumber]
              );

              if (!artwork) {
                await db.run(`
                  INSERT INTO artworks (order_number, artwork_name)
                  VALUES (?, ?)
                `, [orderNumber, `未命名作品-${orderNumber}`]);
                artwork = await db.get(
                  'SELECT id FROM artworks WHERE order_number = ?',
                  [orderNumber]
                );
              }

              let layer = await db.get(
                'SELECT id FROM layers WHERE artwork_id = ? AND layer_number = ?',
                [artwork.id, layerNumber]
              );

              if (!layer) {
                const result = await db.run(`
                  INSERT INTO layers 
                  (artwork_id, layer_number, lacquer_type, thickness, color, notes)
                  VALUES (?, ?, ?, ?, ?, ?)
                `, [artwork.id, layerNumber, lacquerType, thickness, color, layerNotes]);
                layer = { id: result.lastID };
              } else {
                await db.run(`
                  UPDATE layers 
                  SET lacquer_type = ?, thickness = ?, color = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?
                `, [lacquerType, thickness, color, layerNotes, layer.id]);
              }

              if (processType) {
                const existingProcess = await db.get(
                  'SELECT id FROM processes WHERE layer_id = ? AND process_type = ?',
                  [layer.id, processType]
                );

                if (existingProcess) {
                  await db.run(`
                    UPDATE processes 
                    SET start_time = ?, end_time = ?, duration_hours = ?, 
                        status = ?, operator_name = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                  `, [startTime, endTime, duration, status, operator, processNotes, existingProcess.id]);
                  importedCount++;
                } else {
                  await db.run(`
                    INSERT INTO processes 
                    (layer_id, process_type, start_time, end_time, duration_hours, status, operator_name, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  `, [layer.id, processType, startTime, endTime, duration, status, operator, processNotes]);
                  importedCount++;
                }
              } else {
                importedCount++;
              }
            } catch (err) {
              errors.push({ row, error: err.message });
            }
          }

          resolve({
            total: results.length,
            imported: importedCount,
            errors: errors.length,
            errorDetails: errors
          });
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject);
  });
}

async function importHandoverNotesFromText(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const errors = [];
  let importedCount = 0;

  const notes = [];
  let currentNote = null;

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('---') || trimmed.startsWith('===')) {
      if (currentNote) {
        notes.push(currentNote);
      }
      currentNote = {};
      continue;
    }

    if (!currentNote) continue;

    if (trimmed.includes('订单号') || trimmed.includes('order_number')) {
      currentNote.orderNumber = trimmed.split(/[:：]/)[1]?.trim();
    } else if (trimmed.includes('交接人') || trimmed.includes('from_apprentice')) {
      currentNote.fromApprentice = trimmed.split(/[:：]/)[1]?.trim();
    } else if (trimmed.includes('接收人') || trimmed.includes('to_apprentice')) {
      currentNote.toApprentice = trimmed.split(/[:：]/)[1]?.trim();
    } else if (trimmed.includes('交接日期') || trimmed.includes('handover_date')) {
      currentNote.handoverDate = trimmed.split(/[:：]/)[1]?.trim();
    } else if (trimmed.includes('层数') || trimmed.includes('layer_number')) {
      currentNote.layerNumber = parseInt(trimmed.split(/[:：]/)[1]?.trim()) || 1;
    } else if (trimmed.includes('下一工序') || trimmed.includes('next_process')) {
      currentNote.nextProcess = trimmed.split(/[:：]/)[1]?.trim();
    } else if (trimmed.includes('备注') || trimmed.includes('notes') || trimmed.includes('说明')) {
      currentNote.notes = trimmed.split(/[:：]/)[1]?.trim() || trimmed;
    } else if (trimmed) {
      if (currentNote.notes) {
        currentNote.notes += ' ' + trimmed;
      } else {
        currentNote.notes = trimmed;
      }
    }
  }

  if (currentNote && Object.keys(currentNote).length > 0) {
    notes.push(currentNote);
  }

  for (const note of notes) {
    try {
      if (!note.orderNumber) {
        errors.push({ note, error: '缺少订单号' });
        continue;
      }

      let artwork = await db.get(
        'SELECT id FROM artworks WHERE order_number = ?',
        [note.orderNumber]
      );

      if (!artwork) {
        await db.run(`
          INSERT INTO artworks (order_number, artwork_name)
          VALUES (?, ?)
        `, [note.orderNumber, `未命名作品-${note.orderNumber}`]);
        artwork = await db.get(
          'SELECT id FROM artworks WHERE order_number = ?',
          [note.orderNumber]
        );
      }

      await db.run(`
        INSERT INTO handover_notes 
        (artwork_id, from_apprentice, to_apprentice, handover_date, notes, layer_number, next_process)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        artwork.id,
        note.fromApprentice,
        note.toApprentice,
        note.handoverDate || moment().format('YYYY-MM-DD HH:mm:ss'),
        note.notes,
        note.layerNumber,
        note.nextProcess
      ]);
      importedCount++;
    } catch (err) {
      errors.push({ note, error: err.message });
    }
  }

  return {
    total: notes.length,
    imported: importedCount,
    errors: errors.length,
    errorDetails: errors
  };
}

module.exports = {
  importOrdersFromCSV,
  importWetroomReadingsFromJSON,
  importLayerProcessesFromCSV,
  importHandoverNotesFromText
};
