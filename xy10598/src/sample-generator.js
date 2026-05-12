const fs = require('fs-extra');
const path = require('path');

function generateSampleData(workDir) {
  const samplesDir = path.join(workDir, 'samples');
  fs.ensureDirSync(samplesDir);

  generateStores(samplesDir);
  generateStaff(samplesDir);
  generateProducts(samplesDir);
  generatePromotions(samplesDir);
  generateSales(samplesDir);
  generateReturns(samplesDir);
  generateAllocations(samplesDir);
  generateTransfers(samplesDir);

  return {
    samplesDir,
    files: [
      'stores.csv',
      'staff.csv', 
      'products.csv',
      'promotions.csv',
      'sales.csv',
      'returns.csv',
      'allocations.csv',
      'transfers.csv'
    ],
    message: '样例数据已生成，覆盖服饰、鞋包、配件三类商品'
  };
}

function generateStores(dir) {
  const csv = `store_code,store_name
ST001,上海南京东路店
ST002,上海陆家嘴店
ST003,杭州湖滨店
ST004,北京三里屯店`;
  fs.writeFileSync(path.join(dir, 'stores.csv'), csv, 'utf-8');
}

function generateStaff(dir) {
  const csv = `staff_code,staff_name,store_code,role,status
S001,张美丽,ST001,店长,active
S002,李小红,ST001,导购,active
S003,王芳芳,ST001,导购,active
S004,陈小明,ST002,导购,active
S005,刘华,ST002,导购,active
S006,赵雪,ST003,店长,active
S007,孙梅,ST003,导购,active
S008,周杰,ST004,导购,active
S009,吴敏,ST004,导购,active`;
  fs.writeFileSync(path.join(dir, 'staff.csv'), csv, 'utf-8');
}

function generateProducts(dir) {
  const csv = `sku,product_name,category,base_commission_rate
CL001,春季新款连衣裙,服饰,0.03
CL002,商务西装套装,服饰,0.03
CL003,休闲牛仔裤,服饰,0.02
CL004,针织开衫外套,服饰,0.025
CL005,时尚T恤,服饰,0.02
SH001,真皮商务皮鞋,鞋包,0.04
SH002,运动休闲鞋,鞋包,0.03
SH003,时尚女靴,鞋包,0.035
SH004,单肩手提包,鞋包,0.03
SH005,双肩背包,鞋包,0.025
AC001,真皮皮带,配件,0.02
AC002,时尚围巾,配件,0.015
AC003,精致耳环,配件,0.02
AC004,高端手表,配件,0.05
AC005,太阳眼镜,配件,0.025`;
  fs.writeFileSync(path.join(dir, 'products.csv'), csv, 'utf-8');
}

function generatePromotions(dir) {
  const csv = `promotion_code,promotion_name,start_date,end_date,discount_type,discount_value,commission_multiplier,applies_to_category,applies_to_sku,is_active
PROMO001,春季新品促销,2026-03-01,2026-03-31,percentage,10,0.8,服饰,,1
PROMO002,鞋包满减活动,2026-03-15,2026-03-31,fixed,200,0.7,鞋包,,1
PROMO003,会员专享折扣,2026-03-01,2026-03-31,percentage,15,0.9,,,1
PROMO004,配件套餐,2026-03-20,2026-04-10,fixed,100,0.85,配件,,1`;
  fs.writeFileSync(path.join(dir, 'promotions.csv'), csv, 'utf-8');
}

function generateSales(dir) {
  const csv = `order_no,order_date,store_code,customer_phone,total_amount,discount_amount,net_amount,payment_method,status,promotion_code,source_store_code
SO001,2026-03-05,ST001,13800138001,2698,200,2498,支付宝,completed,PROMO001,ST001
SO002,2026-03-08,ST001,13800138002,1599,100,1499,微信,completed,,ST001
SO003,2026-03-10,ST002,13800138003,3299,300,2999,银行卡,completed,PROMO002,ST002
SO004,2026-03-12,ST001,13800138004,899,0,899,现金,completed,,ST001
SO005,2026-03-15,ST003,13800138005,5899,500,5399,支付宝,completed,PROMO003,ST001
SO006,2026-03-18,ST002,13800138006,1299,0,1299,微信,completed,,ST002
SO007,2026-03-20,ST001,13800138007,4599,400,4199,银行卡,completed,PROMO001,ST001
SO008,2026-03-22,ST004,13800138008,2199,150,2049,支付宝,completed,PROMO004,ST004
SO009,2026-03-25,ST003,13800138009,1899,0,1899,微信,completed,,ST003
SO010,2026-03-28,ST001,13800138010,3699,350,3349,银行卡,completed,PROMO003,ST001
SO011,2026-03-30,ST002,13800138011,999,0,999,现金,completed,,ST002
SO012,2026-03-31,ST001,13800138012,2799,200,2599,支付宝,completed,PROMO001,ST003`;
  fs.writeFileSync(path.join(dir, 'sales.csv'), csv, 'utf-8');
}

function generateReturns(dir) {
  const csv = `return_no,original_order_no,return_date,store_code,total_amount,reason,status
RO001,SO004,2026-03-14,ST001,899,尺码不合适,completed
RO002,SO002,2026-04-02,ST001,1499,款式不满意,completed
RO003,SO006,2026-03-20,ST002,1299,质量问题,completed`;
  fs.writeFileSync(path.join(dir, 'returns.csv'), csv, 'utf-8');
}

function generateAllocations(dir) {
  const csv = `order_no,staff_code,allocation_ratio,allocation_type,notes
SO001,S002,0.6,normal,主导购
SO001,S003,0.4,normal,协助接待
SO002,S002,1.0,normal,单独接待
SO003,S004,0.5,normal,联合销售
SO003,S005,0.5,normal,联合销售
SO004,S003,1.0,normal,单独接待
SO005,S007,0.7,normal,主导购
SO005,S006,0.3,normal,店长配合
SO006,S005,1.0,normal,单独接待
SO007,S002,1.0,normal,VIP客户
SO008,S008,0.5,normal,联合销售
SO008,S009,0.5,normal,联合销售
SO009,S007,1.0,normal,老客户
SO010,S002,0.6,normal,主导购
SO010,S001,0.4,normal,店长协助
SO011,S004,1.0,normal,单独接待
SO012,S002,1.0,normal,跨店调拨销售`;
  fs.writeFileSync(path.join(dir, 'allocations.csv'), csv, 'utf-8');
}

function generateTransfers(dir) {
  const csv = `transfer_no,transfer_date,from_store_code,to_store_code,sku,quantity,sale_order_no,status
TF001,2026-03-29,ST003,ST001,CL002,1,SO012,completed
TF002,2026-03-10,ST001,ST002,SH001,2,,completed
TF003,2026-03-25,ST004,ST003,AC004,1,SO009,completed`;
  fs.writeFileSync(path.join(dir, 'transfers.csv'), csv, 'utf-8');
}

module.exports = {
  generateSampleData
};
