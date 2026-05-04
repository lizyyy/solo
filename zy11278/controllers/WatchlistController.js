const db = require('../models');
const { Op } = require('sequelize');

class WatchlistController {
  async getWatchlist(req, res) {
    try {
      const { category, priority, search, page = 1, pageSize = 100 } = req.query;

      const where = {};
      if (category) where.category = category;
      if (priority !== undefined && priority !== '') where.priority = parseInt(priority);
      if (search) {
        where[Op.or] = [
          { symbol: { [Op.like]: `%${search}%` } },
          { name: { [Op.like]: `%${search}%` } }
        ];
      }

      const { count, rows } = await db.Watchlist.findAndCountAll({
        where,
        order: [['priority', 'DESC'], ['created_at', 'ASC']],
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

  async addToWatchlist(req, res) {
    try {
      const { symbol, name, category, notes, priority, tags } = req.body;

      if (!symbol) {
        return res.status(400).json({
          success: false,
          message: '股票代码不能为空'
        });
      }

      const existing = await db.Watchlist.findOne({
        where: { symbol: symbol.toUpperCase() }
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: '该股票已在自选股中'
        });
      }

      const watchlist = await db.Watchlist.create({
        symbol: symbol.toUpperCase(),
        name,
        category: category || 'watch',
        notes,
        priority: priority || 0,
        tags: tags ? JSON.stringify(tags) : null
      });

      res.json({
        success: true,
        data: watchlist
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async updateWatchlistItem(req, res) {
    try {
      const { id } = req.params;
      const { name, category, notes, priority, tags } = req.body;

      const watchlist = await db.Watchlist.findByPk(id);

      if (!watchlist) {
        return res.status(404).json({
          success: false,
          message: '自选股不存在'
        });
      }

      await watchlist.update({
        name,
        category: category !== undefined ? category : watchlist.category,
        notes: notes !== undefined ? notes : watchlist.notes,
        priority: priority !== undefined ? priority : watchlist.priority,
        tags: tags !== undefined ? JSON.stringify(tags) : watchlist.tags
      });

      res.json({
        success: true,
        data: watchlist
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async removeFromWatchlist(req, res) {
    try {
      const { id } = req.params;

      const watchlist = await db.Watchlist.findByPk(id);

      if (!watchlist) {
        return res.status(404).json({
          success: false,
          message: '自选股不存在'
        });
      }

      await watchlist.destroy();

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

  async bulkImport(req, res) {
    try {
      const { stocks } = req.body;

      if (!stocks || !Array.isArray(stocks) || stocks.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供股票列表'
        });
      }

      const created = [];
      const skipped = [];

      for (const stock of stocks) {
        const { symbol, name } = stock;
        if (!symbol) continue;

        const existing = await db.Watchlist.findOne({
          where: { symbol: symbol.toUpperCase() }
        });

        if (existing) {
          skipped.push(symbol);
          continue;
        }

        const watchlist = await db.Watchlist.create({
          symbol: symbol.toUpperCase(),
          name,
          category: stock.category || 'watch',
          priority: stock.priority || 0
        });

        created.push(watchlist);
      }

      res.json({
        success: true,
        data: {
          created: created.length,
          skipped: skipped.length,
          createdItems: created,
          skippedSymbols: skipped
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new WatchlistController();
