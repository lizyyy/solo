const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const createTestAppointments = () => {
  const today = new Date().toISOString().split('T')[0];
  
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

    const all = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    };

    (async () => {
      try {
        console.log('Creating test appointments...');
        
        const customers = await all('SELECT * FROM customers');
        const packages = await all('SELECT * FROM packages');
        
        const testAppointments = [
          {
            customer_id: customers[0].id,
            package_id: packages[0].id,
            appointment_date: today,
            paid_amount: 500
          },
          {
            customer_id: customers[1].id,
            package_id: packages[1].id,
            appointment_date: today,
            paid_amount: 1200
          },
          {
            customer_id: customers[2].id,
            package_id: packages[2].id,
            appointment_date: today,
            paid_amount: 450
          },
          {
            customer_id: customers[3].id,
            package_id: packages[3].id,
            appointment_date: today,
            paid_amount: 1500
          }
        ];
        
        for (const appt of testAppointments) {
          const pkg = packages.find(p => p.id === appt.package_id);
          const appointmentId = uuidv4();
          
          await run(
            `INSERT INTO appointments (id, customer_id, package_id, appointment_date, status, total_amount, paid_amount)
             VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
            [appointmentId, appt.customer_id, appt.package_id, appt.appointment_date, pkg.base_price, appt.paid_amount]
          );
          
          const packageItems = await all(
            'SELECT pi.item_id, i.price FROM package_items pi LEFT JOIN items i ON pi.item_id = i.id WHERE pi.package_id = ?',
            [appt.package_id]
          );
          
          for (const pkgItem of packageItems) {
            const itemId = uuidv4();
            await run(
              `INSERT INTO appointment_items (id, appointment_id, item_id, item_type, price, status, report_issued)
               VALUES (?, ?, ?, 'package', ?, 'pending', 0)`,
              [itemId, appointmentId, pkgItem.item_id, pkgItem.price]
            );
          }
          
          if (appt.paid_amount > 0) {
            const transactionId = uuidv4();
            await run(
              `INSERT INTO transactions (id, appointment_id, type, amount, description)
               VALUES (?, ?, 'initial_payment', ?, '套餐费用')`,
              [transactionId, appointmentId, appt.paid_amount]
            );
          }
          
          console.log(`Created appointment for customer ${appt.customer_id}`);
        }
        
        console.log('Test appointments created successfully!');
        process.exit(0);
      } catch (error) {
        console.error('Error creating test appointments:', error);
        process.exit(1);
      }
    })();
  });
};

createTestAppointments();
