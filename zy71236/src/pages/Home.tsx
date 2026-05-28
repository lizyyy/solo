import { useState } from 'react';
import { Header } from '../components/layout/Header';
import { Workspace } from '../components/layout/Workspace';
import { Sidebar } from '../components/layout/Sidebar';
import { ReportPage } from '../components/report/ReportPage';
import { WarningNotifications } from '../components/presets/WarningNotifications';
import { useSynthStore } from '../store/useSynthStore';
import { ReportData } from '../types/synth';

export function Home() {
  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const { generateReport } = useSynthStore();

  const handleGenerateReport = () => {
    const report = generateReport();
    setReportData(report);
    setShowReport(true);
  };

  const handleBackFromReport = () => {
    setShowReport(false);
    setReportData(null);
  };

  if (showReport && reportData) {
    return <ReportPage report={reportData} onBack={handleBackFromReport} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <div
        className="fixed inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: `
            repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,240,255,0.03) 2px, rgba(0,240,255,0.03) 4px),
            repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,0,170,0.03) 2px, rgba(255,0,170,0.03) 4px)
          `,
        }}
      />

      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(0,240,255,0.08) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(255,0,170,0.06) 0%, transparent 50%)',
        }}
      />

      <div className="relative z-10 flex flex-col h-screen overflow-hidden">
        <Header onGenerateReport={handleGenerateReport} />

        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700">
            <Workspace />
          </main>
          <Sidebar />
        </div>
      </div>

      <WarningNotifications />

      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-10"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.1) 1px, rgba(0,0,0,0.1) 2px)',
        }}
      />
    </div>
  );
}
