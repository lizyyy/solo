import { subscribe, getState } from '../store/gameStore';
import { initImportPanel } from './ImportPanel';
import { renderReviewPanel } from './ReviewPanel';
import { renderCorrectPanel } from './CorrectPanel';
import { renderHistoryPanel } from './HistoryPanel';
import { renderExportPanel } from './ExportPanel';

let lastReportId: string | null = null;
let lastReportVersion = 0;

export function initPanels(): void {
  initImportPanel();

  renderAllPanels(true);
  renderHistoryPanel();
  renderExportPanel();

  subscribe(() => {
    renderAllPanels(false);
  });
}

function renderAllPanels(isInit: boolean): void {
  const { currentReport, activePanel } = getState();

  const reportChanged = currentReport?.id !== lastReportId || (currentReport?.version ?? 0) !== lastReportVersion;

  if (reportChanged || isInit) {
    lastReportId = currentReport?.id ?? null;
    lastReportVersion = currentReport?.version ?? 0;
    renderReviewPanel(currentReport);
    if (activePanel !== 'correct') {
      renderCorrectPanel(currentReport);
    }
  }

  if (activePanel === 'history') {
    renderHistoryPanel();
  }
  if (activePanel === 'export') {
    renderExportPanel();
  }
  if (activePanel === 'correct' && (reportChanged || isInit)) {
    renderCorrectPanel(currentReport);
  }

  document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel-section').forEach(s => s.classList.remove('active'));
  const activeTab = document.querySelector(`.panel-tab[data-panel="${activePanel}"]`);
  const activeSection = document.getElementById(`panel-${activePanel}`);
  if (activeTab) activeTab.classList.add('active');
  if (activeSection) activeSection.classList.add('active');
}
