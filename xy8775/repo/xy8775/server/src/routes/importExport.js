const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const { runQuery, getOne, getAll, generateId } = require('../utils/dbHelper');

const upload = multer({ 
  dest: path.join(__dirname, '../../uploads'),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

router.post('/import/volunteers', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const results = [];
    const errors = [];
    let rowCount = 0;
    
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => {
        rowCount++;
        results.push(data);
      })
      .on('end', async () => {
        try {
          const imported = [];
          
          for (const row of results) {
            try {
              const name = row.name || row.姓名 || row.Name || '';
              if (!name) {
                errors.push(`行 ${rowCount}: 缺少姓名`);
                continue;
              }
              
              const phone = row.phone || row.电话 || row.Phone || '';
              const email = row.email || row.邮箱 || row.Email || '';
              const maxDailyShifts = parseInt(row.max_daily_shifts || row.每天最多班次 || row.MaxDailyShifts || '1', 10) || 1;
              const notes = row.notes || row.备注 || row.Notes || '';
              
              const skillsStr = row.skills || row.技能 || row.Skills || '';
              const skills = skillsStr ? skillsStr.split(/[,，;；]/).map(s => s.trim()).filter(s => s) : [];
              
              const availableDatesStr = row.available_dates || row.可用日期 || row.AvailableDates || '';
              const availableDateStrings = availableDatesStr ? 
                availableDatesStr.split(/[,，;；]/).map(s => s.trim()).filter(s => s) : [];
              
              const existingVolunteer = await getOne(`
                SELECT * FROM volunteers WHERE name = ?
              `, [name]);
              
              let volunteerId;
              
              if (existingVolunteer) {
                volunteerId = existingVolunteer.id;
                await runQuery(`
                  UPDATE volunteers 
                  SET phone = ?, email = ?, max_daily_shifts = ?, notes = ?, updated_at = ?
                  WHERE id = ?
                `, [phone, email, maxDailyShifts, notes, new Date().toISOString(), volunteerId]);
              } else {
                volunteerId = generateId();
                const now = new Date().toISOString();
                await runQuery(`
                  INSERT INTO volunteers (id, name, phone, email, max_daily_shifts, notes, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [volunteerId, name, phone, email, maxDailyShifts, notes, now, now]);
              }
              
              if (skills.length > 0) {
                for (const skillName of skills) {
                  let skill = await getOne('SELECT * FROM skills WHERE name = ?', [skillName]);
                  
                  if (!skill) {
                    const skillId = generateId();
                    await runQuery(`
                      INSERT INTO skills (id, name, created_at)
                      VALUES (?, ?, ?)
                    `, [skillId, skillName, new Date().toISOString()]);
                    skill = { id: skillId, name: skillName };
                  }
                  
                  try {
                    await runQuery(`
                      INSERT INTO volunteer_skills (volunteer_id, skill_id)
                      VALUES (?, ?)
                    `, [volunteerId, skill.id]);
                  } catch (e) {
                  }
                }
              }
              
              if (availableDateStrings.length > 0) {
                for (const dateStr of availableDateStrings) {
                  let eventDate = await getOne('SELECT * FROM event_dates WHERE date = ?', [dateStr]);
                  
                  if (!eventDate) {
                    const dateId = generateId();
                    const now = new Date().toISOString();
                    await runQuery(`
                      INSERT INTO event_dates (id, date, description, created_at, updated_at)
                      VALUES (?, ?, ?, ?, ?)
                    `, [dateId, dateStr, '', now, now]);
                    eventDate = { id: dateId, date: dateStr };
                  }
                  
                  try {
                    await runQuery(`
                      INSERT INTO volunteer_available_dates (volunteer_id, date_id)
                      VALUES (?, ?)
                    `, [volunteerId, eventDate.id]);
                  } catch (e) {
                  }
                }
              }
              
              imported.push({
                id: volunteerId,
                name,
                phone,
                email,
                max_daily_shifts: maxDailyShifts,
                skills,
                available_dates: availableDateStrings
              });
            } catch (err) {
              errors.push(`行 ${rowCount}: ${err.message}`);
            }
          }
          
          try {
            fs.unlinkSync(req.file.path);
          } catch (e) {}
          
          res.json({
            message: `成功导入 ${imported.length} 名志愿者`,
            imported_count: imported.length,
            error_count: errors.length,
            errors,
            volunteers: imported
          });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      })
      .on('error', (err) => {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {}
        res.status(500).json({ error: err.message });
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/schedules', async (req, res) => {
  try {
    const schedules = await getAll(`
      SELECT 
        ed.date as 日期,
        p.name as 岗位,
        v.name as 志愿者姓名,
        v.phone as 联系电话,
        v.email as 邮箱,
        s.is_draft as 是否草稿
      FROM schedules s
      JOIN event_dates ed ON s.date_id = ed.id
      JOIN positions p ON s.position_id = p.id
      JOIN volunteers v ON s.volunteer_id = v.id
      ORDER BY ed.date, p.name
    `);
    
    if (schedules.length === 0) {
      return res.json({ message: '没有排班数据可导出' });
    }
    
    const fields = ['日期', '岗位', '志愿者姓名', '联系电话', '邮箱', '是否草稿'];
    const opts = { fields };
    
    try {
      const parser = new Parser(opts);
      const csv = parser.parse(schedules);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=排班表_${new Date().toISOString().split('T')[0]}.csv`);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Pragma', 'no-cache');
      
      res.write('\ufeff' + csv);
      res.end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/volunteers', async (req, res) => {
  try {
    const volunteers = await getAll(`
      SELECT v.*
      FROM volunteers v
      ORDER BY v.name
    `);
    
    for (let volunteer of volunteers) {
      const skills = await getAll(`
        SELECT s.name
        FROM skills s
        JOIN volunteer_skills vs ON s.id = vs.skill_id
        WHERE vs.volunteer_id = ?
      `, [volunteer.id]);
      volunteer.skills = skills.map(s => s.name).join(', ');
      
      const availableDates = await getAll(`
        SELECT ed.date
        FROM event_dates ed
        JOIN volunteer_available_dates vad ON ed.id = vad.date_id
        WHERE vad.volunteer_id = ?
        ORDER BY ed.date
      `, [volunteer.id]);
      volunteer.available_dates = availableDates.map(d => d.date).join(', ');
    }
    
    const data = volunteers.map(v => ({
      姓名: v.name,
      电话: v.phone || '',
      邮箱: v.email || '',
      每天最多班次: v.max_daily_shifts,
      技能: v.skills,
      可用日期: v.available_dates,
      备注: v.notes || ''
    }));
    
    if (data.length === 0) {
      return res.json({ message: '没有志愿者数据可导出' });
    }
    
    const fields = ['姓名', '电话', '邮箱', '每天最多班次', '技能', '可用日期', '备注'];
    const opts = { fields };
    
    try {
      const parser = new Parser(opts);
      const csv = parser.parse(data);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=志愿者名单_${new Date().toISOString().split('T')[0]}.csv`);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Pragma', 'no-cache');
      
      res.write('\ufeff' + csv);
      res.end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
