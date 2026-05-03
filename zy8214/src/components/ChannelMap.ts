import { AppState, Channel } from '../types';

export function renderChannelMap(state: AppState): string {
  const { fixtures, activeChannelValues, risks } = state;

  const allChannels: Channel[] = [];
  fixtures.forEach((fixture) => {
    fixture.channels.forEach((channel) => {
      allChannels.push(channel);
    });
  });

  if (allChannels.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">🎛️</div>
        <div class="empty-state-text">暂无通道数据</div>
      </div>
    `;
  }

  const maxAddress = Math.max(...allChannels.map((c) => c.dmxAddress));
  const totalSlots = Math.ceil(maxAddress / 16) * 16;

  const channelMap = new Map<number, { channel: Channel; fixtureName: string; value?: number }[]>();
  
  allChannels.forEach((channel) => {
    const fixture = fixtures.find((f) => f.id === channel.fixtureId);
    const value = activeChannelValues.get(channel.id);
    
    if (!channelMap.has(channel.dmxAddress)) {
      channelMap.set(channel.dmxAddress, []);
    }
    
    channelMap.get(channel.dmxAddress)?.push({
      channel,
      fixtureName: fixture?.name || '未知灯具',
      value
    });
  });

  const conflictAddresses = new Set<number>();
  risks
    .filter((r) => r.type === 'channel_conflict')
    .forEach((r) => {
      if (r.details.dmxAddress) {
        conflictAddresses.add(Number(r.details.dmxAddress));
      }
    });

  return `
    <div style="padding-bottom: 16px;">
      <div style="display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 16px; height: 16px; background: var(--bg-tertiary); border-radius: 4px;"></div>
          <span style="font-size: 0.75rem; color: var(--text-secondary);">空闲</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 16px; height: 16px; background: var(--primary-color); border-radius: 4px;"></div>
          <span style="font-size: 0.75rem; color: var(--text-secondary);">占用</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 16px; height: 16px; background: var(--danger-color); border-radius: 4px;"></div>
          <span style="font-size: 0.75rem; color: var(--text-secondary);">冲突</span>
        </div>
      </div>
      
      <div class="channel-map">
        ${Array.from({ length: totalSlots }, (_, i) => {
          const address = i + 1;
          const channelsAtAddress = channelMap.get(address) || [];
          const hasConflict = conflictAddresses.has(address);
          const isOccupied = channelsAtAddress.length > 0;
          
          let title = `DMX ${address}`;
          if (channelsAtAddress.length > 0) {
            title = `DMX ${address}: ${channelsAtAddress.map((c) => `${c.fixtureName} - ${c.channel.name}`).join(', ')}`;
          }
          
          let className = 'channel-map-item';
          if (hasConflict) {
            className += ' conflict';
          } else if (isOccupied) {
            className += ' occupied';
          }
          
          const displayValue = channelsAtAddress.length > 0 && channelsAtAddress[0].value !== undefined
            ? channelsAtAddress[0].value
            : null;
          
          return `
            <div class="${className}" title="${title}">
              <div style="font-size: 0.65rem;">${address}</div>
              ${displayValue !== null ? `<div style="font-size: 0.55rem; opacity: 0.7;">${displayValue}</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
      
      <div style="margin-top: 24px;">
        <h4 style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 12px;">通道列表</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${allChannels.slice(0, 20).map((channel) => {
            const fixture = fixtures.find((f) => f.id === channel.fixtureId);
            const value = activeChannelValues.get(channel.id);
            
            return `
              <div class="channel-item">
                <div class="channel-name">
                  <div style="font-weight: 500;">${fixture?.name || '未知'}</div>
                  <div style="font-size: 0.75rem; color: var(--text-secondary);">
                    ${channel.name} (DMX ${channel.dmxAddress})
                  </div>
                </div>
                <div class="channel-bar">
                  <div class="channel-bar-fill" style="width: ${value !== undefined ? (value / 255) * 100 : 0}%;"></div>
                </div>
                <div class="channel-value">${value ?? '-'}</div>
              </div>
            `;
          }).join('')}
          ${allChannels.length > 20 ? `
            <div style="text-align: center; padding: 8px; color: var(--text-secondary); font-size: 0.75rem;">
              还有 ${allChannels.length - 20} 个通道...
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}
