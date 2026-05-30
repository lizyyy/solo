
import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { NetworkGraph } from '../components/ThreeDScene/NetworkGraph';
import { WalletDetail } from '../components/SidePanel/WalletDetail';
import { ForceParamsPanel } from '../components/ControlPanel/ForceParams';
import { FilterOptionsPanel } from '../components/ControlPanel/FilterOptions';
import { TimelinePlayer } from '../components/ControlPanel/TimelinePlayer';
import { useAppStore } from '../store/useAppStore';
import { generateCSVReport, generatePDFReport } from '../utils/exportReport';
import { ChevronLeft, ChevronRight, Download, FileText, BarChart3, Network } from 'lucide-react';

export default function Home() {
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [activeLeftTab, setActiveLeftTab] = useState<'params' | 'filter'>('params');

  const wallets = useAppStore((state) => state.wallets);
  const allTransactions = useAppStore((state) => state.transactions);
  const filterOptions = useAppStore((state) => state.filterOptions);
  const timeRange = useAppStore((state) => state.timeRange);
  const currentTime = useAppStore((state) => state.currentTime);
  const selectedWalletId = useAppStore((state) => state.selectedWalletId);
  const highlightedPath = useAppStore((state) => state.highlightedPath);
  const forceParams = useAppStore((state) => state.forceParams);
  const setSelectedWallet = useAppStore((state) => state.setSelectedWallet);

  const transactions = allTransactions.filter((tx) => {
    const wallet = wallets.find((w) => w.id === tx.from || w.id === tx.to);
    if (!wallet) return false;
    const walletStatus = wallet.status;

    if (tx.amount < filterOptions.minAmount) return false;
    if (!filterOptions.selectedTokens.includes(tx.token)) return false;
    if (tx.timestamp < timeRange[0] || tx.timestamp > currentTime) return false;

    const statusMap = {
      normal: filterOptions.showNormal,
      warning: filterOptions.showWarning,
      anomaly: filterOptions.showAnomaly,
      pending: filterOptions.showPending,
      rejected: filterOptions.showAnomaly,
    };

    return statusMap[walletStatus] !== false;
  });

  const selectedWallet = wallets.find((w) => w.id === selectedWalletId);

  const handleExportCSV = () => {
    generateCSVReport(wallets, transactions);
  };

  const handleExportPDF = () => {
    generatePDFReport(wallets, transactions, selectedWalletId);
  };

  const anomalyCount = transactions.filter((t) => t.isAnomaly).length;
  const totalVolume = transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="h-screen w-screen bg-[#0a1628] flex overflow-hidden">
      <div
        className={`h-full bg-slate-900/90 border-r border-slate-700/50 flex flex-col transition-all duration-300 ${
          leftPanelOpen ? 'w-72' : 'w-0'
        } overflow-hidden`}
      >
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2 mb-3">
            <Network size={20} className="text-indigo-400" />
            <h1 className="text-white font-bold text-lg">链上资金流星云</h1>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-800/50 rounded-lg p-2">
              <div className="text-slate-400 text-xs">总金额</div>
              <div className="text-emerald-400 font-bold text-sm">
                ${(totalVolume / 1000000).toFixed(2)}M
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2">
              <div className="text-slate-400 text-xs">异常交易</div>
              <div className="text-red-400 font-bold text-sm">{anomalyCount}</div>
            </div>
          </div>
        </div>

        <div className="flex border-b border-slate-700/50">
          <button
            onClick={() => setActiveLeftTab('params')}
            className={`flex-1 px-4 py-2 text-sm transition-colors ${
              activeLeftTab === 'params'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <BarChart3 size={14} className="inline mr-1" />
            参数
          </button>
          <button
            onClick={() => setActiveLeftTab('filter')}
            className={`flex-1 px-4 py-2 text-sm transition-colors ${
              activeLeftTab === 'filter'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <FileText size={14} className="inline mr-1" />
            筛选
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeLeftTab === 'params' ? <ForceParamsPanel /> : <FilterOptionsPanel />}
        </div>

        <TimelinePlayer />

        <div className="p-3 border-t border-slate-700/50">
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-600 transition-colors"
            >
              <Download size={14} />
              CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-500 transition-colors"
            >
              <FileText size={14} />
              报告
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={() => setLeftPanelOpen(!leftPanelOpen)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 rounded-r transition-all"
        style={{ left: leftPanelOpen ? '288px' : '0' }}
      >
        {leftPanelOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>

      <div className="flex-1 relative">
        <Canvas
          camera={{ position: [0, 0, 200], fov: 60 }}
          gl={{ antialias: true, alpha: false }}
          style={{ background: '#0a1628' }}
        >
          <color attach="background" args={['#0a1628']} />
          <NetworkGraph
            wallets={wallets}
            transactions={transactions}
            forceParams={forceParams}
            selectedWalletId={selectedWalletId}
            highlightedPath={highlightedPath}
            onWalletSelect={setSelectedWallet}
          />
        </Canvas>

        <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-700/50">
          <div className="text-slate-400 text-xs">节点/连线</div>
          <div className="text-white font-mono text-sm">
            {wallets.length} / {transactions.length}
          </div>
        </div>

        <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-700/50">
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-slate-400">正常</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-slate-400">警告</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-slate-400">异常</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-slate-400">待审</span>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setRightPanelOpen(!rightPanelOpen)}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 rounded-l transition-all"
        style={{ right: rightPanelOpen ? '320px' : '0' }}
      >
        {rightPanelOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      <div
        className={`h-full bg-slate-900/90 border-l border-slate-700/50 flex flex-col transition-all duration-300 ${
          rightPanelOpen ? 'w-80' : 'w-0'
        } overflow-hidden`}
      >
        {selectedWallet ? (
          <WalletDetail wallet={selectedWallet} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-6">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
              <Network size={28} className="text-slate-600" />
            </div>
            <p className="text-center text-sm">
              点击3D网络中的节点<br />查看钱包详情
            </p>
            <div className="mt-6 w-full">
              <div className="text-slate-400 text-xs mb-2">快捷统计</div>
              <div className="space-y-2">
                <div className="flex justify-between p-2 bg-slate-800/50 rounded">
                  <span className="text-slate-400 text-xs">钱包地址</span>
                  <span className="text-white text-xs">{wallets.length}</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-800/50 rounded">
                  <span className="text-slate-400 text-xs">交易记录</span>
                  <span className="text-white text-xs">{transactions.length}</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-800/50 rounded">
                  <span className="text-slate-400 text-xs">异常率</span>
                  <span className="text-red-400 text-xs">
                    {((anomalyCount / transactions.length) * 100 || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
