const KMLParser = require('./kmlParser');
const NoFlyZoneChecker = require('./noFlyZoneChecker');
const BatteryManager = require('./batteryManager');
const MissionStore = require('./missionStore');
const ReportGenerator = require('./reportGenerator');
const { UserFriendlyError, createError, wrapError } = require('./utils/errors');

class DisasterRoadRecon {
  constructor() {
    this.kmlParser = new KMLParser();
    this.noFlyZoneChecker = new NoFlyZoneChecker();
    this.batteryManager = new BatteryManager();
    this.missionStore = new MissionStore();
    this.reportGenerator = new ReportGenerator();
  }

  async analyzeMission(missionData) {
    try {
      const { date, routeName, pilot, kmlPath, batteryPath, weather } = missionData;
      
      console.log(`\n📋 开始分析任务: ${routeName}`);
      
      const routeData = this.kmlParser.parse(kmlPath);
      console.log(`  ✅ 航线解析完成，共 ${routeData.waypoints.length} 个航点`);
      
      const batteryData = this.batteryManager.parseLog(batteryPath);
      console.log(`  ✅ 电池记录读取完成，共 ${batteryData.records.length} 条记录`);
      
      const noFlyZoneResult = this.noFlyZoneChecker.checkRoute(routeData.waypoints);
      console.log(`  ✅ 禁飞区检查: ${noFlyZoneResult.summary}`);
      
      const batterySafetyResult = this.batteryManager.checkSafety(batteryData);
      console.log(`  ✅ 电池安全检查: ${batterySafetyResult.summary}`);
      
      const analysis = {
        route: {
          waypointCount: routeData.waypoints.length,
          totalDistance: routeData.totalDistance,
          maxAltitude: routeData.maxAltitude,
          waypoints: routeData.waypoints
        },
        noFlyZone: noFlyZoneResult,
        battery: batteryData,
        batterySafety: batterySafetyResult,
        weather: weather || null,
        safe: noFlyZoneResult.safe && batterySafetyResult.safe,
        analyzedAt: new Date().toISOString()
      };
      
      const quickReport = this.reportGenerator.generateQuickReport(analysis);
      console.log(quickReport);
      
      const storeData = {
        date,
        routeName,
        pilot,
        waypoints: routeData.waypoints,
        batteryRecords: batteryData.records,
        kmlFile: routeData.filename,
        batteryFile: batteryData.filename
      };
      
      const duplicateCheck = this.missionStore.checkDuplicate(storeData);
      
      if (duplicateCheck.isDuplicate) {
        console.log(`  ℹ️  这个任务之前已经分析过了`);
        return {
          isDuplicate: true,
          missionId: duplicateCheck.missionId,
          existingMission: duplicateCheck.existingMission,
          analysis
        };
      }
      
      if (duplicateCheck.existingMission) {
        console.log(`  ⚠️  发现同任务的历史记录，数据有变化`);
        
        if (duplicateCheck.differences.battery) {
          const oldBatteryData = { records: duplicateCheck.existingMission.analysis.battery.records };
          const changes = this.batteryManager.compareVersions(oldBatteryData, batteryData);
          
          if (changes.hasChanges) {
            const changeReport = this.reportGenerator.generateChangeReport(changes.changes);
            console.log(changeReport);
          }
        }
      }
      
      const mission = this.missionStore.saveMission(storeData, analysis);
      console.log(`  💾 任务已保存，版本 v${mission.version}`);
      
      const report = this.reportGenerator.generateReport(mission, analysis);
      console.log(`  📄 复盘报告已生成: ${report.filename}`);
      
      return {
        isDuplicate: false,
        missionId: mission.id,
        mission,
        analysis,
        report
      };
      
    } catch (e) {
      if (e instanceof UserFriendlyError) {
        console.error(e.toHumanReadable());
      } else {
        const wrapped = wrapError(e, '分析任务');
        console.error(wrapped.toHumanReadable());
      }
      throw e;
    }
  }

  getMission(missionId) {
    return this.missionStore.findMission(missionId);
  }

  listMissions(options = {}) {
    return this.missionStore.listMissions(options);
  }

  getVersionHistory(missionId) {
    return this.missionStore.getVersionHistory(missionId);
  }

  compareMissionVersions(missionId, versionA, versionB) {
    return this.missionStore.compareVersions(missionId, versionA, versionB);
  }

  exportReport(missionId) {
    const mission = this.missionStore.findMission(missionId);
    if (!mission) {
      throw createError('FILE_NOT_FOUND', missionId);
    }
    return this.reportGenerator.generateReport(mission, mission.analysis);
  }
}

module.exports = DisasterRoadRecon;
