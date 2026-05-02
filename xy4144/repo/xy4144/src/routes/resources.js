const express = require('express');
const router = express.Router();
const resourceService = require('../services/resource-service');

/**
 * 资源管理 API
 * 施工队、接触网分区、行车调度命令管理
 */

// ==================== 施工队管理 ====================

/**
 * 获取所有施工队
 */
router.get('/teams', (req, res) => {
  try {
    const activeOnly = req.query.active !== 'false';
    const teams = resourceService.getAllTeams(activeOnly);
    res.json({
      success: true,
      data: teams,
      count: teams.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单个施工队
 */
router.get('/teams/:id', (req, res) => {
  try {
    const team = resourceService.getTeamById(req.params.id);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: '施工队不存在'
      });
    }
    res.json({
      success: true,
      data: team
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建施工队
 */
router.post('/teams', (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: '施工队名称不能为空'
      });
    }
    
    const team = resourceService.createTeam(req.body);
    
    res.status(201).json({
      success: true,
      data: team,
      message: '施工队创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新施工队
 */
router.put('/teams/:id', (req, res) => {
  try {
    const team = resourceService.updateTeam(req.params.id, req.body);
    res.json({
      success: true,
      data: team,
      message: '施工队更新成功'
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
 * 删除施工队
 */
router.delete('/teams/:id', (req, res) => {
  try {
    resourceService.deleteTeam(req.params.id);
    res.json({
      success: true,
      message: '施工队删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 接触网分区管理 ====================

/**
 * 获取所有接触网分区
 */
router.get('/catenary-zones', (req, res) => {
  try {
    const { line_id } = req.query;
    const zones = resourceService.getAllCatenaryZones(line_id);
    res.json({
      success: true,
      data: zones,
      count: zones.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单个接触网分区
 */
router.get('/catenary-zones/:id', (req, res) => {
  try {
    const zone = resourceService.getCatenaryZoneById(req.params.id);
    if (!zone) {
      return res.status(404).json({
        success: false,
        error: '接触网分区不存在'
      });
    }
    res.json({
      success: true,
      data: zone
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建接触网分区
 */
router.post('/catenary-zones', (req, res) => {
  try {
    const { line_id, name, start_section_id, end_section_id } = req.body;
    
    if (!line_id || !name || !start_section_id || !end_section_id) {
      return res.status(400).json({
        success: false,
        error: '缺少必要字段: line_id, name, start_section_id, end_section_id'
      });
    }
    
    const zone = resourceService.createCatenaryZone(req.body);
    
    res.status(201).json({
      success: true,
      data: zone,
      message: '接触网分区创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新接触网分区
 */
router.put('/catenary-zones/:id', (req, res) => {
  try {
    const zone = resourceService.updateCatenaryZone(req.params.id, req.body);
    res.json({
      success: true,
      data: zone,
      message: '接触网分区更新成功'
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
 * 删除接触网分区
 */
router.delete('/catenary-zones/:id', (req, res) => {
  try {
    resourceService.deleteCatenaryZone(req.params.id);
    res.json({
      success: true,
      message: '接触网分区删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 行车调度命令管理 ====================

/**
 * 获取所有行车调度命令
 */
router.get('/dispatch-commands', (req, res) => {
  try {
    const activeOnly = req.query.active !== 'false';
    const commands = resourceService.getAllDispatchCommands(activeOnly);
    res.json({
      success: true,
      data: commands,
      count: commands.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单个行车调度命令
 */
router.get('/dispatch-commands/:id', (req, res) => {
  try {
    const command = resourceService.getDispatchCommandById(req.params.id);
    if (!command) {
      return res.status(404).json({
        success: false,
        error: '调度命令不存在'
      });
    }
    res.json({
      success: true,
      data: command
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建行车调度命令
 */
router.post('/dispatch-commands', (req, res) => {
  try {
    const { code, name } = req.body;
    
    if (!code || !name) {
      return res.status(400).json({
        success: false,
        error: '缺少必要字段: code, name'
      });
    }
    
    const command = resourceService.createDispatchCommand(req.body);
    
    res.status(201).json({
      success: true,
      data: command,
      message: '调度命令创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新行车调度命令
 */
router.put('/dispatch-commands/:id', (req, res) => {
  try {
    const command = resourceService.updateDispatchCommand(req.params.id, req.body);
    res.json({
      success: true,
      data: command,
      message: '调度命令更新成功'
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
 * 删除行车调度命令
 */
router.delete('/dispatch-commands/:id', (req, res) => {
  try {
    resourceService.deleteDispatchCommand(req.params.id);
    res.json({
      success: true,
      message: '调度命令删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 资源占用查询 ====================

/**
 * 查询资源占用情况
 */
router.get('/occupations', (req, res) => {
  try {
    const { resource_type, resource_id, start_time, end_time } = req.query;
    
    if (!resource_type || !resource_id || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        error: '缺少必要查询参数: resource_type, resource_id, start_time, end_time'
      });
    }
    
    const occupations = resourceService.getResourceOccupations(
      resource_type,
      resource_id,
      start_time,
      end_time
    );
    
    res.json({
      success: true,
      data: occupations,
      count: occupations.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 批量创建资源
 */
router.post('/batch', (req, res) => {
  try {
    const result = resourceService.createResourcesBatch(req.body);
    
    res.status(201).json({
      success: true,
      data: result,
      message: '资源批量创建成功',
      summary: {
        teams: result.teams.length,
        catenary_zones: result.catenary_zones.length,
        dispatch_commands: result.dispatch_commands.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
