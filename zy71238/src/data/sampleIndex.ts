import type { IndexComponent } from '../types';

export const sampleIndexComponents: IndexComponent[] = [
  { code: '600519', name: '贵州茅台', weight: 15.5, price: 1800.00, isSuspended: false },
  { code: '601318', name: '中国平安', weight: 8.2, price: 45.50, isSuspended: false },
  { code: '000858', name: '五粮液', weight: 6.8, price: 168.00, isSuspended: false },
  { code: '600036', name: '招商银行', weight: 6.5, price: 32.80, isSuspended: false },
  { code: '601899', name: '紫金矿业', weight: 5.2, price: 15.20, isSuspended: false },
  { code: '002594', name: '比亚迪', weight: 4.8, price: 256.00, isSuspended: false },
  { code: '601012', name: '隆基绿能', weight: 4.2, price: 28.50, isSuspended: false },
  { code: '300750', name: '宁德时代', weight: 4.0, price: 198.00, isSuspended: false },
  { code: '600900', name: '长江电力', weight: 3.8, price: 28.20, isSuspended: false },
  { code: '601398', name: '工商银行', weight: 3.5, price: 5.20, isSuspended: false },
  { code: '600276', name: '恒瑞医药', weight: 3.2, price: 42.80, isSuspended: false },
  { code: '002415', name: '海康威视', weight: 3.0, price: 32.50, isSuspended: false },
  { code: '601888', name: '中国中免', weight: 2.8, price: 85.60, isSuspended: false },
  { code: '000333', name: '美的集团', weight: 2.5, price: 58.20, isSuspended: false },
  { code: '600030', name: '中信证券', weight: 2.2, price: 19.80, isSuspended: false },
  { code: '002714', name: '牧原股份', weight: 2.0, price: 45.50, isSuspended: false },
  { code: '601166', name: '兴业银行', weight: 1.8, price: 18.50, isSuspended: false },
  { code: '000651', name: '格力电器', weight: 1.5, price: 38.20, isSuspended: false },
  { code: '600585', name: '海螺水泥', weight: 1.2, price: 42.50, isSuspended: false },
  { code: '601668', name: '中国建筑', weight: 1.0, price: 5.80, isSuspended: false },
];

export const sampleCsvContent = `code,name,weight,price,isSuspended
600519,贵州茅台,15.5,1800.00,false
601318,中国平安,8.2,45.50,false
000858,五粮液,6.8,168.00,false
600036,招商银行,6.5,32.80,false
601899,紫金矿业,5.2,15.20,false
002594,比亚迪,4.8,256.00,false
601012,隆基绿能,4.2,28.50,false
300750,宁德时代,4.0,198.00,false
600900,长江电力,3.8,28.20,false
601398,工商银行,3.5,5.20,false`;
