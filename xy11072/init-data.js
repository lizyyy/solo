const db = require('./database');

const initData = () => {
  const getCurrentTime = () => {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  };

  const stockData = [
    {
      stock_type: 'VEHICLE',
      location_code: 'VH001',
      location_name: '社区诊疗车1号',
      medicine_code: 'MED001',
      medicine_name: '阿莫西林胶囊',
      batch_no: 'B202401001',
      quantity: 100,
      unit: '盒'
    },
    {
      stock_type: 'VEHICLE',
      location_code: 'VH001',
      location_name: '社区诊疗车1号',
      medicine_code: 'MED002',
      medicine_name: '布洛芬缓释片',
      batch_no: 'B202402001',
      quantity: 50,
      unit: '盒'
    },
    {
      stock_type: 'VEHICLE',
      location_code: 'VH002',
      location_name: '社区诊疗车2号',
      medicine_code: 'MED001',
      medicine_name: '阿莫西林胶囊',
      batch_no: 'B202401001',
      quantity: 80,
      unit: '盒'
    },
    {
      stock_type: 'SITE',
      location_code: 'ST001',
      location_name: '幸福社区卫生服务站',
      medicine_code: 'MED001',
      medicine_name: '阿莫西林胶囊',
      batch_no: 'B202401001',
      quantity: 200,
      unit: '盒'
    },
    {
      stock_type: 'SITE',
      location_code: 'ST001',
      location_name: '幸福社区卫生服务站',
      medicine_code: 'MED002',
      medicine_name: '布洛芬缓释片',
      batch_no: 'B202402001',
      quantity: 150,
      unit: '盒'
    },
    {
      stock_type: 'SITE',
      location_code: 'ST002',
      location_name: '阳光社区卫生服务站',
      medicine_code: 'MED001',
      medicine_name: '阿莫西林胶囊',
      batch_no: 'B202401001',
      quantity: 180,
      unit: '盒'
    }
  ];

  const insertStock = db.prepare(`
    INSERT OR REPLACE INTO medicine_stock (
      stock_type, location_code, location_name, medicine_code, 
      medicine_name, batch_no, quantity, unit, last_update_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const stock of stockData) {
    insertStock.run(
      stock.stock_type, stock.location_code, stock.location_name,
      stock.medicine_code, stock.medicine_name, stock.batch_no,
      stock.quantity, stock.unit, getCurrentTime()
    );
  }

  console.log('样例库存数据初始化完成！');
};

initData();
