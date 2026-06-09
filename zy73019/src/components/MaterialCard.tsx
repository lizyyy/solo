import { MATERIAL_LABEL, type Material } from '../../shared/types';
import { FileText, Paperclip, MessageSquare, AlertTriangle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MaterialCardProps {
  material: Material;
}

const typeIcons = {
  medical_record: FileText,
  attachment: Paperclip,
  oral_note: MessageSquare,
};

const typeColors = {
  medical_record: 'bg-sage/15 text-sage-dark border-sage/30',
  attachment: 'bg-sand/15 text-sand-dark border-sand/30',
  oral_note: 'bg-ochre/15 text-ochre-dark border-ochre/30',
};

const MaterialCard = ({ material }: MaterialCardProps) => {
  const Icon = typeIcons[material.type];
  const sizeKB = (material.fileSize / 1024).toFixed(1);

  return (
    <div className="bg-white rounded-xl border border-sand/30 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className={cn(
              'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border',
              typeColors[material.type]
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-slate-stone-dark truncate">{material.fileName}</h4>
              <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-cream text-slate-stone border border-sand/20">
                v{material.version}
              </span>
            </div>
            <p className="text-xs text-slate-stone mb-2">
              <span className={cn('inline-flex items-center mr-2', typeColors[material.type].split(' ')[1])}>
                {MATERIAL_LABEL[material.type]}
              </span>
              {sizeKB} KB · 上传于 {new Date(material.uploadedAt).toLocaleDateString('zh-CN')}
            </p>
            {material.summary && (
              <p className="text-sm text-slate-stone line-clamp-2">{material.summary}</p>
            )}
            {material.hasConsistencyChange && (
              <div className="mt-2 flex items-start gap-1.5 p-2 rounded-lg bg-brick/10 border border-brick/20">
                <AlertTriangle className="w-4 h-4 text-brick flex-shrink-0 mt-0.5" />
                <p className="text-xs text-brick-dark">{material.consistencyChangeNote || '存在一致性变更'}</p>
              </div>
            )}
          </div>
        </div>
        <button className="flex-shrink-0 p-2 rounded-lg hover:bg-cream text-slate-stone hover:text-sand-dark transition-colors">
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default MaterialCard;
