const path = require('path');
const DisasterRoadRecon = require('./index');
const fs = require('fs');

async function runDemo() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          灾后道路侦察 - 飞行复盘系统演示                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const recon = new DisasterRoadRecon();

  const missionData = {
    date: '2024-05-31',
    routeName: '迎宾大道',
    pilot: '张队长',
    kmlPath: path.join(__dirname, '..', 'data', 'sample-route.kml'),
    batteryPath: path.join(__dirname, '..', 'data', 'battery-log.txt'),
    weather: {
      windSpeed: 3.2,
      visibility: 5000,
      condition: '晴'
    }
  };

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【第一次运行 - 正常分析任务');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await recon.analyzeMission(missionData);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【第二次运行 - 同样的数据，测试幂等性');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await recon.analyzeMission(missionData);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【第三次运行 - 修改电池记录，测试版本变更检测');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const modifiedBatteryPath = path.join(__dirname, '..', 'data', 'battery-log-modified.txt');
  fs.writeFileSync(modifiedBatteryPath, `# 2024-05-31 电池记录（修改版）
08:00 BAT01 23.5V 95%
08:30 BAT01 23.2V 88%
09:00 BAT01 22.9V 75%
09:30 BAT01 22.6V 62%
10:00 BAT01 22.0V 45%
10:30 BAT02 23.4V 92%
11:00 BAT02 23.1V 82%
11:30 BAT02 22.8V 70%
12:00 BAT02 22.5V 58%
`, 'utf8');

  const modifiedMission = {
    ...missionData,
    batteryPath: modifiedBatteryPath
  };
  
  await recon.analyzeMission(modifiedMission);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【查看历史版本记录');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const missions = recon.listMissions();
  console.log(`\n共 ${missions.length} 条任务记录:`);
  missions.forEach(m => {
    console.log(`  - ${m.id} (v${m.version}) - ${m.routeName} - ${m.date}`);
  });

  const missionId = '2024-05-31-迎宾大道-张队长';
  const history = recon.getVersionHistory(missionId);
  console.log(`\n${missionId} 的版本历史:`);
  history.forEach(h => {
    console.log(`  v${h.version} - ${new Date(h.savedAt).toLocaleString('zh-CN')}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('演示完成！复盘报告已生成到 output 文件夹');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

runDemo().catch(console.error);
