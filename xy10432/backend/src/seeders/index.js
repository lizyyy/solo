const db = require('../config/database');
const { initDatabase } = require('../models/database');
const { departments, items, packages, packageItems, customers, staff } = require('./data');
const { v4: uuidv4 } = require('uuid');

const seedDatabase = async () => {
  try {
    await initDatabase();

    db.serialize(() => {
      const run = (sql, params = []) => {
        return new Promise((resolve, reject) => {
          db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
          });
        });
      };

      const get = (sql, params = []) => {
        return new Promise((resolve, reject) => {
          db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      };

      (async () => {
        try {
          console.log('Seeding departments...');
          for (const dept of departments) {
            const exists = await get('SELECT id FROM departments WHERE id = ?', [dept.id]);
            if (!exists) {
              await run(
                'INSERT INTO departments (id, name, description, daily_capacity, current_usage) VALUES (?, ?, ?, ?, ?)',
                [dept.id, dept.name, dept.description, dept.daily_capacity, dept.current_usage]
              );
            }
          }

          console.log('Seeding items...');
          for (const item of items) {
            const exists = await get('SELECT id FROM items WHERE id = ?', [item.id]);
            if (!exists) {
              await run(
                'INSERT INTO items (id, name, description, price, department_id, is_addable) VALUES (?, ?, ?, ?, ?, ?)',
                [item.id, item.name, item.description, item.price, item.department_id, item.is_addable]
              );
            }
          }

          console.log('Seeding packages...');
          for (const pkg of packages) {
            const exists = await get('SELECT id FROM packages WHERE id = ?', [pkg.id]);
            if (!exists) {
              await run(
                'INSERT INTO packages (id, name, description, base_price, type) VALUES (?, ?, ?, ?, ?)',
                [pkg.id, pkg.name, pkg.description, pkg.base_price, pkg.type]
              );
            }
          }

          console.log('Seeding package items...');
          for (const pkgItem of packageItems) {
            for (const itemId of pkgItem.item_ids) {
              const id = uuidv4();
              const exists = await get(
                'SELECT id FROM package_items WHERE package_id = ? AND item_id = ?',
                [pkgItem.package_id, itemId]
              );
              if (!exists) {
                await run(
                  'INSERT INTO package_items (id, package_id, item_id) VALUES (?, ?, ?)',
                  [id, pkgItem.package_id, itemId]
                );
              }
            }
          }

          console.log('Seeding customers...');
          for (const customer of customers) {
            const exists = await get('SELECT id FROM customers WHERE id = ?', [customer.id]);
            if (!exists) {
              await run(
                'INSERT INTO customers (id, name, phone, id_card, type, company_name) VALUES (?, ?, ?, ?, ?, ?)',
                [customer.id, customer.name, customer.phone, customer.id_card, customer.type, customer.company_name]
              );
            }
          }

          console.log('Seeding staff...');
          for (const s of staff) {
            const exists = await get('SELECT id FROM staff WHERE id = ?', [s.id]);
            if (!exists) {
              await run(
                'INSERT INTO staff (id, name, role) VALUES (?, ?, ?)',
                [s.id, s.name, s.role]
              );
            }
          }

          console.log('Database seeded successfully!');
          process.exit(0);
        } catch (error) {
          console.error('Error seeding database:', error);
          process.exit(1);
        }
      })();
    });
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
};

seedDatabase();
