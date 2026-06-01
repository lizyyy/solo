import { motion } from 'framer-motion';
import { Play, Gamepad2, History, Terminal, Download, Upload, Edit3, AlertTriangle } from 'lucide-react';

export default function Help() {
  const sections = [
    {
      icon: <Terminal size={24} />,
      title: '🚀 如何启动',
      color: 'text-skate-teal',
      steps: [
        '在项目根目录打开终端',
        '运行 `pnpm install` 安装依赖（首次使用）',
        '运行 `pnpm run dev` 启动开发服务器',
        '在浏览器中打开显示的地址（通常是 http://localhost:5173）',
        '首次使用时，系统会自动加载内置的3组关卡参数',
      ],
    },
    {
      icon: <Gamepad2 size={24} />,
      title: '🎮 如何进行一局游戏',
      color: 'text-skate-orange',
      steps: [
        '在主页顶部选择一组关卡（点击关卡卡片展开选择）',
        '点击"开始新对局"按钮',
        '系统会自动导入该关卡的原始备注（乱备注不清洗）',
        '从左侧道具区拖拽道具到不同区域，或直接点击道具快速使用',
        '每次操作都会实时影响资源、分数、风险',
        '每次操作都会被完整记录，包括计算过程和时间戳',
        '可以随时添加补录备注，记录特殊情况',
        '点击"结束本局"保存到历史记录',
      ],
    },
    {
      icon: <Play size={24} />,
      title: '🔄 如何切换关卡',
      color: 'text-skate-blue',
      steps: [
        '在主页点击顶部的关卡选择区域（显示当前关卡名称的地方）',
        '展开所有可用关卡卡片',
        '点击想要切换的关卡卡片',
        '系统会自动切换并保存选择',
        '注意：正在进行的对局需要先结束才能切换关卡',
        '也可以点击"导入"按钮，粘贴JSON格式的关卡配置',
        '点击关卡卡片上的下载图标，可以导出该关卡的JSON配置',
      ],
    },
    {
      icon: <History size={24} />,
      title: '📜 如何查看历史记录',
      color: 'text-skate-yellow',
      steps: [
        '点击顶部导航栏的"历史记录"',
        '看到所有已结束的对局列表',
        '点击任意对局卡片展开详情',
        '可以在"操作记录"标签页查看每一步操作',
        '点击单条操作记录可以展开查看计算过程',
        '可以在"备注记录"标签页查看所有备注',
        '点击备注上的差异图标，可以查看补录前后的对比',
        '如果需要，可以清空所有历史记录（此操作不可恢复）',
      ],
    },
    {
      icon: <Edit3 size={24} />,
      title: '📝 如何补录备注',
      color: 'text-skate-teal',
      steps: [
        '在对局进行中，右侧备注面板点击"补录备注"按钮',
        '输入备注内容和补录原因（可选）',
        '点击"保存备注"',
        '补录备注可以编辑，每次修改都会记录差异',
        '点击备注卡片上的差异图标，查看修改前后的对比',
        '原始备注不可修改，完整保留课堂计分表的原始内容',
        '所有备注都保留作者、时间、来源信息',
      ],
    },
    {
      icon: <AlertTriangle size={24} />,
      title: '⚠️ 异常情况处理',
      color: 'text-skate-red',
      steps: [
        '资源变为负数时，系统会显示红色警告并禁止继续操作',
        '此时可以点击"重置状态"按钮恢复到关卡初始状态',
        '或者点击"结束本局"，异常状态会被标记在历史记录中',
        '风险超过80%时，每步操作会有额外的资源惩罚',
        '风险超过100%也会被标记为异常状态',
        '所有异常情况都会被完整记录，便于后续追溯',
      ],
    },
    {
      icon: <Download size={24} />,
      title: '💾 数据保存与导出',
      color: 'text-skate-blue',
      steps: [
        '所有数据自动保存在浏览器LocalStorage中',
        '包括：关卡配置、当前对局、历史记录、操作人设置',
        '关卡配置可以导出为JSON文件（点击关卡卡片的下载图标）',
        '可以导入JSON格式的关卡配置（点击"导入"按钮）',
        '建议定期导出重要的关卡配置做备份',
        '清除浏览器数据会丢失所有本地数据，请谨慎操作',
      ],
    },
    {
      icon: <Upload size={24} />,
      title: '🎯 设计理念说明',
      color: 'text-skate-orange',
      steps: [
        '原始备注完整保留：不做任何清洗、修改、格式化',
        '判断过程留痕：每一步计算都记录公式、变量、步骤',
        '差异可追溯：补录备注的每次修改都保留差异对比',
        '异常不隐藏：资源负数等异常状态明确提示，不假装正常',
        '来源可追查：每条记录都保留操作人、时间、来源信息',
        '功能克制：专注于计分和记录，不做多余的花哨功能',
      ],
    },
  ];

  return (
    <div className="min-h-screen p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="font-hand text-4xl text-chalk chalk-text mb-2">
          📖 使用说明
        </h1>
        <p className="text-chalk-muted font-mono text-sm">
          微积分滑板公园 - 课堂计分管理工具
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section, index) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-chalkboard-light rounded-xl p-6 border border-chalk/20"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className={section.color}>{section.icon}</span>
              <h2 className={`font-hand text-2xl ${section.color}`}>
                {section.title}
              </h2>
            </div>
            <ol className="space-y-2">
              {section.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm font-mono text-chalk">
                  <span className="text-skate-orange flex-shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-8 p-6 bg-chalkboard-light/50 rounded-xl border border-chalk/10"
      >
        <h3 className="font-hand text-2xl text-skate-orange mb-4">💡 给老冯的交接说明</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm font-mono text-chalk-muted">
          <div>
            <h4 className="text-chalk font-bold mb-2">数据存储位置</h4>
            <p>所有数据存储在浏览器的 LocalStorage 中，key 前缀为 `skatepark_`</p>
            <p className="mt-2">包括：</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>skatepark_levels - 关卡配置</li>
              <li>skatepark_current_session - 当前对局</li>
              <li>skatepark_history - 历史记录</li>
              <li>skatepark_current_level_id - 当前选中关卡</li>
              <li>skatepark_operator_name - 操作人姓名</li>
            </ul>
          </div>
          <div>
            <h4 className="text-chalk font-bold mb-2">如何转移数据</h4>
            <p>如需在另一台电脑使用：</p>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>在原电脑浏览器控制台执行：`localStorage.getItem('skatepark_levels')`</li>
              <li>复制输出的JSON字符串</li>
              <li>在新电脑导入关卡（主页关卡选择区的"导入"按钮）</li>
              <li>历史记录可以通过浏览器的"导出/导入"功能转移</li>
            </ol>
          </div>
          <div>
            <h4 className="text-chalk font-bold mb-2">快速命令</h4>
            <div className="bg-chalkboard p-3 rounded font-mono text-xs space-y-1">
              <p><span className="text-skate-orange">pnpm dev</span> - 启动开发服务器</p>
              <p><span className="text-skate-orange">pnpm build</span> - 构建生产版本</p>
              <p><span className="text-skate-orange">pnpm preview</span> - 预览构建结果</p>
              <p><span className="text-skate-orange">pnpm check</span> - 类型检查</p>
            </div>
          </div>
          <div>
            <h4 className="text-chalk font-bold mb-2">后续可扩展功能</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>支持多人同时使用（需要后端）</li>
              <li>导出完整对局报告为PDF</li>
              <li>自定义计算规则编辑器</li>
              <li>数据可视化图表</li>
              <li>学生账号和成绩追踪</li>
            </ul>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-center text-chalk-muted font-mono text-xs"
      >
        <p>🛹 微积分滑板公园 - 让课堂计分表里的乱材料能对得上</p>
        <p className="mt-1">版本 1.0.0 | 专为培训讲师老冯设计</p>
      </motion.div>
    </div>
  );
}
