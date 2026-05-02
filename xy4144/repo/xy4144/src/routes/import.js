const express = require('express');
const router = express.Router();
const importService = require('../services/import-service');

/**
 * 导入 API
 * 支持 CSV 和 JSON 格式的施工申请导入
 */

/**
 * 获取导入模板说明
 */
router.get('/template', (req, res) => {
  try {
    const template = importService.getCSVTemplate();
    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 从 CSV 导入计划
 */
router.post('/csv', async (req, res) => {
  try {
    let csvContent;
    
    // 支持两种方式：
    // 1. Content-Type: text/csv 或 text/plain，body 直接是 CSV 内容
    // 2. Content-Type: application/json，body 包含 csv_content 字段
    
    if (typeof req.body === 'string') {
      csvContent = req.body;
    } else if (req.body.csv_content) {
      csvContent = req.body.csv_content;
    } else if (req.body.content) {
      csvContent = req.body.content;
    } else {
      return res.status(400).json({
        success: false,
        error: '请提供 CSV 内容（text/csv 格式或 json 中的 csv_content 字段）'
      });
    }
    
    const result = await importService.importFromCSV(csvContent);
    
    res.json({
      success: true,
      data: result,
      message: `导入完成: 成功 ${result.success} 条，失败 ${result.failed} 条`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 从 JSON 导入计划
 */
router.post('/json', (req, res) => {
  try {
    let jsonData;
    
    if (Array.isArray(req.body)) {
      jsonData = req.body;
    } else if (req.body.plans && Array.isArray(req.body.plans)) {
      jsonData = req.body.plans;
    } else if (req.body.data) {
      jsonData = req.body.data;
    } else {
      // 单个计划对象
      jsonData = [req.body];
    }
    
    if (!Array.isArray(jsonData)) {
      return res.status(400).json({
        success: false,
        error: '请提供计划数组或单个计划对象'
      });
    }
    
    const result = importService.importFromJSON(JSON.stringify(jsonData));
    
    res.json({
      success: true,
      data: result,
      message: `导入完成: 成功 ${result.success} 条，失败 ${result.failed} 条`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 验证导入数据（仅验证不保存）
 */
router.post('/validate', (req, res) => {
  try {
    let data;
    
    if (Array.isArray(req.body)) {
      data = req.body;
    } else if (req.body.plans && Array.isArray(req.body.plans)) {
      data = req.body.plans;
    } else if (req.body.data) {
      data = req.body.data;
    } else {
      data = [req.body];
    }
    
    const result = importService.validateImportData(data);
    
    res.json({
      success: true,
      data: result,
      message: `验证完成: 有效 ${result.valid} 条，无效 ${result.invalid} 条`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 从 CSV 导入拓扑数据
 */
router.post('/topology/csv', async (req, res) => {
  try {
    let csvContent;
    
    if (typeof req.body === 'string') {
      csvContent = req.body;
    } else if (req.body.csv_content) {
      csvContent = req.body.csv_content;
    } else if (req.body.content) {
      csvContent = req.body.content;
    } else {
      return res.status(400).json({
        success: false,
        error: '请提供 CSV 内容'
      });
    }
    
    const result = await importService.importTopologyFromCSV(csvContent);
    
    res.json({
      success: true,
      data: result,
      summary: {
        lines: result.lines.length,
        stations: result.stations.length,
        sections: result.sections.length,
        errors: result.errors.length
      },
      message: `拓扑导入完成: 线路 ${result.lines.length} 条，车站 ${result.stations.length} 个，区间 ${result.sections.length} 个`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 批量导入示例数据
 */
router.post('/sample', (req, res) => {
  try {
    const sampleData = {
      topology: {
        line: {
          name: '1号线',
          color: '#FF0000',
          description: '东西主干线'
        },
        stations: [
          { name: '起点站', sequence: 0, is_terminal: true },
          { name: '中转站A', sequence: 1 },
          { name: '中转站B', sequence: 2 },
          { name: '终点站', sequence: 3, is_terminal: true }
        ],
        sections: [
          { name: '起点-中转A区间', start_station_id: 'ST-001', end_station_id: 'ST-002', length_km: 2.5 },
          { name: '中转A-中转B区间', start_station_id: 'ST-002', end_station_id: 'ST-003', length_km: 3.2 },
          { name: '中转B-终点区间', start_station_id: 'ST-003', end_station_id: 'ST-004', length_km: 2.8 }
        ]
      },
      resources: {
        teams: [
          { name: '轨道维修一队', leader_name: '张队长', team_size: 15, specialization: '轨道检修' },
          { name: '接触网维护队', leader_name: '李队长', team_size: 10, specialization: '接触网' },
          { name: '信号调试组', leader_name: '王组长', team_size: 8, specialization: '信号系统' }
        ],
        catenary_zones: [
          { name: '1号线供电分区A', start_section_id: 'SEC-001', end_section_id: 'SEC-002', power_supply: '变电所A' },
          { name: '1号线供电分区B', start_section_id: 'SEC-002', end_section_id: 'SEC-003', power_supply: '变电所B' }
        ],
        dispatch_commands: [
          { code: 'CMD-001', name: '区间封锁命令', command_type: 'blockade', description: '封锁指定区间进行施工' },
          { code: 'CMD-002', name: '接触网停电命令', command_type: 'power', description: '接触网停电作业' },
          { code: 'CMD-003', name: '行车调整命令', command_type: 'traffic', description: '调整行车计划' }
        ]
      },
      plans: [
        {
          line_id: 'LINE-001',
          work_type: '轨道检修',
          work_content: '更换磨耗超标钢轨段',
          construction_team_id: 'TEAM-001',
          priority: 1,
          is_emergency: false,
          start_time: '2024-05-20 23:30:00',
          end_time: '2024-05-21 04:30:00',
          first_train_time: '2024-05-21 05:30:00',
          power_off_required: false,
          section_ids: ['SEC-001', 'SEC-002'],
          applicant_name: '张三'
        },
        {
          line_id: 'LINE-001',
          work_type: '接触网维护',
          work_content: '接触网绝缘子清扫和检查',
          construction_team_id: 'TEAM-002',
          priority: 2,
          is_emergency: false,
          start_time: '2024-05-20 23:45:00',
          end_time: '2024-05-21 04:00:00',
          first_train_time: '2024-05-21 05:30:00',
          power_off_required: true,
          catenary_zone_ids: ['CAT-001', 'CAT-002'],
          section_ids: ['SEC-002', 'SEC-003'],
          applicant_name: '李四'
        }
      ]
    };
    
    res.json({
      success: true,
      data: sampleData,
      message: '示例数据格式已返回，请根据此格式准备数据后使用 /api/import/json 或 /api/import/csv 导入'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
