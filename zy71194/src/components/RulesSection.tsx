import React from 'react';
import { BookOpen, AlertTriangle, Target, Backpack, Clock, Heart } from 'lucide-react';

export const RulesSection: React.FC = () => {
  const rules = [
    {
      icon: <Target className="w-6 h-6" />,
      title: '游戏目标',
      items: [
        '带领队伍从起点安全到达终点',
        '确保急救包中没有过期药品',
        '经过所有关键补给点（带星标的补给站）',
        '在限定回合数内完成任务'
      ]
    },
    {
      icon: <Backpack className="w-6 h-6" />,
      title: '急救包管理',
      items: [
        '药品有保质期，过期会导致任务失败',
        '超过最大负重限制会导致任务失败',
        '可以在补给点补充物资',
        '可以丢弃不需要的物品减轻重量'
      ]
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: '回合系统',
      items: [
        '每回合有3点行动点数',
        '移动到相邻节点消耗1点行动点',
        '行动点数用完后需要结束回合',
        '回合结束后药品保质期会减少'
      ]
    },
    {
      icon: <Heart className="w-6 h-6" />,
      title: '队伍状态',
      items: [
        '队伍生命值归零会导致任务失败',
        '突发事件会影响队伍状态',
        '合理使用药品可以恢复生命值',
        '选择正确的应对方案至关重要'
      ]
    },
    {
      icon: <AlertTriangle className="w-6 h-6" />,
      title: '失败原因',
      items: [
        '⏰ 超时未到达终点',
        '⚖️ 急救包超重',
        '💊 存在过期药品未清理',
        '❤️ 队伍生命值归零',
        '📍 错过关键补给点'
      ]
    }
  ];

  return (
    <div id="rules-section" className="py-12 px-4 bg-white/50">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <BookOpen className="w-8 h-8 text-primary-600" />
          <h2 className="text-2xl font-bold text-gray-800">游戏规则</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rules.map((rule, index) => (
            <div key={index} className="game-card p-5">
              <div className="flex items-center gap-3 mb-4 text-primary-600">
                {rule.icon}
                <h3 className="font-bold text-gray-800">{rule.title}</h3>
              </div>
              <ul className="space-y-2">
                {rule.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-primary-500 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
