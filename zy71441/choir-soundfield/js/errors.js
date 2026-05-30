class ErrorPanel {
  constructor(containerEl) {
    this.el = containerEl;
  }

  render(errors) {
    if (errors.length === 0) {
      this.el.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:4px;">✅ 未检测到问题</div>';
      return;
    }
    this.el.innerHTML = errors.slice().reverse().map(e => {
      const levelClass = e.level === 'error' ? 'error' : e.level === 'warning' ? 'warning' : 'info';
      const icon = e.level === 'error' ? '🔴' : e.level === 'warning' ? '🟡' : 'ℹ️';
      let sourceInfo = '';
      if (e.source) {
        sourceInfo = `<span class="error-source">来源: ${e.source}`;
        if (e.rawLine) sourceInfo += ` | ${e.rawLine}`;
        if (e.objectId) sourceInfo += ` | 对象: ${e.objectId}`;
        sourceInfo += '</span>';
      }
      return `<div class="error-item ${levelClass}" role="alert">
        ${icon} ${e.message}${sourceInfo}
      </div>`;
    }).join('');
  }
}

export { ErrorPanel };
