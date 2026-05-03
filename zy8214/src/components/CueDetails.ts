import { AppState, Channel } from '../types';

export function renderCueDetails(state: AppState): string {
  const { cues, timeline, activeChannelValues, fixtures } = state;
  
  const selectedCue = timeline.selectedCueId 
    ? cues.find((c) => c.id === timeline.selectedCueId)
    : null;

  if (!selectedCue) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">🎯</div>
        <div class="empty-state-text">点击时间轴上的 Cue 查看详情</div>
      </div>
    `;
  }

  const cueEndTime = selectedCue.startTime + selectedCue.duration + selectedCue.fadeOut;

  const allChannels: Map<string, { channel: Channel; fixtureName: string }> = new Map();
  fixtures.forEach((fixture) => {
    fixture.channels.forEach((channel) => {
      allChannels.set(channel.id, { channel, fixtureName: fixture.name });
    });
  });

  return `
    <div class="cue-details">
      <div class="cue-info">
        <div class="info-item">
          <div class="info-label">Cue 编号</div>
          <div class="info-value">${selectedCue.number}</div>
        </div>
        <div class="info-item">
          <div class="info-label">开始时间</div>
          <div class="info-value">${formatTime(selectedCue.startTime)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">淡入</div>
          <div class="info-value">${selectedCue.fadeIn}s</div>
        </div>
        <div class="info-item">
          <div class="info-label">淡出</div>
          <div class="info-value">${selectedCue.fadeOut}s</div>
        </div>
        <div class="info-item">
          <div class="info-label">持续时间</div>
          <div class="info-value">${selectedCue.duration}s</div>
        </div>
        <div class="info-item">
          <div class="info-label">结束时间</div>
          <div class="info-value">${formatTime(cueEndTime)}</div>
        </div>
      </div>
      
      ${selectedCue.notes ? `
        <div class="info-item" style="grid-column: 1 / -1;">
          <div class="info-label">备注</div>
          <div class="info-value" style="font-weight: normal; font-size: 0.875rem;">${selectedCue.notes}</div>
        </div>
      ` : ''}

      <div class="channel-values">
        <h4>通道值 (${selectedCue.channelValues.length} 个)</h4>
        ${selectedCue.channelValues.length > 0 ? `
          ${selectedCue.channelValues.map((cv) => {
            const channelInfo = allChannels.get(cv.channelId);
            const activeValue = activeChannelValues.get(cv.channelId);
            const displayValue = activeValue !== undefined ? activeValue : cv.value;
            
            return `
              <div class="channel-item">
                <div class="channel-name">
                  ${channelInfo ? `${channelInfo.fixtureName} - ${channelInfo.channel.name}` : cv.channelId}
                </div>
                <div class="channel-bar">
                  <div class="channel-bar-fill" style="width: ${(displayValue / 255) * 100}%;"></div>
                </div>
                <div class="channel-value">${displayValue}</div>
              </div>
            `;
          }).join('')}
        ` : `
          <div class="empty-state" style="padding: 24px;">
            <div class="empty-state-text">此 Cue 没有配置通道值</div>
          </div>
        `}
      </div>
    </div>
  `;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}
