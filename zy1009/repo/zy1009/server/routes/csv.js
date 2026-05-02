const express = require('express');
const router = express.Router();
const db = require('../db/index');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');
const csv = require('csv-parser');
const multer = require('multer');
const upload = multer({ dest: '/tmp/' });
const fs = require('fs');

router.get('/orders', (req, res) => {
  const { status, pickup_time } = req.query;
  
  let query = `
    SELECT 
      o.id as order_id,
      o.user_name,
      o.user_phone,
      o.pickup_time,
      o.total_amount,
      o.status,
      o.notes,
      oi.product_name,
      oi.price,
      oi.quantity,
      oi.subtotal,
      oi.replacement_status,
      oi.replacement_product_name,
      oi.replacement_price,
      oi.price_difference
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    query += ' AND o.status = ?';
    params.push(status);
  }
  
  if (pickup_time) {
    query += ' AND o.pickup_time = ?';
    params.push(pickup_time);
  }
  
  query += ' ORDER BY o.pickup_time, o.user_name';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const fields = [
      { label: '订单ID', value: 'order_id' },
      { label: '用户名', value: 'user_name' },
      { label: '联系电话', value: 'user_phone' },
      { label: '取货时间', value: 'pickup_time' },
      { label: '商品名称', value: 'product_name' },
      { label: '单价', value: 'price' },
      { label: '数量', value: 'quantity' },
      { label: '小计', value: 'subtotal' },
      { label: '替换状态', value: 'replacement_status' },
      { label: '替换商品', value: 'replacement_product_name' },
      { label: '替换价格', value: 'replacement_price' },
      { label: '差价', value: 'price_difference' },
      { label: '订单状态', value: 'status' },
      { label: '订单备注', value: 'notes' }
    ];
    
    try {
      const json2csvParser = new Parser({ fields });
      const csvData = json2csvParser.parse(rows);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
      res.send('\uFEFF' + csvData);
    } catch (csvErr) {
      return res.status(500).json({ error: 'CSV生成失败' });
    }
  });
});

router.get('/shipping-list', (req, res) => {
  const { pickup_time } = req.query;
  
  let query = `
    SELECT 
      o.pickup_time,
      o.user_name,
      o.user_phone,
      CASE 
        WHEN oi.replacement_status = 'confirmed' AND oi.replacement_product_name IS NOT NULL 
        THEN oi.replacement_product_name 
        ELSE oi.product_name 
      END as final_product_name,
      oi.quantity,
      CASE 
        WHEN oi.replacement_status = 'confirmed' AND oi.replacement_price IS NOT NULL 
        THEN oi.replacement_price 
        ELSE oi.price 
      END as final_price,
      CASE 
        WHEN oi.replacement_status = 'confirmed' AND oi.replacement_price IS NOT NULL 
        THEN oi.replacement_price * oi.quantity 
        ELSE oi.subtotal 
      END as final_subtotal,
      oi.replacement_status,
      o.notes as order_notes
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE 1=1
  `;
  const params = [];
  
  if (pickup_time) {
    query += ' AND o.pickup_time = ?';
    params.push(pickup_time);
  }
  
  query += ' ORDER BY o.pickup_time, o.user_name';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const fields = [
      { label: '取货时间', value: 'pickup_time' },
      { label: '用户名', value: 'user_name' },
      { label: '联系电话', value: 'user_phone' },
      { label: '商品名称', value: 'final_product_name' },
      { label: '数量', value: 'quantity' },
      { label: '单价', value: 'final_price' },
      { label: '小计', value: 'final_subtotal' },
      { label: '替换状态', value: 'replacement_status' },
      { label: '备注', value: 'order_notes' }
    ];
    
    try {
      const json2csvParser = new Parser({ fields });
      const csvData = json2csvParser.parse(rows);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=shipping-list.csv');
      res.send('\uFEFF' + csvData);
    } catch (csvErr) {
      return res.status(500).json({ error: 'CSV生成失败' });
    }
  });
});

router.get('/products', (req, res) => {
  db.all('SELECT * FROM products ORDER BY category, name', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const fields = [
      { label: '商品ID', value: 'id' },
      { label: '商品名称', value: 'name' },
      { label: '价格', value: 'price' },
      { label: '单位', value: 'unit' },
      { label: '分类', value: 'category' },
      { label: '库存数量', value: 'stock_quantity' },
      { label: '是否可用', value: (row) => row.is_available ? '是' : '否' },
      { label: '描述', value: 'description' }
    ];
    
    try {
      const json2csvParser = new Parser({ fields });
      const csvData = json2csvParser.parse(rows);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=products.csv');
      res.send('\uFEFF' + csvData);
    } catch (csvErr) {
      return res.status(500).json({ error: 'CSV生成失败' });
    }
  });
});

router.post('/import/orders', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传CSV文件' });
  }

  const results = [];
  const errors = [];
  let rowCount = 0;

  fs.createReadStream(req.file.path)
    .pipe(csv({ encoding: 'utf-8' }))
    .on('data', (data) => {
      rowCount++;
      
      const user_name = data['用户名'] || data['user_name'];
      const user_phone = data['联系电话'] || data['user_phone'] || '';
      const pickup_time = data['取货时间'] || data['pickup_time'];
      const product_name = data['商品名称'] || data['product_name'];
      const price = parseFloat(data['单价'] || data['price'] || 0);
      const quantity = parseInt(data['数量'] || data['quantity'] || 0);
      const notes = data['备注'] || data['notes'] || '';

      if (!user_name || !pickup_time || !product_name || isNaN(price) || isNaN(quantity)) {
        errors.push({ row: rowCount, error: '缺少必填字段或格式错误' });
        return;
      }

      results.push({
        user_name,
        user_phone,
        pickup_time,
        product_name,
        price,
        quantity,
        notes
      });
    })
    .on('end', async () => {
      fs.unlinkSync(req.file.path);

      if (errors.length > 0) {
        return res.status(400).json({ errors, message: `CSV解析完成，但有 ${errors.length} 行数据格式错误` });
      }

      if (results.length === 0) {
        return res.status(400).json({ error: 'CSV文件中没有有效数据' });
      }

      const ordersMap = new Map();
      results.forEach(item => {
        const key = `${item.user_name}_${item.pickup_time}`;
        if (!ordersMap.has(key)) {
          ordersMap.set(key, {
            user_name: item.user_name,
            user_phone: item.user_phone,
            pickup_time: item.pickup_time,
            notes: item.notes,
            items: []
          });
        }
        
        db.all('SELECT * FROM products WHERE name = ? AND is_available = 1', [item.product_name], (err, products) => {
          if (err) {
            console.error('查询商品失败:', err);
            return;
          }
          
          const product = products.length > 0 ? products[0] : null;
          
          ordersMap.get(key).items.push({
            product_id: product ? product.id : `temp_${uuidv4()}`,
            product_name: item.product_name,
            price: item.price,
            quantity: item.quantity
          });
        });
      });

      setTimeout(() => {
        const createdOrders = [];
        
        db.serialize(() => {
          ordersMap.forEach((orderData, key) => {
            if (orderData.items.length === 0) return;

            const orderId = uuidv4();
            let totalAmount = 0;

            orderData.items.forEach(item => {
              totalAmount += item.price * item.quantity;
            });

            db.run(
              'INSERT INTO orders (id, user_name, user_phone, pickup_time, total_amount, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [orderId, orderData.user_name, orderData.user_phone, orderData.pickup_time, totalAmount, 'pending', orderData.notes]
            );

            const itemStmt = db.prepare('INSERT INTO order_items (id, order_id, product_id, product_name, price, quantity, subtotal, replacement_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            orderData.items.forEach(item => {
              itemStmt.run(
                uuidv4(), orderId, item.product_id, item.product_name, item.price, item.quantity,
                item.price * item.quantity, 'none'
              );
            });
            itemStmt.finalize();

            createdOrders.push({
              id: orderId,
              user_name: orderData.user_name,
              pickup_time: orderData.pickup_time,
              items_count: orderData.items.length,
              total_amount: totalAmount
            });
          });

          res.json({
            message: `成功导入 ${createdOrders.length} 个订单，共 ${results.length} 个商品`,
            orders: createdOrders
          });
        });
      }, 100);
    })
    .on('error', (err) => {
      fs.unlinkSync(req.file.path);
      res.status(500).json({ error: 'CSV文件解析失败: ' + err.message });
    });
});

module.exports = router;
