import type { Scene, Prop, PropAppearance, ContinuityIssue, ConfirmedIssue } from '../types';

interface TimelineProps {
  scenes: Scene[];
  props: Prop[];
  appearances: PropAppearance[];
  issues: ContinuityIssue[];
  confirmedIssues: ConfirmedIssue[];
}

export function renderTimeline(props: TimelineProps): string {
  const { scenes, props: allProps, appearances, issues, confirmedIssues } = props;

  const sortedScenes = [...scenes].sort((a, b) => 
    new Date(a.plannedShootDate).getTime() - new Date(b.plannedShootDate).getTime()
  );

  const confirmedIssueIds = new Set(confirmedIssues.map(ci => ci.issueId));

  let html = '<div class="timeline-container">';
  html += '<h2 class="timeline-title">场次时间线</h2>';
  html += '<div class="timeline-scenes">';

  for (const scene of sortedScenes) {
    const sceneAppearances = appearances.filter(a => a.sceneId === scene.id);
    const sceneProps = sceneAppearances.map(a => 
      allProps.find(p => p.id === a.propId)
    ).filter(Boolean) as Prop[];

    const sceneIssues = issues.filter(
      i => i.sceneId === scene.id || 
           (i.propId && sceneAppearances.some(a => a.propId === i.propId))
    );

    const hasIssues = sceneIssues.some(i => !confirmedIssueIds.has(i.id));
    const issueCount = sceneIssues.filter(i => !confirmedIssueIds.has(i.id)).length;
    const criticalCount = sceneIssues.filter(i => i.severity === 'critical' && !confirmedIssueIds.has(i.id)).length;

    html += '<div class="timeline-scene ' + (hasIssues ? 'has-issues' : '') + '" data-scene-id="' + scene.id + '">';
    html += '<div class="scene-header">';
    html += '<div class="scene-number">' + scene.sceneNumber + '</div>';
    html += '<div class="scene-info">';
    html += '<div class="scene-description">' + scene.description + '</div>';
    html += '<div class="scene-meta">';
    html += '<span class="scene-location">' + scene.location + '</span>';
    html += '<span class="scene-time">' + scene.timeOfDay + '</span>';
    html += '<span class="scene-date">' + scene.plannedShootDate + '</span>';
    html += '</div></div>';
    
    if (hasIssues) {
      html += '<div class="scene-issues-badge">';
      html += '<span class="issue-count ' + (criticalCount > 0 ? 'critical' : 'warning') + '">';
      html += issueCount + ' 个问题';
      html += '</span></div>';
    }
    
    html += '</div>';
    html += '<div class="scene-props">';
    html += '<div class="props-label">道具 (' + sceneProps.length + '):</div>';
    html += '<div class="props-list">';

    for (const prop of sceneProps) {
      const appearance = sceneAppearances.find(a => a.propId === prop.id);
      const propIssues = issues.filter(
        i => i.propId === prop.id && 
             (i.sceneId === scene.id || !i.sceneId) &&
             !confirmedIssueIds.has(i.id)
      );
      const hasPropIssues = propIssues.length > 0;

      html += '<div class="prop-item ' + (hasPropIssues ? 'has-issues' : '') + '" data-prop-id="' + prop.id + '">';
      html += '<div class="prop-photo-placeholder">';
      html += '<div class="photo-icon">📷</div>';
      html += '</div>';
      html += '<div class="prop-details">';
      html += '<div class="prop-name">' + prop.name + '</div>';
      html += '<div class="prop-number">#' + prop.propNumber + '</div>';
      
      if (appearance) {
        html += '<div class="prop-state">状态: ' + appearance.state + '</div>';
        html += '<div class="prop-position">位置: ' + appearance.position + '</div>';
      }
      
      html += '<div class="prop-responsible">负责人: ' + (prop.responsiblePerson || '未指定') + '</div>';
      html += '</div>';
      
      if (hasPropIssues) {
        html += '<div class="prop-issues-indicator">';
        for (const i of propIssues) {
          html += '<span class="issue-dot ' + i.severity + '" title="' + i.description + '"></span>';
        }
        html += '</div>';
      }
      
      html += '</div>';
    }

    if (sceneProps.length === 0) {
      html += '<div class="no-props">本场次无道具</div>';
    }

    html += '</div></div></div>';
  }

  html += '</div></div>';

  return html;
}

export function renderIssuesList(
  issues: ContinuityIssue[],
  confirmedIssues: ConfirmedIssue[]
): string {
  const confirmedIssueIds = new Set(confirmedIssues.map(ci => ci.issueId));
  const unconfirmedIssues = issues.filter(i => !confirmedIssueIds.has(i.id));
  const confirmedIssuesList = issues.filter(i => confirmedIssueIds.has(i.id));

  let html = '<div class="issues-container">';
  html += '<div class="issues-header">';
  html += '<h2>连续性问题</h2>';
  html += '<div class="issues-summary">';
  html += '<span class="critical-count">严重: ' + unconfirmedIssues.filter(i => i.severity === 'critical').length + '</span>';
  html += '<span class="warning-count">警告: ' + unconfirmedIssues.filter(i => i.severity === 'warning').length + '</span>';
  html += '<span class="info-count">信息: ' + unconfirmedIssues.filter(i => i.severity === 'info').length + '</span>';
  html += '</div></div>';

  if (unconfirmedIssues.length > 0) {
    html += '<div class="issues-section">';
    html += '<h3>待确认问题 (' + unconfirmedIssues.length + ')</h3>';
    html += '<div class="issues-list">';

    for (const issue of unconfirmedIssues) {
      html += renderIssueCard(issue, false);
    }

    html += '</div></div>';
  }

  if (confirmedIssuesList.length > 0) {
    html += '<div class="issues-section">';
    html += '<h3>已确认问题 (' + confirmedIssuesList.length + ')</h3>';
    html += '<div class="issues-list">';

    for (const issue of confirmedIssuesList) {
      html += renderIssueCard(issue, true);
    }

    html += '</div></div>';
  }

  if (unconfirmedIssues.length === 0 && confirmedIssuesList.length === 0) {
    html += '<div class="no-issues">';
    html += '<div class="no-issues-icon">✅</div>';
    html += '<div class="no-issues-text">未发现连续性问题</div>';
    html += '</div>';
  }

  html += '</div>';

  return html;
}

function renderIssueCard(
  issue: ContinuityIssue,
  isConfirmed: boolean
): string {
  const severityText = issue.severity === 'critical' ? '严重' : issue.severity === 'warning' ? '警告' : '信息';
  
  let html = '<div class="issue-card ' + issue.severity + ' ' + (isConfirmed ? 'confirmed' : '') + '" data-issue-id="' + issue.id + '">';
  html += '<div class="issue-header">';
  html += '<span class="issue-severity-badge ' + issue.severity + '">';
  html += severityText;
  html += '</span>';
  html += '<span class="issue-rule">' + issue.ruleName + '</span>';
  html += '</div>';
  html += '<div class="issue-description">' + issue.description + '</div>';
  html += '<div class="issue-meta">';
  
  if (issue.propName) {
    html += '<span class="issue-prop">道具: ' + issue.propName + '</span>';
  }
  if (issue.sceneNumber) {
    html += '<span class="issue-scene">场景: ' + issue.sceneNumber + '</span>';
  }
  
  html += '</div>';
  html += '<div class="issue-actions">';
  
  if (!isConfirmed) {
    html += '<button class="action-btn confirm-issue ' + issue.severity + '" data-issue-id="' + issue.id + '">';
    html += '标记已确认';
    html += '</button>';
  } else {
    html += '<span class="confirmed-badge">✓ 已确认</span>';
  }
  
  html += '</div></div>';

  return html;
}
