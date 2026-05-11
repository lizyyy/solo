const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const SOURCE_PRIORITY = {
  form: 1,
  live: 2,
  customer_service: 3,
  community: 4
};

function determineSource(filename) {
  const name = filename.toLowerCase();
  if (name.includes('form') || name.includes('表单')) return 'form';
  if (name.includes('live') || name.includes('直播')) return 'live';
  if (name.includes('customer') || name.includes('service') || name.includes('客服')) return 'customer_service';
  if (name.includes('community') || name.includes('社群')) return 'community';
  return 'other';
}

function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/[^0-9]/g, '');
}

function normalizeWechat(wechat) {
  if (!wechat) return '';
  return String(wechat).trim().toLowerCase();
}

function loadLeadsFromFile(filePath) {
  return new Promise((resolve, reject) => {
    const leads = [];
    const source = determineSource(path.basename(filePath));
    const sourceName = {
      form: '表单',
      live: '直播',
      customer_service: '客服',
      community: '社群',
      other: '其他'
    }[source];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const phone = normalizePhone(row.phone || row.手机号 || row.电话号码 || '');
        const wechat = normalizeWechat(row.wechat || row.wechat_id || row.微信号 || row.wx || '');
        const nickname = (row.nickname || row.昵称 || row.name || row.姓名 || '').trim();
        const sales = (row.sales || row.销售 || row.负责人 || row.assigned_to || '').trim();
        const followDate = row.follow_date || row.跟进日期 || row.更新时间 || row.date || '';
        const sourcePriority = SOURCE_PRIORITY[source] || 99;

        leads.push({
          id: `${source}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          originalSource: source,
          originalSourceName: sourceName,
          sourcePriority,
          phone,
          wechat,
          nickname,
          sales,
          followDate: followDate ? new Date(followDate) : null,
          originalData: row,
          fileSource: path.basename(filePath)
        });
      })
      .on('end', () => resolve(leads))
      .on('error', reject);
  });
}

async function loadLeadsFromFiles(filePaths) {
  const allLeads = [];
  for (const filePath of filePaths) {
    const leads = await loadLeadsFromFile(filePath);
    allLeads.push(...leads);
  }
  return allLeads;
}

async function loadBlacklist(filePath) {
  return new Promise((resolve, reject) => {
    const blacklist = {
      phones: new Set(),
      wechats: new Set(),
      nicknames: new Set()
    };

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const phone = normalizePhone(row.phone || row.手机号 || '');
        const wechat = normalizeWechat(row.wechat || row.微信号 || '');
        const nickname = (row.nickname || row.昵称 || '').trim();

        if (phone) blacklist.phones.add(phone);
        if (wechat) blacklist.wechats.add(wechat);
        if (nickname) blacklist.nicknames.add(nickname);
      })
      .on('end', () => resolve(blacklist))
      .on('error', reject);
  });
}

module.exports = {
  loadLeadsFromFiles,
  loadBlacklist,
  normalizePhone,
  normalizeWechat,
  SOURCE_PRIORITY
};
