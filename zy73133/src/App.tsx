import { Loader2 } from 'lucide-react';
import TopBar from '@/components/TopBar';
import StationList from '@/components/StationList';
import DetailPanel from '@/components/DetailPanel';
import StatusBar from '@/components/StatusBar';
import VerifyModal from '@/components/VerifyModal';
import Scene3D from '@/components/three/Scene3D';
import { useTidalStore } from '@/store/useTidalStore';

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm
      flex items-center justify-center pointer-events-auto">
      <div className="panel flex items-center gap-3 px-6 py-4">
        <Loader2 size={20} className="text-glow-cyan animate-spin" />
        <div className="font-mono text-[13px] text-console-text tracking-wider">
          处理中，请稍候...
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { loading, verify_result, clearVerify } = useTidalStore();

  return (
    <div className="h-screen w-screen grid grid-rows-[56px_1fr_32px] overflow-hidden radial-bg">
      {/* 顶栏 */}
      <TopBar />

      {/* 中间三栏 */}
      <main className="grid grid-cols-[280px_1fr_420px] min-h-0 overflow-hidden">
        <StationList />
        <Scene3D />
        <DetailPanel />
      </main>

      {/* 底栏 */}
      <StatusBar />

      {/* 加载遮罩 */}
      {loading && <LoadingOverlay />}

      {/* 验证报告弹窗 */}
      {verify_result && (
        <VerifyModal result={verify_result} onClose={clearVerify} />
      )}
    </div>
  );
}
