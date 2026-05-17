const { run, get, all, initDatabase, closeDatabase } = require('./database');

const seedData = async () => {
  const now = new Date();
  
  const channels = [
    { code: 'home_banner', name: '首页轮播', description: 'APP首页顶部轮播展位', priority: 100 },
    { code: 'home_recommend', name: '首页推荐', description: '首页信息流推荐位', priority: 90 },
    { code: 'category_hot', name: '分类热门', description: '分类页热门专题', priority: 80 },
    { code: 'discovery_daily', name: '发现日报', description: '发现页每日精选', priority: 70 },
    { code: 'push_alert', name: '推送弹窗', description: '用户推送弹窗位', priority: 95 }
  ];

  for (const ch of channels) {
    const existing = await get('SELECT id FROM channels WHERE code = ?', [ch.code]);
    if (!existing) {
      await run(`
        INSERT INTO channels (code, name, description, priority)
        VALUES (?, ?, ?, ?)
      `, [ch.code, ch.name, ch.description, ch.priority]);
    }
  }
  console.log('✓ 频道数据初始化完成');

  const topics = [
    { code: 'spring_festival_2026', name: '2026春节特辑', description: '春节期间热门内容合集', cover_image: 'spring_2026.jpg', content_type: 'collection', created_by: 'zhang.san' },
    { code: 'valentines_day', name: '情人节特别企划', description: '情人节浪漫主题专题', cover_image: 'valentine_2026.jpg', content_type: 'theme', created_by: 'li.si' },
    { code: 'tech_weekly_100', name: '科技周刊第100期', description: '每周科技资讯精选', cover_image: 'tech_100.jpg', content_type: 'weekly', created_by: 'wang.wu' },
    { code: 'food_guide_gz', name: '广州美食全攻略', description: '广州本地美食推荐', cover_image: 'food_gz.jpg', content_type: 'guide', created_by: 'zhao.liu' },
    { code: 'fitness_challenge', name: '30天健身挑战', description: '全民健身计划专题', cover_image: 'fitness_30.jpg', content_type: 'activity', created_by: 'zhang.san' },
    { code: 'movie_spring_2026', name: '2026春节档电影', description: '春节电影盘点与推荐', cover_image: 'movie_2026.jpg', content_type: 'collection', created_by: 'li.si' },
    { code: 'travel_winter', name: '冬日旅行推荐', description: '冬季热门旅游目的地', cover_image: 'travel_winter.jpg', content_type: 'guide', created_by: 'qian.qi' }
  ];

  for (const t of topics) {
    const existing = await get('SELECT id FROM topics WHERE code = ?', [t.code]);
    if (!existing) {
      await run(`
        INSERT INTO topics (code, name, description, cover_image, content_type, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [t.code, t.name, t.description, t.cover_image, t.content_type, t.created_by]);
    }
  }
  console.log('✓ 专题数据初始化完成');

  const channelIds = (await all('SELECT id, code FROM channels')).reduce((map, ch) => {
    map[ch.code] = ch.id;
    return map;
  }, {});

  const topicIds = (await all('SELECT id, code FROM topics')).reduce((map, t) => {
    map[t.code] = t.id;
    return map;
  }, {});

  const existingSchedules = await all('SELECT COUNT(*) as count FROM schedules');
  if (existingSchedules[0].count === 0) {
    const schedules = [
      {
        topic_code: 'spring_festival_2026',
        channel_code: 'home_banner',
        start_time: new Date(now.getFullYear(), now.getMonth(), 25, 0, 0, 0).toISOString(),
        end_time: new Date(now.getFullYear(), now.getMonth() + 1, 1, 23, 59, 59).toISOString(),
        status: 'pending',
        operator: 'zhang.san',
        remark: '春节主会场专题'
      },
      {
        topic_code: 'valentines_day',
        channel_code: 'home_banner',
        start_time: new Date(now.getFullYear(), now.getMonth(), 13, 0, 0, 0).toISOString(),
        end_time: new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59).toISOString(),
        status: 'online',
        operator: 'li.si',
        remark: '情人节预热活动'
      },
      {
        topic_code: 'tech_weekly_100',
        channel_code: 'home_recommend',
        start_time: new Date(now.getFullYear(), now.getMonth(), 15, 8, 0, 0).toISOString(),
        end_time: new Date(now.getFullYear(), now.getMonth(), 16, 23, 59, 59).toISOString(),
        status: 'online',
        operator: 'wang.wu',
        remark: '科技周刊百期纪念'
      },
      {
        topic_code: 'food_guide_gz',
        channel_code: 'discovery_daily',
        start_time: new Date(now.getFullYear(), now.getMonth() - 1, 20, 0, 0, 0).toISOString(),
        end_time: new Date(now.getFullYear(), now.getMonth() - 1, 27, 23, 59, 59).toISOString(),
        status: 'offline',
        operator: 'zhao.liu',
        remark: '广州美食攻略已下刊'
      },
      {
        topic_code: 'fitness_challenge',
        channel_code: 'category_hot',
        start_time: new Date(now.getFullYear(), now.getMonth(), 14, 0, 0, 0).toISOString(),
        end_time: new Date(now.getFullYear(), now.getMonth() + 1, 15, 23, 59, 59).toISOString(),
        status: 'conflict_pending',
        operator: 'zhang.san',
        remark: '与运动专题排期有重叠，待确认'
      },
      {
        topic_code: 'movie_spring_2026',
        channel_code: 'home_banner',
        start_time: new Date(now.getFullYear(), now.getMonth(), 20, 0, 0, 0).toISOString(),
        end_time: new Date(now.getFullYear(), now.getMonth(), 27, 23, 59, 59).toISOString(),
        status: 'conflict_pending',
        operator: 'li.si',
        remark: '与春节特辑排期冲突，需运营确认优先级'
      }
    ];

    for (const s of schedules) {
      await run(`
        INSERT INTO schedules (topic_id, channel_id, start_time, end_time, status, operator, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        topicIds[s.topic_code],
        channelIds[s.channel_code],
        s.start_time,
        s.end_time,
        s.status,
        s.operator,
        s.remark
      ]);
    }
    console.log('✓ 排期数据初始化完成');

    const scheduleIds = await all('SELECT id FROM schedules ORDER BY id');
    
    const historyRecords = [
      {
        schedule_idx: 1,
        action: 'status_change',
        old_status: null,
        new_status: 'online',
        operator: 'li.si',
        remark: '情人节专题上线',
        change_details: JSON.stringify({ field: 'status', from: 'pending', to: 'online' })
      },
      {
        schedule_idx: 2,
        action: 'status_change',
        old_status: null,
        new_status: 'online',
        operator: 'wang.wu',
        remark: '科技周刊上线',
        change_details: JSON.stringify({ field: 'status', from: 'pending', to: 'online' })
      },
      {
        schedule_idx: 3,
        action: 'status_change',
        old_status: 'online',
        new_status: 'offline',
        operator: 'zhao.liu',
        remark: '美食攻略下刊',
        change_details: JSON.stringify({ field: 'status', from: 'online', to: 'offline' })
      },
      {
        schedule_idx: 4,
        action: 'conflict_detected',
        old_status: 'pending',
        new_status: 'conflict_pending',
        operator: 'system',
        remark: '系统检测到排期冲突',
        change_details: JSON.stringify({ conflict_with: '运动专题', overlap_hours: 48 })
      },
      {
        schedule_idx: 5,
        action: 'conflict_detected',
        old_status: 'pending',
        new_status: 'conflict_pending',
        operator: 'system',
        remark: '系统检测到排期冲突',
        change_details: JSON.stringify({ conflict_with: '春节特辑', overlap_days: 5 })
      }
    ];

    for (const h of historyRecords) {
      const scheduleId = scheduleIds[h.schedule_idx].id;
      await run(`
        INSERT INTO schedule_history (schedule_id, action, old_status, new_status, operator, remark, change_details)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        scheduleId,
        h.action,
        h.old_status,
        h.new_status,
        h.operator,
        h.remark,
        h.change_details
      ]);
    }
    console.log('✓ 历史记录初始化完成');
  } else {
    console.log('ℹ 排期数据已存在，跳过初始化');
  }

  console.log('\n✅ 所有种子数据初始化完成！');
  const channelCount = (await all('SELECT COUNT(*) as count FROM channels'))[0].count;
  const topicCount = (await all('SELECT COUNT(*) as count FROM topics'))[0].count;
  const scheduleCount = (await all('SELECT COUNT(*) as count FROM schedules'))[0].count;
  const historyCount = (await all('SELECT COUNT(*) as count FROM schedule_history'))[0].count;
  
  console.log(`  - 频道: ${channelCount} 个`);
  console.log(`  - 专题: ${topicCount} 个`);
  console.log(`  - 排期: ${scheduleCount} 条`);
  console.log(`  - 历史记录: ${historyCount} 条`);
};

const main = async () => {
  try {
    await initDatabase();
    await seedData();
  } catch (error) {
    console.error('种子数据初始化失败:', error);
  } finally {
    await closeDatabase();
  }
};

main();
