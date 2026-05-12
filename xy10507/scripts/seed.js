const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

function seed() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const campaignId = uuidv4();

      db.run(
        `INSERT INTO campaigns (id, name, description) VALUES (?, ?, ?)`,
        [campaignId, '夏季新品推广活动', '2024年夏季新品系列全渠道推广'],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }

          const channelData = [
            { id: uuidv4(), name: '微信广告', code: 'wechat', desc: '微信朋友圈、小程序广告' },
            { id: uuidv4(), name: '抖音广告', code: 'douyin', desc: '抖音信息流、直播推广' },
            { id: uuidv4(), name: '小红书', code: 'xhs', desc: '小红书笔记、搜索广告' },
            { id: uuidv4(), name: '微博广告', code: 'weibo', desc: '微博信息流、话题推广' },
            { id: uuidv4(), name: '百度信息流', code: 'baidu', desc: '百度APP、好看视频信息流' }
          ];

          const materialData = [
            { id: uuidv4(), version: '1.0', title: '夏季新品首发', content: '2024夏季新品系列，清凉上市，限时8折优惠', creator: '李明' },
            { id: uuidv4(), version: '1.1', title: '夏季新品首发-升级版', content: '2024夏季新品系列，清凉上市，限时8折优惠，满300减50', creator: '李明' },
            { id: uuidv4(), version: '2.0', title: '夏日清凉节', content: '夏日清凉节，全场满299减80，限时抢券', creator: '王芳' },
            { id: uuidv4(), version: '2.1', title: '夏日清凉节-直播版', content: '夏日清凉节直播间专属，限时秒杀低至5折', creator: '王芳' },
            { id: uuidv4(), version: '3.0', title: '周末狂欢购', content: '周末狂欢购，新品首发价，叠加满减更优惠', creator: '张伟' }
          ];

          materialData.forEach((mat, idx) => {
            db.run(
              `INSERT INTO materials (id, campaign_id, parent_version_id, version, title, content, creator)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [mat.id, campaignId, idx === 0 ? null : materialData[idx - 1].id,
               mat.version, mat.title, mat.content, mat.creator],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }
              }
            );
          });

          channelData.forEach(ch => {
            db.run(
              `INSERT INTO channels (id, name, code, description) VALUES (?, ?, ?, ?)`,
              [ch.id, ch.name, ch.code, ch.desc],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }
              }
            );
          });

          setTimeout(() => {
            db.run('COMMIT', (err) => {
              if (err) {
                db.run('ROLLBACK');
                return reject(err);
              }
              console.log('\n========================================');
              console.log('  样例数据插入成功!');
              console.log('========================================');
              console.log(`\n  活动ID: ${campaignId}`);
              console.log(`  活动名称: 夏季新品推广活动`);
              console.log(`\n  渠道数: ${channelData.length}`);
              console.log(`  素材版本数: ${materialData.length}`);
              console.log(`\n  素材版本树结构:`);
              materialData.forEach(m => {
                console.log(`    └─ v${m.version}: ${m.title}`);
              });
              console.log('\n  接下来运行: npm run demo:success 或 npm run demo:failure');
              console.log('========================================\n');

              resolve({ campaignId, channels: channelData, materials: materialData });
            });
          }, 100);
        }
      );
    });
  });
}

seed().catch(err => {
  console.error('初始化数据失败:', err.message);
  process.exit(1);
}).finally(() => {
  setTimeout(() => db.close(), 500);
});

module.exports = seed;
