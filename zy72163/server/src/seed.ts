import { initDatabase } from './database';
import db from './database';
import { findOrCreateLocation } from './services/locationService';
import { createFeedback } from './services/feedbackService';
import { checkAndCreateConflicts } from './services/conflictService';

const sampleFeedbacks = [
  {
    locationName: '南京西路1266号恒隆广场门口',
    lat: 31.2304,
    lng: 121.4737,
    address: '南京西路1266号',
    street: '南京西路',
    district: '静安区',
    feedbackNo: 'FB202401001',
    reporter: '张女士',
    phone: '138****1234',
    feedbackDate: '2024-01-15',
    content: '门口那棵梧桐树树枝太长，挡到人行道了，走路要弯腰',
    rawContent: '【市民热线】张女士 138****1234：南京西路1266号恒隆广场门口那棵梧桐树，树枝太茂盛了，长到人行道这边来，走路都要弯腰过去，能不能修剪一下？',
    priority: 'high',
    source: '12345市民热线'
  },
  {
    locationName: '恒隆广场正门大树',
    lat: 31.23041,
    lng: 121.47371,
    address: '南京西路1266号',
    street: '南京西路',
    district: '静安区',
    feedbackNo: 'FB202401008',
    reporter: '李先生',
    feedbackDate: '2024-01-18',
    content: '大树枝叶挡住了店铺招牌，影响生意',
    rawContent: '恒隆广场正门那棵大树，树枝把我们店的招牌都挡住了，客人都看不到，赶紧来剪一剪！',
    priority: 'medium',
    source: '微信公众号'
  },
  {
    locationName: '人民大道200号市政府大院',
    lat: 31.2315,
    lng: 121.4690,
    address: '人民大道200号',
    street: '人民大道',
    district: '黄浦区',
    feedbackNo: 'FB202401002',
    reporter: '王师傅',
    feedbackDate: '2024-01-10',
    content: '院内香樟树有枯枝，怕掉下来砸到人',
    rawContent: '王师傅来电：市政府大院里的香樟树，上面有几根枯枝，看起来快要掉下来了，万一砸到人就麻烦了！',
    priority: 'urgent',
    source: '电话报修'
  },
  {
    locationName: '淮海中路999号环贸广场',
    lat: 31.2250,
    lng: 121.4600,
    address: '淮海中路999号',
    street: '淮海中路',
    district: '徐汇区',
    feedbackNo: 'FB202401003',
    reporter: '',
    feedbackDate: '2024-01-12',
    content: '',
    rawContent: '淮海中路999号，马路边的树需要修剪一下，树枝太长了。',
    priority: 'low',
    source: '匿名邮件'
  },
  {
    locationName: '世纪大道1号东方明珠',
    lat: 31.2397,
    lng: 121.4998,
    address: '世纪大道1号',
    street: '世纪大道',
    district: '浦东新区',
    feedbackNo: 'FB202401004',
    reporter: '赵先生',
    feedbackDate: '2024-01-20',
    content: '河边的柳树长得太密，影响观光视线',
    rawContent: '【随手拍】赵先生上传照片：东方明珠旁边的滨江大道，柳树长得太密了，把江景都挡住了，游客拍照都不好看。建议定期修剪。',
    priority: 'medium',
    source: 'APP上报'
  },
  {
    locationName: '南京西路1266号',
    lat: 31.23042,
    lng: 121.47372,
    address: '南京西路1266号',
    street: '南京西路',
    district: '静安区',
    feedbackNo: 'FB202401005',
    reporter: '陈阿姨',
    feedbackDate: '2024-01-22',
    content: '树上面有个大马蜂窝，太危险了！',
    rawContent: '陈阿姨：南京西路1266号那棵树上，我看到有个马蜂窝，好大一个，蜇到人可不得了，赶紧处理一下！',
    priority: 'urgent',
    source: '社区居委会'
  },
  {
    locationName: '外滩中山东一路33号',
    lat: 31.2400,
    lng: 121.4900,
    address: '中山东一路33号',
    street: '中山东一路',
    district: '黄浦区',
    feedbackNo: 'FB202401006',
    reporter: '孙先生',
    feedbackDate: '2024-01-08',
    content: '梧桐树的树枝已经碰到电线了，有安全隐患',
    rawContent: '孙先生反映：外滩中山东一路33号附近，有一棵梧桐树的树枝已经碰到电线了，刮风的时候树枝摩擦电线，很危险，希望尽快处理。',
    priority: 'urgent',
    source: '电力公司转办'
  },
  {
    locationName: '虹桥路1号港汇恒隆',
    lat: 31.1950,
    lng: 121.4300,
    address: '虹桥路1号',
    street: '虹桥路',
    district: '徐汇区',
    feedbackNo: 'FB202401007',
    reporter: '',
    feedbackDate: '2024-01-25',
    content: '',
    rawContent: '',
    priority: 'medium',
    source: '巡检发现'
  }
];

const streetNotes = [
  {
    streetName: '南京西路',
    content: '南京西路全段梧桐树每年3-4月统一修剪，注意避开客流高峰时段。',
    author: '绿化养护队',
    source: '养护手册'
  },
  {
    streetName: '外滩',
    content: '外滩沿线树木修剪需提前报备文旅部门，避免影响历史风貌区景观。',
    author: '区绿化局',
    source: '区里文件'
  }
];

export function seedDatabase() {
  initDatabase();
  
  const existing = db.locations.all();
  if (existing.length > 0) {
    console.log('数据库已有数据，跳过样例初始化');
    return;
  }

  console.log('开始初始化样例数据...');

  const locationIds: number[] = [];

  for (const fb of sampleFeedbacks) {
    try {
      const { location, aliases } = findOrCreateLocation(
        fb.locationName,
        fb.lat,
        fb.lng,
        fb.address,
        fb.street,
        fb.district
      );

      const feedback = createFeedback({
        locationId: location.id,
        feedbackNo: fb.feedbackNo,
        reporter: fb.reporter,
        phone: fb.phone,
        feedbackDate: fb.feedbackDate,
        content: fb.content,
        rawContent: fb.rawContent,
        source: fb.source,
        status: 'pending',
        priority: fb.priority
      });

      checkAndCreateConflicts(feedback.id);

      if (!locationIds.includes(location.id)) {
        locationIds.push(location.id);
        console.log(`  创建点位: ${location.name} (别名: ${aliases.join(', ')})`);
      }
      console.log(`  导入反馈: ${fb.feedbackNo} - ${fb.content.substring(0, 20)}...`);
    } catch (e) {
      console.error(`导入失败: ${fb.feedbackNo}`, e);
    }
  }

  for (let i = 0; i < streetNotes.length; i++) {
    const note = streetNotes[i];
    const targetLoc = db.locations.findOne((l: any) => l.street?.includes(note.streetName));
    if (targetLoc) {
      db.street_notes.insert({
        locationId: targetLoc.id,
        streetName: note.streetName,
        content: note.content,
        author: note.author,
        source: note.source
      });
      console.log(`  添加街道备注: ${note.streetName}`);
    }
  }

  console.log(`\n样例数据初始化完成！`);
  console.log(`  点位数量: ${db.locations.all().length}`);
  console.log(`  反馈数量: ${db.resident_feedbacks.all().length}`);
  console.log(`  冲突数量: ${db.data_conflicts.filter((c: any) => !c.resolvedAt).length}`);
  console.log(`  街道备注: ${db.street_notes.all().length}`);
}

if (require.main === module) {
  seedDatabase();
}
