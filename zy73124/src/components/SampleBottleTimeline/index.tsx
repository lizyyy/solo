import { useState } from 'react';
import { Timeline, Tag, Card, Button } from 'antd';
import { FlaskConical, Clock, User, ChevronDown, ChevronUp } from 'lucide-react';
import type { SampleBottle } from '@/types';
import { formatDateTime } from '@/utils/storage';

interface SampleBottleTimelineProps {
  bottles: SampleBottle[];
}

export default function SampleBottleTimeline({ bottles }: SampleBottleTimelineProps) {
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  const batches = bottles.reduce((acc, bottle) => {
    if (!acc[bottle.batchNo]) {
      acc[bottle.batchNo] = [];
    }
    acc[bottle.batchNo].push(bottle);
    return acc;
  }, {} as Record<string, SampleBottle[]>);

  const batchNos = Object.keys(batches).sort();

  const toggleBatch = (batchNo: string) => {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchNo)) {
        next.delete(batchNo);
      } else {
        next.add(batchNo);
      }
      return next;
    });
  };

  if (bottles.length === 0) {
    return (
      <Card>
        <div className="text-center py-8 text-slate-400">
          <FlaskConical className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>暂无采样瓶数据</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {batchNos.map((batchNo, batchIndex) => {
        const batchBottles = batches[batchNo];
        const isExpanded = expandedBatches.has(batchNo) || batchIndex === 0;
        const firstBottle = batchBottles[0];

        return (
          <Card key={batchNo} className="overflow-hidden">
            <div
              className="flex items-center justify-between cursor-pointer -mx-4 -mt-4 px-4 py-3 bg-slate-50 border-b border-slate-100"
              onClick={() => toggleBatch(batchNo)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">
                  {batchIndex + 1}
                </div>
                <div>
                  <div className="font-medium text-slate-800">
                    {batchNo} · 第{batchIndex + 1}批
                    <Tag color="blue" className="ml-2">
                      {batchBottles.length} 瓶
                    </Tag>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      录入时间：{formatDateTime(firstBottle.recordedAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      录入人：{firstBottle.recorder}
                    </span>
                  </div>
                </div>
              </div>
              <Button type="text" icon={isExpanded ? <ChevronUp /> : <ChevronDown />}>
                {isExpanded ? '收起' : '展开'}
              </Button>
            </div>

            {isExpanded && (
              <div className="mt-4">
                <Timeline
                  mode="left"
                  items={batchBottles.map((bottle) => ({
                    color: 'blue',
                    label: (
                      <div className="text-xs text-slate-500">
                        <div>序号 {bottle.sequence}</div>
                        <div>{formatDateTime(bottle.sampledAt)}</div>
                      </div>
                    ),
                    children: (
                      <div className="pb-2">
                        <div className="font-mono font-medium text-slate-800">
                          {bottle.bottleNo}
                        </div>
                        <div className="text-sm text-slate-600 mt-1">
                          实验结果：
                          <span className="font-mono font-medium">
                            {bottle.experimentResult} {bottle.resultUnit}
                          </span>
                        </div>
                        {bottle.remark && (
                          <div className="text-xs text-slate-500 mt-1 bg-slate-50 px-2 py-1 rounded">
                            备注：{bottle.remark}
                          </div>
                        )}
                      </div>
                    ),
                  }))}
                />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
