const db = require('./database');

const sampleSponsors = [
  { name: '元气森林', category: '饮料', website: 'https://yuanqisenlin.com', contact_person: '张经理', phone: '13800138001', email: 'zhang@yuanqi.com' },
  { name: '农夫山泉', category: '饮料', website: 'https://nongfushanquan.com', contact_person: '李经理', phone: '13800138002', email: 'li@nongfu.com' },
  { name: '小米科技', category: '电子', website: 'https://mi.com', contact_person: '王经理', phone: '13800138003', email: 'wang@mi.com' },
  { name: '华为', category: '电子', website: 'https://huawei.com', contact_person: '赵经理', phone: '13800138004', email: 'zhao@huawei.com' },
  { name: '美团外卖', category: '餐饮', website: 'https://meituan.com', contact_person: '刘经理', phone: '13800138005', email: 'liu@meituan.com' }
];

const sampleEpisodes = [
  { episode_number: 1, title: '科技前沿：AI时代的到来', description: '探讨人工智能的最新发展趋势', publish_date: '2026-01-01', recording_date: '2025-12-28', status: 'published', inventory: 3 },
  { episode_number: 2, title: '创业故事：从零到一的旅程', description: '访谈成功创业者的心路历程', publish_date: '2026-01-08', recording_date: '2026-01-03', status: 'published', inventory: 3 },
  { episode_number: 3, title: '健康生活：现代人的养生之道', description: '分享健康生活方式和养生知识', publish_date: '2026-01-15', recording_date: '2026-01-10', status: 'planned', inventory: 3 },
  { episode_number: 4, title: '金融理财：投资入门指南', description: '为新手投资者提供基础知识', publish_date: '2026-01-22', recording_date: '2026-01-17', status: 'planned', inventory: 2 },
  { episode_number: 5, title: '文化艺术：电影深度解析', description: '深入分析经典电影的艺术价值', publish_date: '2026-01-29', recording_date: '2026-01-24', status: 'planned', inventory: 3 }
];

const sampleContracts = [
  { contract_number: 'CT-2026-001', sponsor_id: 1, category: '饮料', total_slots: 5, used_slots: 2, start_date: '2026-01-01', end_date: '2026-03-31', exclusivity_category: '饮料', max_frequency: 2, makegood_allowed: 1 },
  { contract_number: 'CT-2026-002', sponsor_id: 3, category: '电子', total_slots: 3, used_slots: 1, start_date: '2026-01-01', end_date: '2026-02-28', exclusivity_category: null, max_frequency: 1, makegood_allowed: 1 },
  { contract_number: 'CT-2026-003', sponsor_id: 5, category: '餐饮', total_slots: 4, used_slots: 0, start_date: '2026-02-01', end_date: '2026-04-30', exclusivity_category: '餐饮', max_frequency: 2, makegood_allowed: 0 }
];

const sampleAdSlots = [
  { sponsor_id: 1, episode_id: 1, slot_type: 'pre-roll', position: 1, contract_id: 'CT-2026-001', is_broadcast: 1, is_fulfilled: 1 },
  { sponsor_id: 3, episode_id: 1, slot_type: 'mid-roll', position: 2, contract_id: 'CT-2026-002', is_broadcast: 1, is_fulfilled: 1 },
  { sponsor_id: 1, episode_id: 2, slot_type: 'pre-roll', position: 1, contract_id: 'CT-2026-001', is_broadcast: 0, is_fulfilled: 0 },
  { sponsor_id: 1, episode_id: 2, slot_type: 'post-roll', position: 3, contract_id: 'CT-2026-001', is_broadcast: 0, is_fulfilled: 0 }
];

function insertSampleData() {
  console.log('🚀 开始初始化示例数据...');
  
  const sponsorStmt = db.prepare('INSERT INTO sponsors (name, category, website, contact_person, phone, email) VALUES (?, ?, ?, ?, ?, ?)');
  sampleSponsors.forEach(sponsor => {
    sponsorStmt.run(sponsor.name, sponsor.category, sponsor.website, sponsor.contact_person, sponsor.phone, sponsor.email);
  });
  sponsorStmt.finalize();
  console.log(`✅ 已插入 ${sampleSponsors.length} 个赞助商`);
  
  const episodeStmt = db.prepare('INSERT INTO episodes (episode_number, title, description, publish_date, recording_date, status, inventory) VALUES (?, ?, ?, ?, ?, ?, ?)');
  sampleEpisodes.forEach(episode => {
    episodeStmt.run(episode.episode_number, episode.title, episode.description, episode.publish_date, episode.recording_date, episode.status, episode.inventory);
  });
  episodeStmt.finalize();
  console.log(`✅ 已插入 ${sampleEpisodes.length} 期节目`);
  
  const contractStmt = db.prepare('INSERT INTO contracts (contract_number, sponsor_id, category, total_slots, used_slots, start_date, end_date, exclusivity_category, max_frequency, makegood_allowed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  sampleContracts.forEach(contract => {
    contractStmt.run(contract.contract_number, contract.sponsor_id, contract.category, contract.total_slots, contract.used_slots, contract.start_date, contract.end_date, contract.exclusivity_category, contract.max_frequency, contract.makegood_allowed);
  });
  contractStmt.finalize();
  console.log(`✅ 已插入 ${sampleContracts.length} 份合同`);
  
  const slotStmt = db.prepare('INSERT INTO ad_slots (sponsor_id, episode_id, slot_type, position, contract_id, is_broadcast, is_fulfilled) VALUES (?, ?, ?, ?, ?, ?, ?)');
  sampleAdSlots.forEach(slot => {
    slotStmt.run(slot.sponsor_id, slot.episode_id, slot.slot_type, slot.position, slot.contract_id, slot.is_broadcast, slot.is_fulfilled);
  });
  slotStmt.finalize();
  console.log(`✅ 已插入 ${sampleAdSlots.length} 个广告位`);
  
  console.log('\n🎉 示例数据初始化完成！');
  console.log('\n📊 数据概览：');
  console.log(`   - 赞助商：元气森林、农夫山泉、小米科技、华为、美团外卖`);
  console.log(`   - 节目期数：5期（已发布2期，计划中3期）`);
  console.log(`   - 合同：3份`);
  console.log(`   - 广告位：4个`);
  console.log('\n⚠️ 注意：当前数据包含潜在冲突：');
  console.log('   - 元气森林在第2期安排了2个广告位（频次问题）');
  console.log('   - 第2期还有未履行的广告位');
  
  db.close();
}

insertSampleData();
