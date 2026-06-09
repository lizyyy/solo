import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function GuideFloatingCard() {
  const showGuide = useAppStore((s) => s.ui.showGuide);
  const toggleGuide = useAppStore((s) => s.toggleGuide);
  const setShowExportPanel = useAppStore((s) => s.setShowExportPanel);

  const sections = [
    {
      icon: '📁',
      title: '材料区',
      desc: '微信备注/体重单位/现场痕迹 → 都在「异常明细抽屉」→ 点任意行「查看」或 右侧队列项',
      action: null as null | (() => void),
      btn: null as null | string,
    },
    {
      icon: '🔍',
      title: '异常区',
      desc: '重名/单位/温度三大类 → 顶部汇总卡片能下钻，右侧队列实时追踪，左边筛选可精确过滤',
      action: null as null | (() => void),
      btn: null as null | string,
    },
    {
      icon: '📤',
      title: '导出区',
      desc: '顶部「导出配置」按钮 → 选字段+保留单位标记+别名 → 缺口清单一键跳转处理',
      action: () => setShowExportPanel(true),
      btn: '打开导出配置',
    },
  ];

  return (
    <>
      <AnimatePresence mode="wait">
        {!showGuide ? (
          <motion.button
            key="collapsed"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={toggleGuide}
            className="fixed z-50 flex items-center justify-center rounded-full shadow-lg hover:shadow-xl transition-shadow"
            style={{
              right: '24px',
              bottom: '24px',
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, #0EA5A9 0%, #0F766E 100%)',
            }}
            title="操作指引"
          >
            <Sparkles className="w-5 h-5 text-white" />
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="fixed z-50 glass rounded-2xl shadow-2xl ring-1 ring-ink-200/60"
            style={{
              right: '24px',
              bottom: '24px',
              width: '320px',
            }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink-200/50">
              <div className="flex items-center gap-2">
                <span className="text-base">✨</span>
                <h3 className="text-sm font-semibold text-ink-800">
                  新手指引 · 快速上手
                </h3>
              </div>
              <button
                onClick={toggleGuide}
                className="p-1 rounded-md hover:bg-ink-100/70 transition-colors"
                title="收起"
              >
                <X className="w-4 h-4 text-ink-500" />
              </button>
            </div>

            <div className="p-3 space-y-3">
              {sections.map((section, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'relative pl-4',
                    idx < sections.length - 1 && 'pb-3 border-b border-ink-100/70'
                  )}
                >
                  <div
                    className={cn(
                      'absolute left-0 top-1 w-[3px] rounded-full',
                      'h-full',
                      idx === 0 && 'bg-gradient-to-b from-clinic-400 to-clinic-300',
                      idx === 1 &&
                        'bg-gradient-to-b from-amber-400 to-amber-300',
                      idx === 2 &&
                        'bg-gradient-to-b from-violet-400 to-violet-300',
                      idx === sections.length - 1 &&
                        (idx === 0
                          ? 'bg-gradient-to-b from-clinic-400 to-clinic-200'
                          : idx === 1
                          ? 'bg-gradient-to-b from-amber-400 to-amber-200'
                          : 'bg-gradient-to-b from-violet-400 to-violet-200')
                    )}
                  />

                  <div className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0">
                      {section.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-ink-700 mb-1">
                        {section.title}
                      </h4>
                      <p className="text-[11px] leading-relaxed text-ink-500 text-balance">
                        {section.desc}
                      </p>
                      {section.btn && section.action && (
                        <button
                          onClick={section.action}
                          className="mt-2 btn-secondary !text-xs !py-1 !px-2.5"
                        >
                          {section.btn}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-2.5 border-t border-ink-200/50 bg-ink-50/40 rounded-b-2xl">
              <button
                onClick={toggleGuide}
                className="w-full text-[10px] text-ink-400 hover:text-ink-600 transition-colors"
              >
                我知道了 · 点击收起为浮动按钮
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}


