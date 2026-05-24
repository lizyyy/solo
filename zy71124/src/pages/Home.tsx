import ControlPanel from '../components/ControlPanel/ControlPanel';
import InfoPanel from '../components/InfoPanel/InfoPanel';
import Timeline from '../components/Timeline/Timeline';
import Scene3D from '../components/Scene3D/Scene3D';
import ReportModal from '../components/ReportModal/ReportModal';

export default function Home() {
  return (
    <div className="h-screen w-screen bg-gray-950 flex flex-col overflow-hidden">
      <header className="h-12 bg-gray-900 border-b border-gray-700 flex items-center px-4 justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM19 17H5v-4.66l.12-.34H19l.12.34V17zM7.5 16c.83 0 1.5-.67 1.5-1.5S8.33 13 7.5 13 6 13.67 6 14.5 6.67 16 7.5 16zm9 0c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5z"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold text-white">校车停车场发车调度系统</h1>
        </div>
        <div className="text-sm text-gray-400">
          3D可视化调度模拟
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <ControlPanel />
        
        <main className="flex-1 relative flex flex-col min-w-0">
          <div className="flex-1 min-h-0">
            <Scene3D />
          </div>
          <Timeline />
        </main>

        <InfoPanel />
      </div>

      <ReportModal />
    </div>
  );
}
