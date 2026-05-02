const express = require('express');
const router = express.Router();
const topologyService = require('../services/topology-service');

/**
 * 线路拓扑管理 API
 */

// ==================== 线路管理 ====================

/**
 * 获取所有线路
 */
router.get('/lines', (req, res) => {
  try {
    const lines = topologyService.getAllLines();
    res.json({
      success: true,
      data: lines,
      count: lines.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单条线路
 */
router.get('/lines/:id', (req, res) => {
  try {
    const line = topologyService.getLineById(req.params.id);
    if (!line) {
      return res.status(404).json({
        success: false,
        error: '线路不存在'
      });
    }
    res.json({
      success: true,
      data: line
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建线路
 */
router.post('/lines', (req, res) => {
  try {
    const { name, color, description } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: '线路名称不能为空'
      });
    }
    
    const line = topologyService.createLine({
      name,
      color,
      description
    });
    
    res.status(201).json({
      success: true,
      data: line,
      message: '线路创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新线路
 */
router.put('/lines/:id', (req, res) => {
  try {
    const line = topologyService.updateLine(req.params.id, req.body);
    res.json({
      success: true,
      data: line,
      message: '线路更新成功'
    });
  } catch (error) {
    if (error.message.includes('不存在')) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

/**
 * 删除线路
 */
router.delete('/lines/:id', (req, res) => {
  try {
    topologyService.deleteLine(req.params.id);
    res.json({
      success: true,
      message: '线路删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 车站管理 ====================

/**
 * 获取线路的所有车站
 */
router.get('/lines/:lineId/stations', (req, res) => {
  try {
    const stations = topologyService.getStationsByLine(req.params.lineId);
    res.json({
      success: true,
      data: stations,
      count: stations.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单个车站
 */
router.get('/stations/:id', (req, res) => {
  try {
    const station = topologyService.getStationById(req.params.id);
    if (!station) {
      return res.status(404).json({
        success: false,
        error: '车站不存在'
      });
    }
    res.json({
      success: true,
      data: station
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建车站
 */
router.post('/stations', (req, res) => {
  try {
    const { line_id, name, sequence } = req.body;
    
    if (!line_id || !name || sequence === undefined) {
      return res.status(400).json({
        success: false,
        error: '缺少必要字段: line_id, name, sequence'
      });
    }
    
    const station = topologyService.createStation(req.body);
    
    res.status(201).json({
      success: true,
      data: station,
      message: '车站创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新车站
 */
router.put('/stations/:id', (req, res) => {
  try {
    const station = topologyService.updateStation(req.params.id, req.body);
    res.json({
      success: true,
      data: station,
      message: '车站更新成功'
    });
  } catch (error) {
    if (error.message.includes('不存在')) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

/**
 * 删除车站
 */
router.delete('/stations/:id', (req, res) => {
  try {
    topologyService.deleteStation(req.params.id);
    res.json({
      success: true,
      message: '车站删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 区间管理 ====================

/**
 * 获取线路的所有区间
 */
router.get('/lines/:lineId/sections', (req, res) => {
  try {
    const sections = topologyService.getSectionsByLine(req.params.lineId);
    res.json({
      success: true,
      data: sections,
      count: sections.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单个区间
 */
router.get('/sections/:id', (req, res) => {
  try {
    const section = topologyService.getSectionById(req.params.id);
    if (!section) {
      return res.status(404).json({
        success: false,
        error: '区间不存在'
      });
    }
    res.json({
      success: true,
      data: section
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建区间
 */
router.post('/sections', (req, res) => {
  try {
    const { line_id, start_station_id, end_station_id, name } = req.body;
    
    if (!line_id || !start_station_id || !end_station_id || !name) {
      return res.status(400).json({
        success: false,
        error: '缺少必要字段: line_id, start_station_id, end_station_id, name'
      });
    }
    
    const section = topologyService.createSection(req.body);
    
    res.status(201).json({
      success: true,
      data: section,
      message: '区间创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新区间
 */
router.put('/sections/:id', (req, res) => {
  try {
    const section = topologyService.updateSection(req.params.id, req.body);
    res.json({
      success: true,
      data: section,
      message: '区间更新成功'
    });
  } catch (error) {
    if (error.message.includes('不存在')) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

/**
 * 删除区间
 */
router.delete('/sections/:id', (req, res) => {
  try {
    topologyService.deleteSection(req.params.id);
    res.json({
      success: true,
      message: '区间删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 拓扑检查 ====================

/**
 * 检查区间连通性
 */
router.post('/check-connectivity', (req, res) => {
  try {
    const { section_ids } = req.body;
    
    if (!section_ids || !Array.isArray(section_ids)) {
      return res.status(400).json({
        success: false,
        error: '请提供区间 ID 数组: section_ids'
      });
    }
    
    const result = topologyService.checkSectionConnectivity(section_ids);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取区间之间的路径
 */
router.get('/path/:fromSectionId/to/:toSectionId', (req, res) => {
  try {
    const path = topologyService.getSectionPath(
      req.params.fromSectionId,
      req.params.toSectionId
    );
    
    if (!path) {
      return res.status(404).json({
        success: false,
        error: '两个区间之间没有连通路径'
      });
    }
    
    res.json({
      success: true,
      data: {
        path: path,
        section_count: path.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 批量创建拓扑（线路 + 车站 + 区间）
 */
router.post('/batch', (req, res) => {
  try {
    const result = topologyService.createTopologyBatch(req.body);
    
    res.status(201).json({
      success: true,
      data: result,
      message: '拓扑批量创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
