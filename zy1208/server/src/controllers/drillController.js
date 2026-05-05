const Drill = require('../models/Drill');
const ImportFile = require('../models/ImportFile');
const fs = require('fs');
const path = require('path');

class DrillController {
  static async createDrill(req, res) {
    try {
      const { name, description } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: '演练名称不能为空' });
      }
      
      const drill = Drill.create(name, description);
      
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const fileType = DrillController._detectFileType(file.originalname);
          ImportFile.create(
            drill.id,
            fileType,
            file.originalname,
            file.path,
            file.size
          );
        }
      }
      
      res.status(201).json({
        ...drill,
        files: ImportFile.findByDrillId(drill.id)
      });
    } catch (error) {
      console.error('创建演练失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static _detectFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    
    if (ext === '.sql') {
      return 'schema';
    }
    if (ext === '.log' || filename.includes('slow')) {
      return 'slow-log';
    }
    if (filename.includes('profile') || filename.includes('db-profile')) {
      return 'db-profile';
    }
    if (filename.includes('write') || filename.includes('sample') || ext === '.csv') {
      return 'write-sample';
    }
    if (ext === '.json') {
      return 'json-data';
    }
    
    return 'unknown';
  }

  static listDrills(req, res) {
    try {
      const drills = Drill.findAll();
      const result = drills.map(drill => ({
        ...drill,
        files: ImportFile.findByDrillId(drill.id)
      }));
      res.json(result);
    } catch (error) {
      console.error('获取演练列表失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static getDrill(req, res) {
    try {
      const { id } = req.params;
      const drill = Drill.findById(id);
      
      if (!drill) {
        return res.status(404).json({ error: '演练不存在' });
      }
      
      res.json({
        ...drill,
        files: ImportFile.findByDrillId(id)
      });
    } catch (error) {
      console.error('获取演练详情失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static updateDrill(req, res) {
    try {
      const { id } = req.params;
      const { name, description, status } = req.body;
      
      const drill = Drill.findById(id);
      if (!drill) {
        return res.status(404).json({ error: '演练不存在' });
      }
      
      const updated = Drill.update(id, { name, description, status });
      
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const fileType = DrillController._detectFileType(file.originalname);
          ImportFile.create(
            id,
            fileType,
            file.originalname,
            file.path,
            file.size
          );
        }
      }
      
      res.json({
        ...updated,
        files: ImportFile.findByDrillId(id)
      });
    } catch (error) {
      console.error('更新演练失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static deleteDrill(req, res) {
    try {
      const { id } = req.params;
      
      const files = ImportFile.findByDrillId(id);
      for (const file of files) {
        if (fs.existsSync(file.file_path)) {
          fs.unlinkSync(file.file_path);
        }
      }
      
      const deleted = Drill.delete(id);
      
      if (!deleted) {
        return res.status(404).json({ error: '演练不存在' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('删除演练失败:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = DrillController;
