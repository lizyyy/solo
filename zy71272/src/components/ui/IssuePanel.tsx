import { useState } from 'react';
import { AlertCircle, ChevronUp, ChevronDown, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getIssueTypeLabel, getIssueIcon } from '../../utils/sceneDetection';
import { getIssueSeverityColor } from '../../utils/helpers';

export default function IssuePanel() {
  const sceneIssues = useStore(state => state.sceneIssues);
  const focusOnIssue = useStore(state => state.focusOnIssue);
 const [isExpanded, setIsExpanded] = useState(true);
 const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
 const visibleIssues = sceneIssues.filter(i => !dismissedIds.has(i.id));
 const errorCount = visibleIssues.filter(i => i.severity === 'error').length;
 const warningCount = visibleIssues.filter(i => i.severity === 'warning').length;
 const dismissIssue = (id: string, e: React.MouseEvent) => {
 e.stopPropagation();
 setDismissedIds(prev => new Set([...prev, id]));
 };
 if (visibleIssues.length === 0) {
 return (<div className="fixed bottom-4 right-4 z-50">
 <div className="bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-lg px-4 py-2 flex items-center gap-2 backdrop-blur-md">
 <span className="text-[#00ff88]">✓</span>
 <span className="text-[#00ff88] text-sm font-medium">声场配置良好</span>
 </div>
 </div>);
 }
 return (<div className="fixed bottom-4 right-4 z-50 w-80">
 <div className="bg-[#121a29]/95 backdrop-blur-xl border border-[#ff6b35]/30 rounded-xl overflow-hidden shadow-2xl">
 <button onClick={() => setIsExpanded(!isExpanded)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1a2535]/50 transition-colors">
 <div className="flex items-center gap-3">
 <div className="relative">
 <AlertCircle size={20} className={errorCount > 0 ? 'text-[#ff3366]' : 'text-[#ff6b35]'}/>
 {(errorCount > 0 || warningCount > 0) && (<span className="absolute -top-1 -right-1 w-4 h-4 bg-[#ff3366] text-white text-xs rounded-full flex items-center justify-center font-bold">
 {visibleIssues.length}
 </span>)}
 </div>
 <div className="text-left">
 <div className="text-white font-medium text-sm">场景检测</div>
 <div className="text-xs text-[#8899aa]">
 {errorCount > 0 && <span className="text-[#ff3366] mr-2">{errorCount} 个错误</span>}
 {warningCount > 0 && <span className="text-[#ff6b35]">{warningCount} 个警告</span>}
 </div>
 </div>
 </div>
 {isExpanded ? <ChevronDown size={18} className="text-[#8899aa]"/> : <ChevronUp size={18} className="text-[#8899aa]"/>}
 </button>

 {isExpanded && (<div className="max-h-80 overflow-y-auto border-t border-[#3a4a6b]">
 {visibleIssues.map((issue, index) => (<div key={issue.id} onClick={() => focusOnIssue(issue)} className="p-3 border-b border-[#3a4a6b]/50 last:border-b-0 cursor-pointer hover:bg-[#1a2535]/50 transition-colors group" style={{
 animationDelay: `${index * 50}ms`,
 }}>
 <div className="flex items-start gap-3">
 <span className="text-lg">{getIssueIcon(issue.type)}</span>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <span className="text-xs px-2 py-0.5 rounded font-medium" style={{
 backgroundColor: `${getIssueSeverityColor(issue.severity)}20`,
 color: getIssueSeverityColor(issue.severity),
 }}>
 {getIssueTypeLabel(issue.type)}
 </span>
 <span className="text-xs" style={{ color: getIssueSeverityColor(issue.severity) }}>
 {issue.severity === 'error' ? '错误' : '警告'}
 </span>
 </div>
 <p className="text-sm text-white line-clamp-2">{issue.message}</p>
 </div>
 <button onClick={(e) => dismissIssue(issue.id, e)} className="p-1 rounded text-[#8899aa] hover:text-white hover:bg-[#3a4a6b] opacity-0 group-hover:opacity-100 transition-opacity">
 <X size={14}/>
 </button>
 </div>
 </div>))}
 </div>)}

 {isExpanded && visibleIssues.length > 0 && (<div className="p-2 border-t border-[#3a4a6b]">
 <p className="text-xs text-[#8899aa] text-center">
 💡 点击问题可定位到3D场景中的对应位置
 </p>
 </div>)}
 </div>
 </div>);
}

