import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertTriangle, Clock, FileText } from 'lucide-react';
import { SCORE_RULES } from '../../utils/scoreCalculator';

interface InstructionsProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Instructions({ isOpen, onToggle }: InstructionsProps) {
  const [activeSection, setActiveSection] = useState<string | null>('rules');

  const sections = [
    {
      id: 'rules',
      title: '计分规则',
      icon: <CheckCircle2 className="w-5 h-5" />,
      content: (
        <div className="space-y-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="pb-2">操作类型</th>
                <th className="pb-2">分值</th>
                <th className="pb-2">说明</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(SCORE_RULES).map(([key, rule]) => (
                <tr key={key} className="border-t border-slate-700">
                  <td className="py-2 text-white">{rule.description}</td>
                  <td className={`py-2 font-mono ${rule.points > 0 ? 'text-green-400' : 'text-industrial-red'}`}>
                    {rule.points > 0 ? '+' : ''}{rule.points}分
                  </td>
                  <td className="py-2 text-slate-400">
                    {key === 'correct' && '按正确顺序完成单个巡检点'}
                    {key === 'full_completion' && '按顺序完成所有巡检步骤'}
                    {key === 'wrong_order' && '未按清单顺序执行'}
                    {key === 'skipped' && '跳过必需巡检点'}
                    {key === 'duplicate' && '重复巡检同一项目'}
                    {key === 'anomaly_unhandled' && '出现异常未及时处理'}
                    {key === 'anomaly_not_upgraded' && '严重异常未上报'}
                    {key === 'timeout' && '超过规定时间'}
                    {key === 'report_complete' && '生成完整巡检报告'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    },
    {
      id: 'process',
      title: '巡检流程',
      icon: <FileText className="w-5 h-5" />,
      content: (
        <div className="space-y-2">
          <p className="text-slate-300 mb-2">标准巡检流程顺序：</p>
          <ol className="space-y-2">
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-industrial-blue text-white text-sm flex items-center justify-center">1</span>
              <span>检查门禁系统是否正常</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-industrial-blue text-white text-sm flex items-center justify-center">2</span>
              <span>检查配电柜运行状态</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-industrial-blue text-white text-sm flex items-center justify-center">3</span>
              <span>监测各温度点是否正常</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-industrial-blue text-white text-sm flex items-center justify-center">4</span>
              <span>检查通风系统运行状态</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-industrial-blue text-white text-sm flex items-center justify-center">5</span>
              <span>填写巡检记录表格</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-industrial-blue text-white text-sm flex items-center justify-center">6</span>
              <span>处理异常事件并上报</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-industrial-blue text-white text-sm flex items-center justify-center">7</span>
              <span>生成巡检报告</span>
            </li>
          </ol>
        </div>
      )
    },
    {
      id: 'anomaly',
      title: '异常处理',
      icon: <AlertTriangle className="w-5 h-5" />,
      content: (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-industrial-yellow/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-industrial-yellow flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-industrial-yellow">警告级别异常</p>
              <p className="text-sm text-slate-400">温度异常、设备轻微故障等</p>
              <p className="text-sm text-slate-500 mt-1">处理：点击对应巡检点即可处理</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-industrial-red/20 rounded-lg">
            <XCircle className="w-5 h-5 text-industrial-red flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-industrial-red">严重级别异常</p>
              <p className="text-sm text-slate-400">门禁失灵、设备严重故障等</p>
              <p className="text-sm text-slate-500 mt-1">处理：点击巡检点 + 点击"立即上报"按钮</p>
            </div>
          </div>
          <div className="p-3 bg-slate-700/30 rounded-lg">
            <p className="text-sm text-slate-400">
              <Clock className="w-4 h-4 inline mr-1" />
              注意：异常未处理或严重异常未上报会在结算时扣分
            </p>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
      >
        <span className="text-lg font-semibold text-white">游戏说明</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>
      
      {isOpen && (
        <div className="px-4 pb-4 border-t border-slate-700">
          <div className="flex gap-2 mb-4">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSection === section.id
                    ? 'bg-industrial-blue text-white'
                    : 'bg-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {section.icon}
                {section.title}
              </button>
            ))}
          </div>
          
          <div className="bg-slate-900/50 rounded-lg p-4">
            {sections.find(s => s.id === activeSection)?.content}
          </div>
        </div>
      )}
    </div>
  );
}
