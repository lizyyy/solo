import { db } from './database';
import * as dayjs from 'dayjs';

export const seedSampleData = () => {
  return new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM alerts');
      db.run('DELETE FROM adjustment_history');
      db.run('DELETE FROM orders');
      db.run('DELETE FROM stock_records');
      db.run('DELETE FROM sales_history');
      db.run('DELETE FROM weather_tags');
      db.run('DELETE FROM holidays');
      db.run('DELETE FROM products');

      const products = [
        { name: '上海青', category: '叶菜', unit: '斤', avg_demand: 30, safety_stock: 10, min_order: 20, lead_days: 1 },
        { name: '生菜', category: '叶菜', unit: '斤', avg_demand: 25, safety_stock: 8, min_order: 15, lead_days: 1 },
        { name: '油麦菜', category: '叶菜', unit: '斤', avg_demand: 20, safety_stock: 6, min_order: 10, lead_days: 1 },
        { name: '苹果', category: '水果', unit: '斤', avg_demand: 45, safety_stock: 15, min_order: 30, lead_days: 2 },
        { name: '香蕉', category: '水果', unit: '斤', avg_demand: 35, safety_stock: 12, min_order: 20, lead_days: 1 },
        { name: '橙子', category: '水果', unit: '斤', avg_demand: 28, safety_stock: 10, min_order: 15, lead_days: 2 },
        { name: '猪肉（精瘦）', category: '肉类', unit: '斤', avg_demand: 50, safety_stock: 15, min_order: 25, lead_days: 1 },
        { name: '猪肉（五花）', category: '肉类', unit: '斤', avg_demand: 40, safety_stock: 12, min_order: 20, lead_days: 1 },
        { name: '鸡肉', category: '肉类', unit: '斤', avg_demand: 30, safety_stock: 10, min_order: 15, lead_days: 1 },
      ];

      const insertProduct = db.prepare('INSERT INTO products (name, category, unit, avg_demand, safety_stock, min_order, lead_days) VALUES (?, ?, ?, ?, ?, ?, ?)');
      
      products.forEach((p, index) => {
        insertProduct.run(p.name, p.category, p.unit, p.avg_demand, p.safety_stock, p.min_order, p.lead_days, (err) => {
          if (err) console.error('Insert product error:', err);
        });
      });
      insertProduct.finalize();

      const today = dayjs('2026-05-11');
      const weatherTags = ['晴', '多云', '阴', '小雨', '大雨', '暴雨'];
      
      const insertWeather = db.prepare('INSERT OR REPLACE INTO weather_tags (date, tag) VALUES (?, ?)');
      for (let i = 30; i >= 0; i--) {
        const date = today.subtract(i, 'day').format('YYYY-MM-DD');
        const weather = weatherTags[Math.floor(Math.random() * weatherTags.length)];
        insertWeather.run(date, weather);
      }
      insertWeather.finalize();

      const holidays = [
        { date: '2026-05-01', name: '劳动节' },
        { date: '2026-05-04', name: '青年节' },
        { date: '2026-06-01', name: '儿童节' },
      ];
      const insertHoliday = db.prepare('INSERT OR REPLACE INTO holidays (date, name) VALUES (?, ?)');
      holidays.forEach(h => insertHoliday.run(h.date, h.name));
      insertHoliday.finalize();

      const insertSales = db.prepare('INSERT INTO sales_history (product_id, date, quantity, weather_tag, is_holiday) VALUES (?, ?, ?, ?, ?)');
      const insertStock = db.prepare('INSERT INTO stock_records (product_id, date, closing_stock, wastage) VALUES (?, ?, ?, ?)');

      db.all('SELECT id, name, category, avg_demand FROM products', (err, rows: any[]) => {
        if (err) {
          console.error('Select products error:', err);
          reject(err);
          return;
        }

        rows.forEach((product: any) => {
          for (let i = 30; i >= 1; i--) {
            const date = today.subtract(i, 'day').format('YYYY-MM-DD');
            
            db.get('SELECT tag FROM weather_tags WHERE date = ?', [date], (err, weather: any) => {
              if (err) return;
              
              db.get('SELECT date FROM holidays WHERE date = ?', [date], (err, holiday: any) => {
                if (err) return;
                
                const isHoliday = holiday ? 1 : 0;
                const weatherTag = weather?.tag || '晴';
                
                let demandMultiplier = 1;
                if (weatherTag.includes('雨')) demandMultiplier *= 0.7;
                if (isHoliday) demandMultiplier *= 1.5;
                
                const category = product.category;
                if (category === '叶菜') {
                  if (weatherTag.includes('雨')) demandMultiplier *= 0.6;
                } else if (category === '肉类') {
                  if (isHoliday) demandMultiplier *= 1.8;
                }
                
                const quantity = Math.round(product.avg_demand * demandMultiplier * (0.8 + Math.random() * 0.4));
                const wastage = Math.round(quantity * 0.05 * (0.5 + Math.random()));
                const closingStock = Math.round(quantity * 0.2 * Math.random());
                
                insertSales.run(product.id, date, quantity, weatherTag, isHoliday);
                insertStock.run(product.id, date, closingStock, wastage);
              });
            });
          }
        });

        db.all('SELECT id, name, category, avg_demand, safety_stock FROM products', (err, products: any[]) => {
          if (err) return;
          
          const insertOrder = db.prepare(`INSERT INTO orders 
            (product_id, order_date, delivery_date, suggested_qty, adjusted_qty, adjustment_reason, actual_qty, wastage_qty, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

          const yesterday = today.subtract(1, 'day').format('YYYY-MM-DD');
          const dayBeforeYesterday = today.subtract(2, 'day').format('YYYY-MM-DD');
          
          products.forEach(product => {
            const suggested = Math.round(product.avg_demand + product.safety_stock);
            const adjusted = product.category === '水果' ? Math.round(suggested * 1.3) : suggested;
            const actual = product.name.includes('苹果') ? Math.round(adjusted * 0.7) : adjusted;
            const wastage = product.name.includes('生菜') ? Math.round(actual * 0.25) : Math.round(actual * 0.05);

            insertOrder.run(
              product.id,
              dayBeforeYesterday,
              yesterday,
              suggested,
              adjusted,
              product.category === '水果' ? '明日周末，预计销量上涨' : null,
              actual,
              wastage,
              'completed'
            );

            if (product.name.includes('生菜')) {
              db.run(`INSERT INTO alerts (type, product_id, message, resolved) 
                VALUES ('high_wastage', ?, ?, 0)`, 
                [product.id, `生菜损耗率达25%，远超正常水平，请复盘原因`]
              );
            }

            if (product.name.includes('苹果')) {
              db.run(`INSERT INTO alerts (type, product_id, message, resolved) 
                VALUES ('shortage', ?, ?, 0)`, 
                [product.id, `苹果实际到货量仅为采购量的70%，存在缺货风险`]
              );
            }
          });

          insertOrder.finalize();
          resolve();
        });
      });
    });
  });
};
