document.addEventListener('DOMContentLoaded', () => {
  seedSampleData();

  bindGlobalEvents();

  UI.render('tasks');
});

function bindGlobalEvents() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      UI.render(tab.dataset.tab);
    });
  });

  document.getElementById('btn-create-facility')?.addEventListener('click', () => {
    const modal = openModal(UI.renderCreateFacilityForm(), '新建设施');
    UI.bindCreateFacilityForm(modal);
  });

  document.getElementById('btn-import')?.addEventListener('click', () => {
    const modal = openModal(UI.renderImportForm(), '导入数据');
    UI.bindImportForm(modal);
  });

  document.getElementById('btn-export')?.addEventListener('click', () => {
    const data = DataStore.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skatepark_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('数据已导出', 'success');
  });

  document.getElementById('btn-rules')?.addEventListener('click', () => {
    const modal = openModal(UI.renderRulesVerification(), '规则验证面板');
    UI.bindRulesVerification(modal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const container = document.getElementById('modal-container');
      if (container) container.innerHTML = '';
    }
  });
}
