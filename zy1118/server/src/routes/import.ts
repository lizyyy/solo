import { Router, Request, Response } from 'express';
import multer from 'multer';
import { importService } from '../services/importService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/hall', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const content = req.file.buffer.toString('utf-8');
    const hall = await importService.parseHallJson(content);

    res.json({
      success: true,
      data: hall
    });
  } catch (error) {
    console.error('Error parsing hall.json:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to parse hall.json file'
    });
  }
});

router.post('/booths', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const content = req.file.buffer.toString('utf-8');
    const booths = await importService.parseBoothsCsv(content);

    res.json({
      success: true,
      data: booths
    });
  } catch (error) {
    console.error('Error parsing booths.csv:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to parse booths.csv file'
    });
  }
});

router.post('/flow', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const content = req.file.buffer.toString('utf-8');
    const flowZones = await importService.parseFlowCsv(content);

    res.json({
      success: true,
      data: flowZones
    });
  } catch (error) {
    console.error('Error parsing flow.csv:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to parse flow.csv file'
    });
  }
});

router.post('/power-zones', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const content = req.file.buffer.toString('utf-8');
    const powerZones = await importService.parsePowerZonesJson(content);

    res.json({
      success: true,
      data: powerZones
    });
  } catch (error) {
    console.error('Error parsing power-zones.json:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to parse power-zones.json file'
    });
  }
});

export default router;
