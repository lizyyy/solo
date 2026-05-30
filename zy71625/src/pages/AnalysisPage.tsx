import { Link } from 'react-router-dom';
import { ErrorStats } from '../components/analysis/ErrorStats';
import { Home, ArrowLeft } from 'lucide-react';

export const AnalysisPage = () => {
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              to="/game"
              className="p-2 rounded-lg bg-[#1a1a1a] border border-[#D4A574]/30 text-[#D4A574] hover:bg-[#2a2a2a] transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <Link
              to="/"
              className="p-2 rounded-lg bg-[#1a1a1a] border border-[#D4A574]/30 text-[#D4A574] hover:bg-[#2a2a2a] transition-colors"
            >
              <Home size={20} />
            </Link>
            <div>
              <h1 className="text-2xl text-[#D4A574] font-serif">错因分析</h1>
              <p className="text-white/50 text-sm">独立统计三类错误，找出改进方向</p>
            </div>
          </div>
        </div>

        <ErrorStats />

        <div className="mt-8 grid grid-cols-3 gap-6">
          <div className="bg-[#1a1a1a] rounded-xl border border-red-500/30 p-6">
            <h3 className="text-red-400 font-serif text-lg mb-4">划痕误判</h3>
            <p className="text-white/60 text-sm mb-4">
              将假阳性标记判断为真实划痕，或将真实划痕判断为假阳性。
            </p>
            <div className="text-xs text-white/40 space-y-1">
              <p>• 误判会导致不必要的清洗操作</p>
              <p>• 漏判会导致划痕未被修复</p>
              <p>• 严重程度判断错误会影响清洗剂量选择</p>
            </div>
          </div>

          <div className="bg-[#1a1a1a] rounded-xl border border-yellow-500/30 p-6">
            <h3 className="text-yellow-400 font-serif text-lg mb-4">清洗过度</h3>
            <p className="text-white/60 text-sm mb-4">
              清洗剂使用剂量超过推荐范围，或清洗剂类型与划痕类型不匹配。
            </p>
            <div className="text-xs text-white/40 space-y-1">
              <p>• 过度清洗可能损坏黑胶盘表面</p>
              <p>• 造成库存不必要的消耗</p>
              <p>• 碱性清洗剂不适合油脂类污渍</p>
            </div>
          </div>

          <div className="bg-[#1a1a1a] rounded-xl border border-blue-500/30 p-6">
            <h3 className="text-blue-400 font-serif text-lg mb-4">试听漏记录</h3>
            <p className="text-white/60 text-sm mb-4">
              试听时未完整记录噪声类型，或音质评分与实际情况不符。
            </p>
            <div className="text-xs text-white/40 space-y-1">
              <p>• 漏记的噪声无法被正确处理</p>
              <p>• 评分过高会导致修复报告失真</p>
              <p>• 影响后续修复质量评估</p>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-[#1a1a1a] rounded-xl border border-[#D4A574]/30 p-6">
          <h3 className="text-[#D4A574] font-serif text-lg mb-4">数据来源说明</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs">系统数据</span>
              </div>
              <p className="text-white/50 text-sm">
                系统自动记录的数据，包括：
              </p>
              <ul className="text-white/40 text-xs mt-2 space-y-1">
                <li>• 黑胶盘基本信息（标题、艺术家、年代）</li>
                <li>• 划痕位置、角度、长度等测量数据</li>
                <li>• 噪声频率、振幅、时长等分析数据</li>
                <li>• 清洗剂使用剂量、库存变化</li>
                <li>• 操作时间戳、步骤顺序</li>
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs">人工备注</span>
              </div>
              <p className="text-white/50 text-sm">
                玩家手动输入的数据，包括：
              </p>
              <ul className="text-white/40 text-xs mt-2 space-y-1">
                <li>• 划痕严重程度判断</li>
                <li>• 噪声类型分析备注</li>
                <li>• 清洗操作备注说明</li>
                <li>• 试听主观评价</li>
                <li>• 修复报告总结</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
