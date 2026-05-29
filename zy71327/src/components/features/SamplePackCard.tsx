import { useNavigate } from 'react-router-dom';
import { Disc3, Calendar, Building2, Music2 } from 'lucide-react';
import type { SamplePack } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { LICENSE_TYPE_LABELS } from '@/types';
import { useStore } from '@/store/useStore';

interface SamplePackCardProps {
  pack: SamplePack;
}

export const SamplePackCard = ({ pack }: SamplePackCardProps) => {
  const navigate = useNavigate();
  const getTracksForSamplePack = useStore((state) => state.getTracksForSamplePack);
  const getCredentialsForSamplePack = useStore((state) => state.getCredentialsForSamplePack);

  const tracks = getTracksForSamplePack(pack.id);
  const credentials = getCredentialsForSamplePack(pack.id);

  return (
    <Card
      className="cursor-pointer group hover:border-[#E8B86D]/30 transition-all duration-300"
      onClick={() => navigate(`/sample-packs/${pack.id}`)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1A1A2E] to-[#2a2a4a] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Disc3 className="w-6 h-6 text-[#E8B86D]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1A1A2E] group-hover:text-[#E8B86D] transition-colors">
                {pack.name}
              </h3>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {pack.vendor}
              </p>
            </div>
          </div>
          <StatusBadge status={pack.status} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">授权类型</span>
            <span className="text-[#1A1A2E] font-medium">
              {LICENSE_TYPE_LABELS[pack.licenseType]}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              购买日期
            </span>
            <span className="text-[#1A1A2E]">{pack.purchaseDate}</span>
          </div>
          {pack.expiryDate && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">到期日期</span>
              <span className="text-[#1A1A2E]">{pack.expiryDate}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Music2 className="w-4 h-4" />
            <span>{tracks.length} 首曲目</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <span>{credentials.length} 份凭证</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
