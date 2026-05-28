import React from 'react';
import { useArtworkStore } from '../../store/useArtworkStore';
import { QualityAlert } from './QualityAlert';
import { GlassCard } from '../common/GlassCard';
import { FilterWarning } from './FilterWarning';
import { useFilterStore } from '../../store/useFilterStore';

export const QualityAlertPanel: React.FC = () => {
  const { artworks, selectedArtworkId, clearQualityAlert } = useArtworkStore();
  const { filterFailure, resetFilters, setHueRange, setSaturationRange, setLightnessRange } = useFilterStore();

  const selectedArtwork = artworks.find((a) => a.id === selectedArtworkId);

  const hasQualityIssues = artworks.some(
    (a) =>
      a.qualityFlags.transparentBgRisk ||
      a.qualityFlags.extremeColorRisk ||
      a.qualityFlags.missingData ||
      a.qualityFlags.versionConflict
  );

  const handleAdjustThreshold = () => {
    setHueRange([0, 360]);
    setSaturationRange([0, 100]);
    setLightnessRange([0, 100]);
  };

  return (
    <div className="space-y-4">
      {filterFailure && (
        <FilterWarning
          failureInfo={filterFailure}
          onResetFilter={resetFilters}
          onAdjustThreshold={handleAdjustThreshold}
        />
      )}

      {selectedArtwork && (
        <QualityAlert
          flags={selectedArtwork.qualityFlags}
          artworkTitle={selectedArtwork.title}
          onDismiss={() => clearQualityAlert(selectedArtwork.id)}
        />
      )}

      {hasQualityIssues && !selectedArtwork && (
        <GlassCard className="p-4 bg-purple-500/10 border border-purple-500/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔮</span>
            <div>
              <h4 className="font-bold text-purple-400">数据质量检测</h4>
              <p className="text-sm text-gray-300">
                检测到 {artworks.filter((a) => Object.values(a.qualityFlags).some(Boolean)).length}{' '}
                个作品存在数据质量问题，点击星点查看详情
              </p>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
};
