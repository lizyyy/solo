import { Router, Request, Response } from 'express';
import multer from 'multer';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { db } from '../database.js';
import { ObservingSite, Device, ObservingTarget, TargetWindow, LightPollutionData } from '../types.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/sites/csv', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const sites: ObservingSite[] = [];
    const stream = Readable.from(req.file.buffer.toString());

    stream
      .pipe(csvParser())
      .on('data', (row: Record<string, string>) => {
        const id = `site_${crypto.randomUUID()}`;
        sites.push({
          id,
          name: row.name || row.site || row.location || '',
          latitude: parseFloat(row.latitude || row.lat || '0'),
          longitude: parseFloat(row.longitude || row.lon || row.lng || '0'),
          elevation: parseFloat(row.elevation || row.alt || '0'),
        });
      })
      .on('end', () => {
        const insertStmt = db.prepare(`
          INSERT INTO observing_sites (id, name, latitude, longitude, elevation)
          VALUES (?, ?, ?, ?, ?)
        `);

        const transaction = db.transaction((items: ObservingSite[]) => {
          for (const item of items) {
            insertStmt.run(item.id, item.name, item.latitude, item.longitude, item.elevation);
          }
        });

        transaction(sites);
        res.json({ message: `Imported ${sites.length} observing sites`, sites });
      });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import sites CSV' });
  }
});

router.post('/devices/csv', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const devices: Device[] = [];
    const stream = Readable.from(req.file.buffer.toString());

    stream
      .pipe(csvParser())
      .on('data', (row: Record<string, string>) => {
        const id = `device_${crypto.randomUUID()}`;
        const type = (row.type || row.device_type || 'telescope') as Device['type'];
        devices.push({
          id,
          name: row.name || row.device_name || '',
          type: ['telescope', 'camera', 'mount', 'filter'].includes(type) ? type : 'telescope',
          model: row.model || undefined,
          batteryLevel: parseFloat(row.battery || row.battery_level || '100'),
          isAvailable: row.available !== 'false' && row.is_available !== 'false',
          description: row.description || row.notes || undefined,
        });
      })
      .on('end', () => {
        const insertStmt = db.prepare(`
          INSERT INTO devices (id, name, type, model, battery_level, is_available, description)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const transaction = db.transaction((items: Device[]) => {
          for (const item of items) {
            insertStmt.run(
              item.id,
              item.name,
              item.type,
              item.model || null,
              item.batteryLevel,
              item.isAvailable ? 1 : 0,
              item.description || null
            );
          }
        });

        transaction(devices);
        res.json({ message: `Imported ${devices.length} devices`, devices });
      });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import devices CSV' });
  }
});

router.post('/targets/json', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const data = JSON.parse(req.file.buffer.toString());
    const targets = (data.targets || data.observingTargets || data) as ObservingTarget[];

    const processedTargets: ObservingTarget[] = targets.map((t) => ({
      id: t.id || `target_${crypto.randomUUID()}`,
      name: t.name,
      type: t.type,
      rightAscension: t.rightAscension || t.ra,
      declination: t.declination || t.dec,
      priority: t.priority || 1,
    }));

    const insertStmt = db.prepare(`
      INSERT INTO observing_targets (id, name, type, right_ascension, declination, priority)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((items: ObservingTarget[]) => {
      for (const item of items) {
        insertStmt.run(item.id, item.name, item.type, item.rightAscension, item.declination, item.priority);
      }
    });

    transaction(processedTargets);
    res.json({ message: `Imported ${processedTargets.length} observing targets`, targets: processedTargets });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import targets JSON' });
  }
});

router.post('/windows/json', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const data = JSON.parse(req.file.buffer.toString());
    const windows = (data.windows || data.targetWindows || data) as TargetWindow[];

    const processedWindows: TargetWindow[] = windows.map((w) => ({
      id: w.id || `window_${crypto.randomUUID()}`,
      targetId: w.targetId,
      startTime: w.startTime || w.start,
      endTime: w.endTime || w.end,
      duration: w.duration || 60,
      deviceIds: w.deviceIds || [],
      notes: w.notes,
    }));

    const insertStmt = db.prepare(`
      INSERT INTO target_windows (id, target_id, start_time, end_time, duration, device_ids, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((items: TargetWindow[]) => {
      for (const item of items) {
        insertStmt.run(
          item.id,
          item.targetId,
          item.startTime,
          item.endTime,
          item.duration,
          JSON.stringify(item.deviceIds),
          item.notes || null
        );
      }
    });

    transaction(processedWindows);
    res.json({ message: `Imported ${processedWindows.length} target windows`, windows: processedWindows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import windows JSON' });
  }
});

router.post('/light-pollution/json', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const data = JSON.parse(req.file.buffer.toString());
    const lightPollutionData = (data.lightPollution || data) as LightPollutionData[];

    const insertStmt = db.prepare(`
      INSERT INTO light_pollution_data (site_id, date, bortle_scale, limiting_magnitude, artificial_sky_brightness, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((items: LightPollutionData[]) => {
      for (const item of items) {
        insertStmt.run(
          item.siteId,
          item.date,
          item.bortleScale,
          item.limitingMagnitude,
          item.artificialSkyBrightness,
          item.description || null
        );
      }
    });

    transaction(lightPollutionData);
    res.json({ message: `Imported ${lightPollutionData.length} light pollution records`, data: lightPollutionData });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import light pollution JSON' });
  }
});

router.get('/sites', (req: Request, res: Response) => {
  try {
    const sites = db
      .prepare('SELECT * FROM observing_sites')
      .all() as ObservingSite[];
    res.json(sites);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

router.get('/targets', (req: Request, res: Response) => {
  try {
    const targets = db
      .prepare('SELECT * FROM observing_targets ORDER BY priority DESC')
      .all() as ObservingTarget[];
    res.json(targets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch targets' });
  }
});

router.get('/windows', (req: Request, res: Response) => {
  try {
    const windowsRaw = db
      .prepare('SELECT * FROM target_windows ORDER BY start_time')
      .all() as any[];

    const windows: TargetWindow[] = windowsRaw.map((w) => ({
      id: w.id,
      targetId: w.target_id,
      startTime: w.start_time,
      endTime: w.end_time,
      duration: w.duration,
      deviceIds: JSON.parse(w.device_ids || '[]'),
      notes: w.notes,
    }));

    res.json(windows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch windows' });
  }
});

export default router;
