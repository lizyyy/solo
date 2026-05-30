class HistoryPanel {
  constructor(containerEl) {
    this.el = containerEl;
  }

  render(entries) {
    if (entries.length === 0) {
      this.el.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:4px;">暂无调整记录</div>';
      return;
    }
    this.el.innerHTML = entries.slice().reverse().map(e => {
      const time = new Date(e.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      let desc = '';
      switch (e.type) {
        case 'member-move':
          desc = `🎤 ${e.objectName} 移至 (${e.newPosition.x.toFixed(1)}, ${e.newPosition.z.toFixed(1)})`;
          break;
        case 'mic-move':
          desc = `🎙️ ${e.objectName} 移至 (${e.newPosition.x.toFixed(1)}, ${e.newPosition.z.toFixed(1)})`;
          break;
        case 'member-remove':
          desc = `🗑️ 移除成员 ${e.objectName}`;
          break;
        case 'mic-remove':
          desc = `🗑️ 移除麦克风 ${e.objectName}`;
          break;
        default:
          desc = e.type;
      }
      return `<div class="history-item">
        <span class="history-time">${time}</span>
        <span class="history-desc">${desc}</span>
      </div>`;
    }).join('');
  }
}

export { HistoryPanel };
