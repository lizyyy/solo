const db = require('../models');
const { Op } = require('sequelize');

class ReviewNoteController {
  async getNotes(req, res) {
    try {
      const { trading_day_id, note_type, importance, resolved, search, page = 1, pageSize = 50 } = req.query;

      const where = {};
      if (trading_day_id) where.trading_day_id = trading_day_id;
      if (note_type) where.note_type = note_type;
      if (importance) where.importance = importance;
      if (resolved !== undefined && resolved !== '') where.resolved = resolved === 'true';
      if (search) {
        where[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { content: { [Op.like]: `%${search}%` } }
        ];
      }

      const { count, rows } = await db.ReviewNote.findAndCountAll({
        where,
        include: [{
          model: db.TradingDay,
          as: 'tradingDay'
        }],
        order: [['importance', 'DESC'], ['created_at', 'DESC']],
        limit: parseInt(pageSize),
        offset: (parseInt(page) - 1) * parseInt(pageSize)
      });

      res.json({
        success: true,
        data: {
          list: rows,
          total: count,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil(count / parseInt(pageSize))
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getNoteById(req, res) {
    try {
      const { id } = req.params;

      const note = await db.ReviewNote.findByPk(id, {
        include: [{
          model: db.TradingDay,
          as: 'tradingDay'
        }]
      });

      if (!note) {
        return res.status(404).json({
          success: false,
          message: '复盘笔记不存在'
        });
      }

      res.json({
        success: true,
        data: note
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async createNote(req, res) {
    try {
      const { trading_day_id, note_type, title, content, tags, importance, action_items } = req.body;

      if (!title) {
        return res.status(400).json({
          success: false,
          message: '标题不能为空'
        });
      }

      const note = await db.ReviewNote.create({
        trading_day_id,
        note_type: note_type || 'other',
        title,
        content,
        tags: tags ? JSON.stringify(tags) : null,
        importance: importance || 3,
        action_items: action_items ? JSON.stringify(action_items) : null,
        resolved: false
      });

      res.json({
        success: true,
        data: note
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async updateNote(req, res) {
    try {
      const { id } = req.params;
      const { title, content, tags, importance, action_items, resolved } = req.body;

      const note = await db.ReviewNote.findByPk(id);

      if (!note) {
        return res.status(404).json({
          success: false,
          message: '复盘笔记不存在'
        });
      }

      await note.update({
        title,
        content,
        tags: tags !== undefined ? JSON.stringify(tags) : note.tags,
        importance: importance !== undefined ? importance : note.importance,
        action_items: action_items !== undefined ? JSON.stringify(action_items) : note.action_items,
        resolved: resolved !== undefined ? resolved : note.resolved
      });

      res.json({
        success: true,
        data: note
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async deleteNote(req, res) {
    try {
      const { id } = req.params;

      const note = await db.ReviewNote.findByPk(id);

      if (!note) {
        return res.status(404).json({
          success: false,
          message: '复盘笔记不存在'
        });
      }

      await note.destroy();

      res.json({
        success: true,
        message: '删除成功'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new ReviewNoteController();
