import {
  Schedule,
  FilmVersion,
  AuditoriumDevice,
  KDM,
  ProjectionCheck,
  CheckStatus,
  RuleCheckResult,
  OverallCheckResult,
} from '../models';

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusEmoji(status: CheckStatus): string {
  switch (status) {
    case CheckStatus.PASS:
      return '✅';
    case CheckStatus.WARN:
      return '⚠️';
    case CheckStatus.BLOCK:
      return '❌';
    default:
      return '❓';
  }
}

function getStatusText(status: CheckStatus): string {
  switch (status) {
    case CheckStatus.PASS:
      return '放行';
    case CheckStatus.WARN:
      return '警告';
    case CheckStatus.BLOCK:
      return '阻断';
    default:
      return '未知';
  }
}

export interface HandoverReportData {
  reportDate: string;
  generatedAt: string;
  generatedBy: string;
  schedules: Schedule[];
  filmVersions: Map<string, FilmVersion>;
  auditoriums: Map<string, AuditoriumDevice>;
  kdms: KDM[];
  checkResults: Map<string, OverallCheckResult>;
  latestChecks: Map<string, ProjectionCheck>;
}

export function generateHandoverReport(data: HandoverReportData): string {
  const {
    reportDate,
    generatedAt,
    generatedBy,
    schedules,
    filmVersions,
    auditoriums,
    kdms,
    checkResults,
    latestChecks,
  } = data;

  const schedulesByAuditorium = new Map<string, Schedule[]>();
  for (const schedule of schedules) {
    if (!schedulesByAuditorium.has(schedule.auditoriumId)) {
      schedulesByAuditorium.set(schedule.auditoriumId, []);
    }
    schedulesByAuditorium.get(schedule.auditoriumId)!.push(schedule);
  }

  for (const auditoriumId of schedulesByAuditorium.keys()) {
    const sorted = schedulesByAuditorium.get(auditoriumId)!.sort((a, b) => 
      new Date(a.showTime.start).getTime() - new Date(b.showTime.start).getTime()
    );
    schedulesByAuditorium.set(auditoriumId, sorted);
  }

  const blockCount = Array.from(checkResults.values()).filter(r => r.overallStatus === CheckStatus.BLOCK).length;
  const warnCount = Array.from(checkResults.values()).filter(r => r.overallStatus === CheckStatus.WARN).length;
  const passCount = Array.from(checkResults.values()).filter(r => r.overallStatus === CheckStatus.PASS).length;

  const lines: string[] = [];

  lines.push('# 影厅密钥排片卫士 - 交接班报告');
  lines.push('');
  lines.push(`**报告日期**: ${reportDate}`);
  lines.push(`**生成时间**: ${formatDateTime(generatedAt)}`);
  lines.push(`**生成人**: ${generatedBy}`);
  lines.push('');

  lines.push('## 📊 今日概览');
  lines.push('');
  lines.push('| 状态 | 数量 |');
  lines.push('|------|------|');
  lines.push(`| ✅ 放行 | ${passCount} |`);
  lines.push(`| ⚠️ 警告 | ${warnCount} |`);
  lines.push(`| ❌ 阻断 | ${blockCount} |`);
  lines.push('');

  if (blockCount > 0) {
    lines.push('### ⚠️ 阻断项清单');
    lines.push('');
    lines.push('> 以下场次存在阻断问题，需要立即处理：');
    lines.push('');
    
    for (const schedule of schedules) {
      const result = checkResults.get(schedule.scheduleId);
      if (!result || result.overallStatus !== CheckStatus.BLOCK) continue;
      
      const filmVersion = filmVersions.get(`${schedule.filmId}-${schedule.versionId}`);
      const auditorium = auditoriums.get(schedule.auditoriumId);
      const blockChecks = result.checks.filter(c => c.status === CheckStatus.BLOCK);
      
      lines.push(`#### 🎬 ${filmVersion?.filmTitle || schedule.filmId}`);
      lines.push('');
      lines.push(`- **影厅**: ${auditorium?.auditoriumName || schedule.auditoriumId}`);
      lines.push(`- **时间**: ${formatTime(schedule.showTime.start)} - ${formatTime(schedule.showTime.end)}`);
      lines.push(`- **阻断原因**: `);
      for (const check of blockChecks) {
        lines.push(`  - ${check.ruleName}: ${check.message}`);
      }
      lines.push('');
    }
  }

  lines.push('## 🎬 排片详情');
  lines.push('');

  for (const [auditoriumId, auditoriumSchedules] of schedulesByAuditorium) {
    const auditorium = auditoriums.get(auditoriumId);
    lines.push(`### 🎪 ${auditorium?.auditoriumName || `影厅 ${auditoriumId}`}`);
    lines.push('');
    
    if (auditorium && auditorium.status !== 'operational') {
      lines.push(`> ⚠️ 设备状态: ${auditorium.status}${auditorium.statusReason ? ` - ${auditorium.statusReason}` : ''}`);
      lines.push('');
    }
    
    lines.push('| 场次 | 影片 | 时间 | 状态 | 关键检查 |');
    lines.push('|------|------|------|------|----------|');
    
    for (const schedule of auditoriumSchedules) {
      const filmVersion = filmVersions.get(`${schedule.filmId}-${schedule.versionId}`);
      const result = checkResults.get(schedule.scheduleId);
      
      const timeRange = `${formatTime(schedule.showTime.start)} - ${formatTime(schedule.showTime.end)}`;
      const statusEmoji = result ? getStatusEmoji(result.overallStatus) : '❓';
      const statusText = result ? getStatusText(result.overallStatus) : '未检查';
      
      const keyIssues: string[] = [];
      if (result) {
        for (const check of result.checks) {
          if (check.status !== CheckStatus.PASS) {
            keyIssues.push(`${getStatusEmoji(check.status)} ${check.ruleName}`);
          }
        }
      }
      
      const keyIssuesStr = keyIssues.length > 0 ? keyIssues.join(', ') : '全部通过';
      
      lines.push(`| ${schedule.scheduleId.slice(0, 8)} | ${filmVersion?.filmTitle || schedule.filmId} | ${timeRange} | ${statusEmoji} ${statusText} | ${keyIssuesStr} |`);
    }
    lines.push('');
  }

  lines.push('## 🔑 KDM密钥状态');
  lines.push('');
  
  const kdmsByFilmVersion = new Map<string, KDM[]>();
  for (const kdm of kdms) {
    const key = `${kdm.filmId}-${kdm.versionId}`;
    if (!kdmsByFilmVersion.has(key)) {
      kdmsByFilmVersion.set(key, []);
    }
    kdmsByFilmVersion.get(key)!.push(kdm);
  }
  
  const now = new Date();
  const soonExpireThreshold = 24 * 60 * 60 * 1000;
  
  for (const [key, filmKdms] of kdmsByFilmVersion) {
    const filmVersion = filmVersions.get(key);
    const filmTitle = filmVersion?.filmTitle || key;
    
    lines.push(`### 🎥 ${filmTitle}`);
    lines.push('');
    lines.push('| KDM ID | 影厅 | 有效期开始 | 有效期结束 | 状态 |');
    lines.push('|--------|------|------------|------------|------|');
    
    for (const kdm of filmKdms) {
      const auditorium = auditoriums.get(kdm.auditoriumId);
      const startDate = new Date(kdm.validity.start);
      const endDate = new Date(kdm.validity.end);
      
      let status = '✅ 有效';
      if (endDate < now) {
        status = '❌ 已过期';
      } else if (endDate.getTime() - now.getTime() < soonExpireThreshold) {
        status = '⚠️ 即将过期';
      } else if (startDate > now) {
        status = '⏳ 未生效';
      }
      
      lines.push(`| ${kdm.kdmId} | ${auditorium?.auditoriumName || kdm.auditoriumId} | ${formatDate(kdm.validity.start)} | ${formatDate(kdm.validity.end)} | ${status} |`);
    }
    lines.push('');
  }

  lines.push('## 📝 详细检查报告');
  lines.push('');

  for (const schedule of schedules) {
    const filmVersion = filmVersions.get(`${schedule.filmId}-${schedule.versionId}`);
    const auditorium = auditoriums.get(schedule.auditoriumId);
    const result = checkResults.get(schedule.scheduleId);
    const latestCheck = latestChecks.get(schedule.scheduleId);
    
    if (!result) continue;
    
    lines.push(`### ${getStatusEmoji(result.overallStatus)} ${filmVersion?.filmTitle || schedule.filmId}`);
    lines.push('');
    lines.push(`- **场次ID**: ${schedule.scheduleId}`);
    lines.push(`- **影厅**: ${auditorium?.auditoriumName || schedule.auditoriumId}`);
    lines.push(`- **时间**: ${formatDateTime(schedule.showTime.start)} - ${formatDateTime(schedule.showTime.end)}`);
    lines.push(`- **影片版本**: ${filmVersion?.versionName || schedule.versionId}`);
    lines.push(`- **整体状态**: ${getStatusEmoji(result.overallStatus)} ${getStatusText(result.overallStatus)}`);
    if (latestCheck) {
      lines.push(`- **最后检查时间**: ${formatDateTime(latestCheck.createdAt)}`);
    }
    lines.push('');
    
    lines.push('#### 检查项详情');
    lines.push('');
    lines.push('| 检查项 | 状态 | 说明 |');
    lines.push('|--------|------|------|');
    
    for (const check of result.checks) {
      lines.push(`| ${check.ruleName} | ${getStatusEmoji(check.status)} ${getStatusText(check.status)} | ${check.message} |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('> 本报告由「影厅密钥排片卫士」系统自动生成');
  lines.push(`> 生成时间: ${formatDateTime(generatedAt)}`);

  return lines.join('\n');
}
