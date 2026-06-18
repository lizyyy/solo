import { HeaderBar } from '@/components/HeaderBar';
import { ParamPanel } from '@/components/ParamPanel';
import { TimelineChart } from '@/components/TimelineChart';
import { RecordColumns } from '@/components/RecordColumns';
import { VersionDiffDrawer } from '@/components/VersionDiffDrawer';
import { HandoverCard } from '@/components/HandoverCard';
import { motion } from 'framer-motion';

export default function ReplayPage() {
  return (
    <div className="app-shell min-h-screen w-full">
      <div className="relative z-10 mx-auto max-w-[1600px] pb-16">
        <HeaderBar />

        <main className="px-8 mt-2 grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6">
          <aside className="space-y-4">
            <ParamPanel />
          </aside>

          <section className="space-y-6 min-w-0">
            <TimelineChart />
            <RecordColumns />
          </section>
        </main>

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-10 px-8 text-center text-[11px] font-mono text-sea-foam/50"
        >
          海草床调查时序回放 · 版本快照机制：每次重跑生成对比项，离群值保留不删除，导入指纹键去重，备注永不覆盖。
        </motion.footer>
      </div>

      <VersionDiffDrawer />
      <HandoverCard />
    </div>
  );
}
