const csv = require('csv-parser');
const fs = require('fs');
const db = require('../models/database');

function importVesselSchedule(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          const imported = [];
          for (const row of results) {
            const vessel = await upsertVessel(row);
            imported.push(vessel);
          }
          resolve(imported);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

function upsertVessel(data) {
  return new Promise((resolve, reject) => {
    const imo = data.imo || data.vessel_imo || '';
    db.get('SELECT id FROM vessels WHERE vessel_imo = ? OR vessel_name = ?', 
      [imo, data.vessel_name || data.name], 
      (err, row) => {
        if (err) return reject(err);
        
        const vesselData = {
          vessel_name: data.vessel_name || data.name || '',
          vessel_imo: imo,
          draft: parseFloat(data.draft || data.draught || 0),
          length: parseFloat(data.length || 0),
          width: parseFloat(data.width || 0),
          agent: data.agent || ''
        };

        if (row) {
          db.run(`
            UPDATE vessels 
            SET vessel_name = ?, draft = ?, length = ?, width = ?, agent = ?
            WHERE id = ?
          `, [vesselData.vessel_name, vesselData.draft, vesselData.length, 
              vesselData.width, vesselData.agent, row.id], 
            function(err) {
              if (err) return reject(err);
              resolve({ id: row.id, ...vesselData });
            }
          );
        } else {
          db.run(`
            INSERT INTO vessels (vessel_name, vessel_imo, draft, length, width, agent)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [vesselData.vessel_name, vesselData.vessel_imo, vesselData.draft, 
              vesselData.length, vesselData.width, vesselData.agent], 
            function(err) {
              if (err) return reject(err);
              resolve({ id: this.lastID, ...vesselData });
            }
          );
        }
      }
    );
  });
}

function importBerths(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', async (err, data) => {
      if (err) return reject(err);
      try {
        const berths = JSON.parse(data);
        const imported = [];
        for (const berth of berths) {
          const result = await upsertBerth(berth);
          imported.push(result);
        }
        resolve(imported);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function upsertBerth(data) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM berths WHERE berth_no = ?', 
      [data.berth_no], 
      (err, row) => {
        if (err) return reject(err);
        
        const berthData = {
          berth_no: data.berth_no,
          berth_name: data.berth_name || data.name || '',
          max_draft: parseFloat(data.max_draft || data.draft_limit || 0),
          max_length: parseFloat(data.max_length || 0)
        };

        if (row) {
          db.run(`
            UPDATE berths 
            SET berth_name = ?, max_draft = ?, max_length = ?
            WHERE id = ?
          `, [berthData.berth_name, berthData.max_draft, berthData.max_length, row.id], 
            function(err) {
              if (err) return reject(err);
              resolve({ id: row.id, ...berthData });
            }
          );
        } else {
          db.run(`
            INSERT INTO berths (berth_no, berth_name, max_draft, max_length)
            VALUES (?, ?, ?, ?)
          `, [berthData.berth_no, berthData.berth_name, berthData.max_draft, berthData.max_length], 
            function(err) {
              if (err) return reject(err);
              resolve({ id: this.lastID, ...berthData });
            }
          );
        }
      }
    );
  });
}

function importTideSchedule(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          const imported = [];
          for (const row of results) {
            const tide = await upsertTide(row);
            imported.push(tide);
          }
          resolve(imported);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

function upsertTide(data) {
  return new Promise((resolve, reject) => {
    const tideDate = data.date || data.tide_date || '';
    const tideTime = data.time || data.tide_time || '';
    
    db.get('SELECT id FROM tide_schedules WHERE tide_date = ? AND tide_time = ?', 
      [tideDate, tideTime], 
      (err, row) => {
        if (err) return reject(err);
        
        const tideData = {
          tide_date: tideDate,
          tide_time: tideTime,
          tide_height: parseFloat(data.height || data.tide_height || 0),
          tide_type: data.type || data.tide_type || ''
        };

        if (row) {
          db.run(`
            UPDATE tide_schedules 
            SET tide_height = ?, tide_type = ?
            WHERE id = ?
          `, [tideData.tide_height, tideData.tide_type, row.id], 
            function(err) {
              if (err) return reject(err);
              resolve({ id: row.id, ...tideData });
            }
          );
        } else {
          db.run(`
            INSERT INTO tide_schedules (tide_date, tide_time, tide_height, tide_type)
            VALUES (?, ?, ?, ?)
          `, [tideData.tide_date, tideData.tide_time, tideData.tide_height, tideData.tide_type], 
            function(err) {
              if (err) return reject(err);
              resolve({ id: this.lastID, ...tideData });
            }
          );
        }
      }
    );
  });
}

module.exports = {
  importVesselSchedule,
  importBerths,
  importTideSchedule,
  upsertVessel,
  upsertBerth
};
