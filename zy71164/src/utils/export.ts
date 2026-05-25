import type { ExportReport, GameState } from '@/types/game';

export const downloadJSON = (data: unknown, filename: string): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const generateExportFilename = (gameState: GameState | null): string => {
  if (!gameState) {
    return `sonar_report_${Date.now()}.json`;
  }

  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10);
  const level = gameState.level.id;
  const result = gameState.gameStatus === 'victory' ? 'win' : 'lose';
  const score = gameState.score;

  return `sonar_${level}_${result}_${score}_${dateStr}.json`;
};

export const exportGameReport = (report: ExportReport): void => {
  const filename = generateExportFilename(report.finalGameState);
  downloadJSON(report, filename);
};

export const validateExportReport = (report: unknown): report is ExportReport => {
  if (typeof report !== 'object' || report === null) return false;

  const r = report as Record<string, unknown>;

  if (typeof r.version !== 'string') return false;
  if (typeof r.exportTime !== 'number') return false;
  if (r.gameResult !== 'victory' && r.gameResult !== 'defeat') return false;
  if (typeof r.finalScore !== 'number') return false;
  if (typeof r.levelInfo !== 'object' || r.levelInfo === null) return false;
  if (typeof r.statistics !== 'object' || r.statistics === null) return false;
  if (typeof r.scoreBreakdown !== 'object' || r.scoreBreakdown === null) return false;
  if (!Array.isArray(r.timeline)) return false;
  if (typeof r.finalGameState !== 'object' || r.finalGameState === null) return false;

  return true;
};

export const importGameReport = (file: File): Promise<ExportReport> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (validateExportReport(data)) {
          resolve(data);
        } else {
          reject(new Error('Invalid report format'));
        }
      } catch (err) {
        reject(new Error('Failed to parse JSON'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
