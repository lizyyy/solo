import { Link } from 'react-router-dom';
import { Timeline } from '../components/timeline/Timeline';
import { Home, ArrowLeft } from 'lucide-react';

export const TimelinePage = () => {
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
              <h1 className="text-2xl text-[#D4A574] font-serif">操作时间轴</h1>
              <p className="text-white/50 text-sm">回放修复全过程，支持多维度筛选</p>
            </div>
          </div>
        </div>

        <Timeline />

        <div className="mt-8 bg-[#1a1a1a] rounded-xl border border-[#D4A574]/30 p-6">
          <h3 className="text-[#D4A574] font-serif text-lg mb-4">使用说明</h3>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-white/80 mb-2">回放控制</p>
              <ul className="text-white/50 text-xs space-y-2">
                <li>• <strong>播放/暂停</strong>：自动播放整个修复流程</li>
                <li>• <strong>速度调节</strong>：支持 0.5x / 1x / 2x 三档速度</li>
                <li>• <strong>跳转到指定时间</strong>：拖动滑块或点击时间点</li>
                <li>• <strong>缩放</strong>：放大或缩小时间轴视图</li>
              </ul>
            </div>
            <div>
              <p className="text-white/80 mb-2">筛选功能</p>
              <ul className="text-white/50 text-xs space-y-2">
                <li>• <strong>错误类型</strong>：只显示特定类型的错误操作</li>
                <li>• <strong>数据来源</strong>：按系统数据/人工备注筛选</li>
                <li>• <strong>步骤类型</strong>：只显示特定修复步骤</li>
                <li>• <strong>导出一致</strong>：报告导出内容与当前筛选结果一致</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-4">
            <h4 className="text-white/80 font-serif mb-2">错误回放</h4>
            <p className="text-white/50 text-xs">
              点击错误卡片的"回放"按钮，可直接跳转到时间轴对应位置，查看错误发生时的上下文。
            </p>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-4">
            <h4 className="text-white/80 font-serif mb-2">状态快照</h4>
            <p className="text-white/50 text-xs">
              每个时间点都保存了当时的音质评分、顾客耐心、库存状态，可用于分析操作影响。
            </p>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-4">
            <h4 className="text-white/80 font-serif mb-2">参数记录</h4>
            <p className="text-white/50 text-xs">
              详细记录每个操作的输入参数，如清洗剂类型、使用剂量、划痕判断结果等。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
