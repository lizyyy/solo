import { useState } from 'react';
import { Users, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { isUserNode } from '../../game/engine';
import { PRIORITY_CONFIG } from '../../game/config';
import type { UserNode } from '../../game/types';

export function LeftPanel() {
  const { nodes, selectedNode, selectNode } = useGameStore();
  const [expandedPriorities, setExpandedPriorities] = useState<Set<string>>(new Set(['critical', 'important', 'normal']));

  const userNodes = nodes.filter(isUserNode);
  
  const groupedUsers = {
    critical: userNodes.filter(n => n.priority === 'critical'),
    important: userNodes.filter(n => n.priority === 'important'),
    normal: userNodes.filter(n => n.priority === 'normal')
  };

  const togglePriority = (priority: string) => {
    setExpandedPriorities(prev => {
      const next = new Set(prev);
      if (next.has(priority)) {
        next.delete(priority);
      } else {
        next.add(priority);
      }
      return next;
    });
  };

  const getUserStatusColor = (user: UserNode) => {
    if (user.powered) return 'text-green-400';
    const ratio = user.outageTime / user.maxOutageTime;
    if (ratio >= 0.8) return 'text-red-500 animate-pulse';
    if (ratio >= 0.5) return 'text-yellow-500';
    return 'text-slate-400';
  };

  const renderUserGroup = (priority: 'critical' | 'important' | 'normal', title: string) => {
    const users = groupedUsers[priority];
    const config = PRIORITY_CONFIG[priority];
    const poweredCount = users.filter(u => u.powered).length;
    const isExpanded = expandedPriorities.has(priority);

    return (
      <div key={priority} className="mb-4">
        <div
          className="flex items-center justify-between cursor-pointer hover:bg-slate-700/50 px-2 py-1 rounded"
          onClick={() => togglePriority(priority)}
        >
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
            <span className="text-white font-medium text-sm">{title}</span>
            <span className="text-xs text-slate-400">
              ({poweredCount}/{users.length})
            </span>
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>

        {isExpanded && (
          <div className="mt-2 space-y-1 ml-4">
            {users.map(user => (
              <div
                key={user.id}
                className={`p-2 rounded cursor-pointer transition-colors ${
                  selectedNode === user.id ? 'bg-slate-600' : 'hover:bg-slate-700/50'
                }`}
                onClick={() => selectNode(selectedNode === user.id ? null : user.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {user.powered ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    )}
                    <span className={`text-sm ${getUserStatusColor(user)}`}>
                      {user.name}
                    </span>
                  </div>
                  {!user.powered && (
                    <div className="flex items-center gap-1 text-xs">
                      <Clock className="w-3 h-3" />
                      <span className={getUserStatusColor(user)}>
                        {user.outageTime}/{user.maxOutageTime}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${(user.outageTime / user.maxOutageTime) * 100}%`,
                      backgroundColor: user.powered ? '#4ade80' : config.color
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="absolute left-4 top-20 bottom-20 w-64 bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 overflow-hidden flex flex-col z-10">
      <div className="p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" />
          <span className="text-white font-semibold">用户状态</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {renderUserGroup('critical', '特级保障')}
        {renderUserGroup('important', '重要用户')}
        {renderUserGroup('normal', '普通用户')}
      </div>

      <div className="p-3 border-t border-slate-700 bg-slate-800/50">
        <div className="text-xs text-slate-400">
          <div className="flex justify-between mb-1">
            <span>总供电率</span>
            <span>{Math.round((userNodes.filter(u => u.powered).length / userNodes.length) * 100)}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${(userNodes.filter(u => u.powered).length / userNodes.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
