
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Recycle, Droplets, AlertTriangle, Calendar, Scissors, Sparkles } from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_NAMES, CATEGORY_EMOJIS } from '@/types';

export function RulesPage() {
  const navigate = useNavigate();

  const categories = [
    {
      key: 'recyclable',
      color: CATEGORY_COLORS.recyclable,
      icon: CATEGORY_EMOJIS.recyclable,
      name: CATEGORY_NAMES.recyclable,
      description: '适宜回收和资源利用的废弃物',
      examples: ['纸类', '塑料', '玻璃', '金属', '织物'],
      tips: ['清洁干燥后投放', '压扁节省空间', '去除胶带等附件'],
    },
    {
      key: 'wet',
      color: CATEGORY_COLORS.wet,
      icon: CATEGORY_EMOJIS.wet,
      name: CATEGORY_NAMES.wet,
      description: '易腐烂的生物质废弃物',
      examples: ['剩菜剩饭', '果皮果核', '菜叶菜根', '蛋壳', '茶渣'],
      tips: ['必须破袋投放', '沥干水分', '不要混入纸巾'],
    },
    {
      key: 'dry',
      color: CATEGORY_COLORS.dry,
      icon: CATEGORY_EMOJIS.dry,
      name: CATEGORY_NAMES.dry,
      description: '除上述三类外的其他生活废弃物',
      examples: ['卫生纸', '烟蒂', '陶瓷', '一次性餐具', '旧抹布'],
      tips: ['简单沥干即可', '包裹尖锐物品', '难以辨识的投这里'],
    },
    {
      key: 'hazardous',
      color: CATEGORY_COLORS.hazardous,
      icon: CATEGORY_EMOJIS.hazardous,
      name: CATEGORY_NAMES.hazardous,
      description: '对人体健康或自然环境有害的废弃物',
      examples: ['废电池', '过期药品', '水银温度计', '杀虫剂', '油漆桶'],
      tips: ['单独存放', '避免破损', '注意密封'],
    },
  ];

  const specialMechanics = [
    {
      icon: <Scissors className="w-8 h-8" />,
      title: '湿垃圾破袋',
      description: '袋装湿垃圾必须先破袋，将垃圾倒入湿垃圾桶，塑料袋投入干垃圾桶。',
      color: '#795548',
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: '污染可回收物',
      description: '被油污、食物残渣污染的可回收物，清洁后才能投放，否则改投干垃圾。',
      color: '#1976D2',
    },
    {
      icon: <Calendar className="w-8 h-8" />,
      title: '大件垃圾预约',
      description: '旧家具、家电等大件垃圾不能直接投放，需要在指定时段预约回收。',
      color: '#FF9800',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur hover:bg-white/30 text-white font-bold rounded-xl transition-colors"
          >
            <ArrowLeft size={20} />
            返回
          </button>
          <h1 className="text-3xl font-bold text-white">游戏规则</h1>
        </div>

        {/* Classification Guide */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-8 shadow-2xl mb-8"
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Recycle className="text-green-500" />
            垃圾分类指南
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categories.map((cat, index) => (
              <motion.div
                key={cat.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="rounded-2xl p-6 border-2"
                style={{ borderColor: cat.color }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{cat.icon}</span>
                  <div>
                    <h3 className="text-xl font-bold" style={{ color: cat.color }}>
                      {cat.name}
                    </h3>
                    <p className="text-sm text-gray-500">{cat.description}</p>
                  </div>
                </div>
                <div className="mb-4">
                  <span className="text-sm font-medium text-gray-600">常见物品：</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {cat.examples.map((ex, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-full text-sm text-white"
                        style={{ backgroundColor: cat.color }}
                      >
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">小贴士：</span>
                  <ul className="mt-2 space-y-1">
                    {cat.tips.map((tip, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-green-500">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Special Mechanics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl p-8 shadow-2xl mb-8"
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <AlertTriangle className="text-orange-500" />
            特殊处理机制
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {specialMechanics.map((mech, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="rounded-2xl p-6 text-center"
                style={{ backgroundColor: `${mech.color}15` }}
              >
                <div
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white"
                  style={{ backgroundColor: mech.color }}
                >
                  {mech.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">{mech.title}</h3>
                <p className="text-sm text-gray-600">{mech.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* How to Play */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-3xl p-8 shadow-2xl"
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-6">游戏玩法</h2>
          <div className="space-y-4">
            {[
              { step: 1, title: '选择关卡', desc: '从三个难度级别中选择，每个关卡有不同的规则和时间限制。' },
              { step: 2, title: '处理垃圾', desc: '点击卡片上的按钮进行破袋或清洁操作（如需要）。' },
              { step: 3, title: '拖拽投放', desc: '将垃圾卡片拖拽到正确的投放区域。' },
              { step: 4, title: '大件预约', desc: '大件垃圾只能在预约时段内投入预约点。' },
              { step: 5, title: '查看结果', desc: '游戏结束后查看得分和错误分析，导出投放报告。' },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl"
              >
                <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{item.title}</h3>
                  <p className="text-gray-600 text-sm">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default RulesPage;
