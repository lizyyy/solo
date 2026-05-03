const path = require('path');
const fs = require('fs');
const multer = require('multer');

// 模拟multer的存储配置
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

console.log('=== 测试文件路径处理 ===');

// 测试1: 直接测试csvParser
console.log('\n--- 测试1: 直接测试csvParser ---');
const parsers = require('./src/parsers');

const testFilePath = path.join(__dirname, 'samples', 'equipment_ledger_en.csv');
console.log('测试文件路径:', testFilePath);
console.log('文件存在:', fs.existsSync(testFilePath));

// 测试parseCSV
console.log('\n--- 测试parseCSV ---');
parsers.csv.parseCSV(testFilePath)
  .then(results => {
    console.log('parseCSV结果数量:', results.length);
    if (results.length > 0) {
      console.log('parseCSV第一条数据:', results[0]);
      console.log('parseCSV第一条数据的键:', Object.keys(results[0]));
    }
  })
  .catch(error => {
    console.error('parseCSV错误:', error);
  });

// 测试parseEquipmentCSV
console.log('\n--- 测试parseEquipmentCSV ---');
parsers.csv.parseEquipmentCSV(testFilePath)
  .then(result => {
    console.log('parseEquipmentCSV success:', result.success);
    console.log('parseEquipmentCSV data count:', result.data.length);
    console.log('parseEquipmentCSV errors:', result.errors);
    if (result.data.length > 0) {
      console.log('parseEquipmentCSV第一条数据:', result.data[0]);
    }
  })
  .catch(error => {
    console.error('parseEquipmentCSV错误:', error);
  });

// 测试2: 测试数据校验
console.log('\n--- 测试数据校验 ---');
const validators = require('./src/validators');

const testEquipmentData = [
  {
    equipment_code: 'MFE-001',
    equipment_type: '干粉灭火器',
    model: 'ABC4kg',
    manufacturer: '永安消防器材厂',
    batch_number: 'Y2023-001',
    production_date: '2023-01-15',
    expiration_date: '2028-01-14',
    location: '办公区A栋1楼',
    status: 'normal',
    is_scrapped: 0
  }
];

const validationResult = validators.data.validateEquipmentList(testEquipmentData);
console.log('数据校验结果:');
console.log('  success:', validationResult.success);
console.log('  errors:', validationResult.errors);
console.log('  validData count:', validationResult.validData.length);
