import {
  ObservingSite,
  Device,
  ObservingTarget,
  TargetWindow,
  LightPollutionData,
  Risk,
  RiskSeverity,
} from './types.js';

export class RiskDetector {
  private minAltitude: number;
  private minBatteryLevel: number;
  private moonPhaseThreshold: number;
  private moonAltitudeThreshold: number;

  constructor(options: {
    minAltitude?: number;
    minBatteryLevel?: number;
    moonPhaseThreshold?: number;
    moonAltitudeThreshold?: number;
  } = {}) {
    this.minAltitude = options.minAltitude ?? 15;
    this.minBatteryLevel = options.minBatteryLevel ?? 30;
    this.moonPhaseThreshold = options.moonPhaseThreshold ?? 0.5;
    this.moonAltitudeThreshold = options.moonAltitudeThreshold ?? 10;
  }

  detectAllRisks(
    windows: TargetWindow[],
    targets: ObservingTarget[],
    devices: Device[],
    site: ObservingSite,
    lightPollution?: LightPollutionData,
    activityDate?: string
  ): Risk[] {
    const risks: Risk[] = [];
    const targetsMap = new Map(targets.map(t => [t.id, t]));

    for (const window of windows) {
      const target = targetsMap.get(window.targetId);
      if (!target) continue;

      const windowRisks = this.detectWindowRisks(
        window,
        target,
        devices,
        site,
        windows,
        lightPollution,
        activityDate
      );

      risks.push(...windowRisks);
    }

    return risks;
  }

  detectWindowRisks(
    window: TargetWindow,
    target: ObservingTarget,
    devices: Device[],
    site: ObservingSite,
    allWindows: TargetWindow[],
    lightPollution?: LightPollutionData,
    activityDate?: string
  ): Risk[] {
    const risks: Risk[] = [];

    risks.push(...this.checkAltitude(window, target, site, activityDate));
    risks.push(...this.checkMoonInterference(window, target, site, activityDate));
    risks.push(...this.checkBattery(window, target, devices));
    risks.push(...this.checkDeviceConflict(window, target, allWindows, devices));
    risks.push(...this.checkWindowConflict(window, target, allWindows));

    return risks;
  }

  private checkAltitude(
    window: TargetWindow,
    target: ObservingTarget,
    site: ObservingSite,
    activityDate?: string
  ): Risk[] {
    const risks: Risk[] = [];

    const windowStartTime = new Date(window.startTime);
    const windowEndTime = new Date(window.endTime);
    const totalMinutes = (windowEndTime.getTime() - windowStartTime.getTime()) / (1000 * 60);

    let lowAltitudeMinutes = 0;
    const checkInterval = 10;

    for (let minutes = 0; minutes < totalMinutes; minutes += checkInterval) {
      const checkTime = new Date(windowStartTime.getTime() + minutes * 60 * 1000);
      const altitude = this.calculateAltitude(
        target,
        site,
        checkTime
      );

      if (altitude < this.minAltitude) {
        lowAltitudeMinutes += checkInterval;
      }
    }

    if (lowAltitudeMinutes > 0) {
      const percentage = Math.round((lowAltitudeMinutes / totalMinutes) * 100);
      risks.push(this.createRisk(
        window.id,
        target.name,
        'altitude_too_low',
        percentage > 50 ? 'critical' : 'warning',
        `目标天体地平高度不足。观测窗口内约 ${percentage}% 的时间高度低于 ${this.minAltitude}° 阈值。`
      ));
    }

    return risks;
  }

  private checkMoonInterference(
    window: TargetWindow,
    target: ObservingTarget,
    site: ObservingSite,
    activityDate?: string
  ): Risk[] {
    const risks: Risk[] = [];

    const windowStartTime = new Date(window.startTime);
    const windowEndTime = new Date(window.endTime);
    const totalMinutes = (windowEndTime.getTime() - windowStartTime.getTime()) / (1000 * 60);

    let interferenceMinutes = 0;
    const checkInterval = 10;

    for (let minutes = 0; minutes < totalMinutes; minutes += checkInterval) {
      const checkTime = new Date(windowStartTime.getTime() + minutes * 60 * 1000);
      const moonData = this.calculateMoonData(site, checkTime);

      if (moonData.altitude > this.moonAltitudeThreshold && moonData.illuminatedFraction > this.moonPhaseThreshold) {
        const moonTargetSeparation = this.calculateAngularSeparation(
          target,
          moonData,
          site,
          checkTime
        );

        if (moonTargetSeparation < 60) {
          interferenceMinutes += checkInterval;
        }
      }
    }

    if (interferenceMinutes > 0) {
      const percentage = Math.round((interferenceMinutes / totalMinutes) * 100);
      risks.push(this.createRisk(
        window.id,
        target.name,
        'moon_interference',
        percentage > 50 ? 'critical' : 'warning',
        `存在月光干扰。观测窗口内约 ${percentage}% 的时间月球亮度高且距离目标较近 (< 60°)。`
      ));
    }

    return risks;
  }

  private checkBattery(
    window: TargetWindow,
    target: ObservingTarget,
    devices: Device[]
  ): Risk[] {
    const risks: Risk[] = [];
    const devicesMap = new Map(devices.map(d => [d.id, d]));

    for (const deviceId of window.deviceIds) {
      const device = devicesMap.get(deviceId);
      if (!device) continue;

      if (device.batteryLevel < this.minBatteryLevel) {
        risks.push(this.createRisk(
          window.id,
          target.name,
          'battery_low',
          'critical',
          `设备 "${device.name}" (${device.type}) 电量不足 (${device.batteryLevel}%)，低于阈值 ${this.minBatteryLevel}%。`
        ));
      } else if (device.batteryLevel < this.minBatteryLevel * 1.5) {
        risks.push(this.createRisk(
          window.id,
          target.name,
          'battery_low',
          'warning',
          `设备 "${device.name}" (${device.type}) 电量偏低 (${device.batteryLevel}%)，建议提前充电。`
        ));
      }
    }

    return risks;
  }

  private checkDeviceConflict(
    window: TargetWindow,
    target: ObservingTarget,
    allWindows: TargetWindow[],
    devices: Device[]
  ): Risk[] {
    const risks: Risk[] = [];
    const devicesMap = new Map(devices.map(d => [d.id, d]));

    for (const deviceId of window.deviceIds) {
      const device = devicesMap.get(deviceId);
      if (!device) continue;

      if (!device.isAvailable) {
        risks.push(this.createRisk(
          window.id,
          target.name,
          'device_conflict',
          'critical',
          `设备 "${device.name}" (${device.type}) 当前不可用，标记为已占用或维护中。`
        ));
      }

      const conflictingWindows = allWindows.filter(w => {
        if (w.id === window.id) return false;
        if (!w.deviceIds.includes(deviceId)) return false;
        return this.doTimeRangesOverlap(
          new Date(window.startTime),
          new Date(window.endTime),
          new Date(w.startTime),
          new Date(w.endTime)
        );
      });

      if (conflictingWindows.length > 0) {
        for (const conflict of conflictingWindows) {
          risks.push(this.createRisk(
            window.id,
            target.name,
            'device_conflict',
            'critical',
            `设备 "${device.name}" (${device.type}) 与另一观测目标的窗口冲突。冲突时间: ${this.formatTimeRange(conflict.startTime, conflict.endTime)}`
          ));
        }
      }
    }

    return risks;
  }

  private checkWindowConflict(
    window: TargetWindow,
    target: ObservingTarget,
    allWindows: TargetWindow[]
  ): Risk[] {
    const risks: Risk[] = [];

    const conflictingWindows = allWindows.filter(w => {
      if (w.id === window.id) return false;
      if (w.targetId !== window.targetId) return false;
      return this.doTimeRangesOverlap(
        new Date(window.startTime),
        new Date(window.endTime),
        new Date(w.startTime),
        new Date(w.endTime)
      );
    });

    if (conflictingWindows.length > 0) {
      for (const conflict of conflictingWindows) {
        risks.push(this.createRisk(
          window.id,
          target.name,
          'window_conflict',
          'warning',
          `同一目标天体存在重叠观测窗口。冲突窗口时间: ${this.formatTimeRange(conflict.startTime, conflict.endTime)}`
        ));
      }
    }

    return risks;
  }

  private createRisk(
    windowId: string,
    targetName: string,
    type: Risk['type'],
    severity: RiskSeverity,
    message: string
  ): Risk {
    return {
      id: `risk_${crypto.randomUUID()}`,
      windowId,
      targetName,
      type,
      severity,
      message,
      isOverridden: false,
    };
  }

  private doTimeRangesOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): boolean {
    return start1 < end2 && start2 < end1;
  }

  private formatTimeRange(start: string, end: string): string {
    const startTime = new Date(start);
    const endTime = new Date(end);
    return `${startTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} - ${endTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  private calculateAltitude(
    target: ObservingTarget,
    site: ObservingSite,
    time: Date
  ): number {
    const ra = this.parseRightAscension(target.rightAscension);
    const dec = this.parseDeclination(target.declination);
    const lst = this.calculateLocalSiderealTime(time, site.longitude);
    const ha = (lst - ra + 360) % 360;

    const latRad = this.toRadians(site.latitude);
    const decRad = this.toRadians(dec);
    const haRad = this.toRadians(ha);

    const sinAlt =
      Math.sin(latRad) * Math.sin(decRad) +
      Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);

    const altitude = this.toDegrees(Math.asin(Math.max(-1, Math.min(1, sinAlt))));
    return altitude;
  }

  private calculateMoonData(
    site: ObservingSite,
    time: Date
  ): {
    rightAscension: number;
    declination: number;
    altitude: number;
    illuminatedFraction: number;
  } {
    const jd = this.julianDate(time);
    const n = jd - 2451545.0;

    const L = this.normalizeAngle(218.3164 + 13.17639648 * n);
    const M = this.normalizeAngle(134.9629 + 13.0649929509 * n);
    const F = this.normalizeAngle(93.2720 + 13.2293502693 * n);

    const D = this.normalizeAngle(297.8501921 + 12.1907491238 * n);
    const sunAnomaly = this.normalizeAngle(357.5277233 + 0.98560028 * n);

    const moonLong = L +
      6.28875 * Math.sin(this.toRadians(M)) +
      1.274018 * Math.sin(this.toRadians(2 * D - M)) +
      0.658309 * Math.sin(this.toRadians(2 * D)) +
      0.213616 * Math.sin(this.toRadians(2 * M)) +
      -0.185596 * Math.sin(this.toRadians(sunAnomaly));

    const moonLat =
      5.128122 * Math.sin(this.toRadians(F)) +
      0.280606 * Math.sin(this.toRadians(M + F)) +
      -0.280606 * Math.sin(this.toRadians(M - F));

    const ra = this.normalizeAngle(moonLong);
    const dec = moonLat;

    const lst = this.calculateLocalSiderealTime(time, site.longitude);
    const ha = (lst - ra + 360) % 360;

    const latRad = this.toRadians(site.latitude);
    const decRad = this.toRadians(dec);
    const haRad = this.toRadians(ha);

    const sinAlt =
      Math.sin(latRad) * Math.sin(decRad) +
      Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);

    const altitude = this.toDegrees(Math.asin(Math.max(-1, Math.min(1, sinAlt))));

    const phaseAngle = Math.abs(D - 180);
    const illuminatedFraction = (1 + Math.cos(this.toRadians(phaseAngle))) / 2;

    return {
      rightAscension: ra,
      declination: dec,
      altitude,
      illuminatedFraction,
    };
  }

  private calculateAngularSeparation(
    target: ObservingTarget,
    moonData: { rightAscension: number; declination: number },
    site: ObservingSite,
    time: Date
  ): number {
    const ra1 = this.parseRightAscension(target.rightAscension);
    const dec1 = this.parseDeclination(target.declination);
    const ra2 = moonData.rightAscension;
    const dec2 = moonData.declination;

    const raRad1 = this.toRadians(ra1);
    const decRad1 = this.toRadians(dec1);
    const raRad2 = this.toRadians(ra2);
    const decRad2 = this.toRadians(dec2);

    const dRa = Math.abs(raRad1 - raRad2);

    const cosSeparation =
      Math.sin(decRad1) * Math.sin(decRad2) +
      Math.cos(decRad1) * Math.cos(decRad2) * Math.cos(dRa);

    const separation = this.toDegrees(Math.acos(Math.max(-1, Math.min(1, cosSeparation))));
    return separation;
  }

  private parseRightAscension(ra: string): number {
    const parts = ra.split(/[hms]/).filter(Boolean);
    if (parts.length >= 3) {
      const hours = parseFloat(parts[0]);
      const minutes = parseFloat(parts[1]);
      const seconds = parseFloat(parts[2]);
      return (hours + minutes / 60 + seconds / 3600) * 15;
    }
    return parseFloat(ra) * 15;
  }

  private parseDeclination(dec: string): number {
    const parts = dec.split(/[°'"]/).filter(Boolean);
    const sign = dec.includes('-') ? -1 : 1;

    if (parts.length >= 3) {
      const degrees = Math.abs(parseFloat(parts[0]));
      const minutes = parseFloat(parts[1]);
      const seconds = parseFloat(parts[2]);
      return sign * (degrees + minutes / 60 + seconds / 3600);
    }
    return parseFloat(dec);
  }

  private calculateLocalSiderealTime(time: Date, longitude: number): number {
    const jd = this.julianDate(time);
    const t = (jd - 2451545.0) / 36525.0;

    let gmst =
      280.46061837 +
      360.98564736629 * (jd - 2451545.0) +
      0.000387933 * t * t -
      (t * t * t) / 38710000.0;

    gmst = this.normalizeAngle(gmst);

    return this.normalizeAngle(gmst + longitude);
  }

  private julianDate(date: Date): number {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate() +
      date.getUTCHours() / 24 +
      date.getUTCMinutes() / 1440 +
      date.getUTCSeconds() / 86400;

    let year = y;
    let month = m;

    if (month <= 2) {
      year -= 1;
      month += 12;
    }

    const a = Math.floor(year / 100);
    const b = 2 - a + Math.floor(a / 4);

    return Math.floor(365.25 * (year + 4716)) +
      Math.floor(30.6001 * (month + 1)) +
      d + b - 1524.5;
  }

  private normalizeAngle(angle: number): number {
    let a = angle % 360;
    if (a < 0) a += 360;
    return a;
  }

  private toRadians(degrees: number): number {
    return degrees * Math.PI / 180;
  }

  private toDegrees(radians: number): number {
    return radians * 180 / Math.PI;
  }
}

export const riskDetector = new RiskDetector();
