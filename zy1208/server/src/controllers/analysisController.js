const AnalysisResult = require('../models/AnalysisResult');
const ImportFile = require('../models/ImportFile');
const Drill = require('../models/Drill');
const AnalysisEngine = require('../engines/analysisEngine');
const fs = require('fs');

class AnalysisController {
  static async runAnalysis(req, res) {
    try {
      const { id } = req.params;
      
      const drill = Drill.findById(id);
      if (!drill) {
        return res.status(404).json({ error: '演练不存在' });
      }
      
      const files = ImportFile.findByDrillId(id);
      if (files.length === 0) {
        return res.status(400).json({ error: '请先导入数据文件' });
      }
      
      const analysisData = {
        drillId: id,
        files: [],
        schema: null,
        slowLogs: [],
        dbProfile: null,
        writeSamples: []
      };
      
      for (const file of files) {
        const fileContent = fs.readFileSync(file.file_path, 'utf8');
        analysisData.files.push({
          ...file,
          content: fileContent
        });
        
        switch (file.file_type) {
          case 'schema':
            analysisData.schema = fileContent;
            break;
          case 'slow-log':
            analysisData.slowLogs.push({
              content: fileContent,
              fileName: file.file_name
            });
            break;
          case 'db-profile':
            try {
              analysisData.dbProfile = JSON.parse(fileContent);
            } catch (e) {
              console.warn('解析 db-profile 失败:', e);
            }
            break;
          case 'write-sample':
            try {
              analysisData.writeSamples.push(JSON.parse(fileContent));
            } catch (e) {
              analysisData.writeSamples.push({
                raw: fileContent,
                fileName: file.file_name
              });
            }
            break;
        }
      }
      
      const result = AnalysisEngine.analyze(analysisData);
      
      let analysisResult = AnalysisResult.findByDrillId(id);
      if (analysisResult) {
        analysisResult = AnalysisResult.update(id, result);
      } else {
        analysisResult = AnalysisResult.create(id, result);
      }
      
      Drill.update(id, { status: 'analyzed' });
      
      res.json({
        success: true,
        result: analysisResult
      });
    } catch (error) {
      console.error('运行分析失败:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static getAnalysis(req, res) {
    try {
      const { id } = req.params;
      
      const analysis = AnalysisResult.findByDrillId(id);
      if (!analysis) {
        return res.status(404).json({ error: '分析结果不存在，请先运行分析' });
      }
      
      res.json(analysis);
    } catch (error) {
      console.error('获取分析结果失败:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = AnalysisController;
