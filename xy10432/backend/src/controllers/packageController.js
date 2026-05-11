const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const packageController = {
  getAllPackages: (req, res) => {
    const sql = 'SELECT * FROM packages ORDER BY name';
    db.all(sql, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  },

  getPackageById: (req, res) => {
    const { id } = req.params;
    const packageSql = 'SELECT * FROM packages WHERE id = ?';
    const itemsSql = `
      SELECT i.*, d.name AS department_name
      FROM package_items pi
      LEFT JOIN items i ON pi.item_id = i.id
      LEFT JOIN departments d ON i.department_id = d.id
      WHERE pi.package_id = ?
    `;
    
    db.get(packageSql, [id], (err, pkg) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!pkg) {
        return res.status(404).json({ error: 'Package not found' });
      }
      
      db.all(itemsSql, [id], (err, items) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ ...pkg, items });
      });
    });
  },

  createPackage: (req, res) => {
    const { name, description, base_price, type, item_ids } = req.body;
    const id = uuidv4();
    
    const insertPackageSql = 'INSERT INTO packages (id, name, description, base_price, type) VALUES (?, ?, ?, ?, ?)';
    
    db.run(insertPackageSql, [id, name, description, base_price, type], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (item_ids && item_ids.length > 0) {
        const insertItemSql = 'INSERT INTO package_items (id, package_id, item_id) VALUES (?, ?, ?)';
        const statements = item_ids.map(item_id => {
          const itemId = uuidv4();
          return new Promise((resolve, reject) => {
            db.run(insertItemSql, [itemId, id, item_id], function(err) {
              if (err) reject(err);
              else resolve();
            });
          });
        });
        
        Promise.all(statements)
          .then(() => res.status(201).json({ id, name, description, base_price, type, item_ids }))
          .catch(err => res.status(500).json({ error: err.message }));
      } else {
        res.status(201).json({ id, name, description, base_price, type });
      }
    });
  },

  updatePackage: (req, res) => {
    const { id } = req.params;
    const { name, description, base_price, type, item_ids } = req.body;
    
    const updatePackageSql = 'UPDATE packages SET name = ?, description = ?, base_price = ?, type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    
    db.run(updatePackageSql, [name, description, base_price, type, id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Package not found' });
      }
      
      if (item_ids) {
        const deleteItemsSql = 'DELETE FROM package_items WHERE package_id = ?';
        db.run(deleteItemsSql, [id], function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          if (item_ids.length > 0) {
            const insertItemSql = 'INSERT INTO package_items (id, package_id, item_id) VALUES (?, ?, ?)';
            const statements = item_ids.map(item_id => {
              const itemId = uuidv4();
              return new Promise((resolve, reject) => {
                db.run(insertItemSql, [itemId, id, item_id], function(err) {
                  if (err) reject(err);
                  else resolve();
                });
              });
            });
            
            Promise.all(statements)
              .then(() => res.json({ id, name, description, base_price, type, item_ids }))
              .catch(err => res.status(500).json({ error: err.message }));
          } else {
            res.json({ id, name, description, base_price, type });
          }
        });
      } else {
        res.json({ id, name, description, base_price, type });
      }
    });
  },

  getPackagesByType: (req, res) => {
    const { type } = req.params;
    const sql = 'SELECT * FROM packages WHERE type = ? ORDER BY name';
    db.all(sql, [type], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  }
};

module.exports = packageController;
