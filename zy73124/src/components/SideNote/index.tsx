import { Card, Tag } from 'antd';
import { Info, FileText } from 'lucide-react';

interface SideNoteProps {
  sceneLabel: string;
  sideNote: string;
  bottleCount: number;
  abnormalCount: number;
}

export default function SideNote({ sceneLabel, sideNote, bottleCount, abnormalCount }: SideNoteProps) {
  return (
    <Card
      className="bg-slate-50 border-slate-200"
      title={
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium">说明信息</span>
        </div>
      }
      size="small"
    >
      <div className="space-y-3 text-sm">
        <div>
          <div className="text-slate-500 text-xs mb-1">场景标注</div>
          <Tag color="blue">{sceneLabel}</Tag>
        </div>

        <div>
          <div className="text-slate-500 text-xs mb-1">侧边说明</div>
          <p className="text-slate-700 leading-relaxed">{sideNote}</p>
        </div>

        <div className="flex gap-4 pt-2 border-t border-slate-200">
          <div>
            <div className="text-slate-500 text-xs">采样瓶</div>
            <div className="font-mono font-medium text-slate-700">{bottleCount} 瓶</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs">异常数</div>
            <div className={`font-mono font-medium ${abnormalCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {abnormalCount} 项
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200">
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <FileText className="w-3 h-3" />
            此说明与CSV导出文件中的备注口径一致
          </div>
        </div>
      </div>
    </Card>
  );
}
