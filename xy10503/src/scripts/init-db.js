const { store, saveData, resetData } = require('../services/store');

console.log('初始化数据存储...');

resetData();
saveData();

console.log('数据存储初始化完成!');
console.log('数据文件位置: data/warehouse-data.json');
