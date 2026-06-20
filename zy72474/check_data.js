const store = require('./src/data/store');
const p = store.listPoints().find(p => p.name.includes('文化路'));
const card = p.busCardPeriods[0];
console.log('点位名:', p.name);
console.log('照片数:', p.photos.length);
console.log('公交刷卡数:', p.busCardPeriods.length);
if (card) {
  console.log('rawText存在:', !!card.rawText);
  console.log('rawText长度:', card.rawText.length);
  console.log('rawText开头:', card.rawText.substring(0, 30));
}
console.log('最新版本操作人:', p.versionHistory[p.versionHistory.length - 1].modifiedBy);
console.log('最新版本原因:', p.versionHistory[p.versionHistory.length - 1].reason);
