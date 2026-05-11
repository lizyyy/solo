const { equipmentService, classService, reservationService, dataRunService } = require('./services');
const async = require('async');

const sampleEquipment = [
  { name: '显微镜', category: '生物', type: '普通', is_consumable: false, quantity: 20, unit: '台', location: '生物实验室1', description: '光学显微镜，400倍放大' },
  { name: '酒精灯', category: '化学', type: '危险', is_consumable: false, quantity: 30, unit: '个', location: '化学实验室2', description: '玻璃酒精灯，含灯芯' },
  { name: '托盘天平', category: '物理', type: '普通', is_consumable: false, quantity: 25, unit: '台', location: '物理实验室1', description: '称量范围0-200g' },
  { name: 'pH试纸', category: '化学', type: '普通', is_consumable: true, quantity: 500, unit: '条', location: '化学耗材柜', description: '广泛pH试纸1-14' },
  { name: '浓硫酸', category: '化学', type: '危险', is_consumable: true, quantity: 20, unit: '瓶', location: '危险化学品柜', description: '98%浓硫酸，500ml/瓶' },
  { name: '载玻片', category: '生物', type: '普通', is_consumable: true, quantity: 1000, unit: '片', location: '生物耗材柜', description: '标准载玻片，76x26mm' },
  { name: '试管', category: '化学', type: '普通', is_consumable: false, quantity: 200, unit: '支', location: '化学实验室1', description: '标准玻璃试管' },
  { name: '烧杯', category: '化学', type: '普通', is_consumable: false, quantity: 100, unit: '个', location: '化学实验室1', description: '500ml玻璃烧杯' }
];

const sampleClasses = [
  { name: '高一(1)班', grade: '高一' },
  { name: '高一(2)班', grade: '高一' },
  { name: '高二(1)班', grade: '高二' },
  { name: '高二(2)班', grade: '高二' },
  { name: '高三(1)班', grade: '高三' }
];

function loadSampleData(callback) {
  const runName = 'sample_data_initial_load';
  
  dataRunService.hasRun(runName, (hasErr, hasRun) => {
    if (hasErr) return callback(hasErr);
    
    if (hasRun) {
      console.log('示例数据已加载，跳过重复执行');
      return callback(null);
    }

    async.series([
      (cb) => {
        async.eachSeries(sampleEquipment, (eq, eqCb) => {
          equipmentService.create(eq, eqCb);
        }, cb);
      },
      (cb) => {
        async.eachSeries(sampleClasses, (cls, clsCb) => {
          classService.create(cls, clsCb);
        }, cb);
      },
      (cb) => {
        dataRunService.recordRun(runName, cb);
      }
    ], callback);
  });
}

function loadSampleReservations(callback) {
  const runName = 'sample_reservations_load';
  
  dataRunService.hasRun(runName, (hasErr, hasRun) => {
    if (hasErr) return callback(hasErr);
    
    if (hasRun) {
      console.log('示例预约已加载，跳过重复执行');
      return callback(null);
    }

    async.waterfall([
      (cb) => equipmentService.getAll(cb),
      (equipmentList, cb) => {
        classService.getAll((clsErr, classes) => {
          if (clsErr) return cb(clsErr);
          cb(null, equipmentList, classes);
        });
      },
      (equipmentList, classes, cb) => {
        const equipmentMap = {};
        equipmentList.forEach(eq => equipmentMap[eq.name] = eq.id);
        
        const classMap = {};
        classes.forEach(cls => classMap[cls.name] = cls.id);

        const sampleReservations = [
          {
            class_id: classMap['高一(1)班'],
            equipment_id: equipmentMap['显微镜'],
            quantity: 10,
            reservation_date: '2024-03-15',
            purpose: '观察洋葱表皮细胞'
          },
          {
            class_id: classMap['高一(2)班'],
            equipment_id: equipmentMap['酒精灯'],
            quantity: 5,
            reservation_date: '2024-03-16',
            purpose: '加热实验'
          },
          {
            class_id: classMap['高二(1)班'],
            equipment_id: equipmentMap['pH试纸'],
            quantity: 20,
            reservation_date: '2024-03-17',
            purpose: '测定溶液pH值'
          },
          {
            class_id: classMap['高二(2)班'],
            equipment_id: equipmentMap['浓硫酸'],
            quantity: 2,
            reservation_date: '2024-03-18',
            purpose: '配制稀硫酸溶液'
          },
          {
            class_id: classMap['高三(1)班'],
            equipment_id: equipmentMap['托盘天平'],
            quantity: 15,
            reservation_date: '2024-03-19',
            purpose: '质量测量实验'
          }
        ];

        async.eachSeries(sampleReservations, (res, resCb) => {
          reservationService.create(res, resCb);
        }, (resErr) => {
          if (resErr) return cb(resErr);
          dataRunService.recordRun(runName, cb);
        });
      }
    ], callback);
  });
}

module.exports = {
  loadSampleData,
  loadSampleReservations
};
