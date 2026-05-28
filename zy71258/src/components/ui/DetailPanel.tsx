import { useState } from 'react';
import { Frame, Lightbulb, AlertTriangle, TrendingUp, MapPin, Clock, Shield } from 'lucide-react';
import { useMainStore } from '@/store/mainStore';
import TabSwitcher, { type TabItem } from './TabSwitcher';
import RiskCard from './RiskCard';
import { LIGHT_RESISTANCE_THRESHOLDS, GRADE_COLORS } from '@/types';
import type { Artwork, LightSource, Risk } from '@/types';

const TABS: TabItem[] = [
  { key: 'artwork', label: '作品详情', icon: <Frame size={14} /> },
  { key: 'lightSource', label: '光源详情', icon: <Lightbulb size={14} /> },
  { key: 'risk', label: '风险详情', icon: <AlertTriangle size={14} /> },
  { key: 'exposure', label: '累计曝光', icon: <TrendingUp size={14} /> },
];

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#2A2D34]/50">
      <span className="text-xs text-[#8B8D93]" style={{ fontFamily: "'Noto Serif SC', serif" }}>{label}</span>
      <span className="text-xs font-mono" style={{ color: color || '#B0B2B8' }}>{value}</span>
    </div>
  );
}

function ArtworkDetail({ artwork }: { artwork: Artwork }) {
  const threshold = LIGHT_RESISTANCE_THRESHOLDS[artwork.lightResistanceGrade];
  const gradeColor = GRADE_COLORS[artwork.lightResistanceGrade];
  const isOverIllum = artwork.currentIllumination && artwork.currentIllumination > threshold.maxInstantIllumination;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#C9A962]" style={{ fontFamily: "'Noto Serif SC', serif" }}>{artwork.name}</h3>
          <p className="text-xs text-[#5A5D63] font-mono mt-1">{artwork.registrationNo}</p>
        </div>
        <div className="px-2 py-1 rounded text-xs font-mono" style={{ backgroundColor: `${gradeColor}20`, color: gradeColor }}>
          {artwork.lightResistanceGrade.split(' ').pop()}
        </div>
      </div>
      <div className="space-y-1">
        <InfoRow label="尺寸" value={`${artwork.width} × ${artwork.height}cm`} />
        <InfoRow label="保护等级" value={artwork.protectionLevel} />
        <InfoRow label="位置" value={`(${artwork.posX.toFixed(1)}, ${artwork.posY.toFixed(1)}, ${artwork.posZ.toFixed(1)})`} />
        <InfoRow label="当前照度" value={`${artwork.currentIllumination?.toFixed(1) || '--'} lx`} color={isOverIllum ? '#E5484D' : '#27AE60'} />
        <InfoRow label="累计曝光" value={`${artwork.cumulativeExposure?.toLocaleString() || '--'} lx·h`} />
        <InfoRow label="年限值" value={`${threshold.maxAnnualExposure.toLocaleString()} lx·h`} />
      </div>
      <div className="p-3 rounded-lg bg-[#16181D] border border-[#2A2D34]">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={14} className="text-[#C9A962]" />
          <span className="text-xs text-[#8B8D93]" style={{ fontFamily: "'Noto Serif SC', serif" }}>光照阈值</span>
        </div>
        <div className="text-xs text-[#B0B2B8] font-mono space-y-1">
          <div className="flex justify-between"><span>瞬时照度上限</span><span>{threshold.maxInstantIllumination} lx</span></div>
          <div className="flex justify-between"><span>年限曝光上限</span><span>{threshold.maxAnnualExposure.toLocaleString()} lx·h</span></div>
          <div className="flex justify-between"><span>色温限制</span><span>≤ {threshold.colorTemperatureLimit}K</span></div>
        </div>
      </div>
    </div>
  );
}

function LightSourceDetail({ source }: { source: LightSource }) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#F2994A]" style={{ fontFamily: "'Noto Serif SC', serif" }}>{source.name}</h3>
          <p className="text-xs text-[#5A5D63] font-mono mt-1">ID: {source.id}</p>
        </div>
        <div className="px-2 py-1 rounded text-xs font-mono bg-[#F2994A]/20 text-[#F2994A]">{source.type}</div>
      </div>
      <div className="space-y-1">
        <InfoRow label="功率" value={`${source.power}W`} />
        <InfoRow label="强度" value={`${source.intensity}%`} />
        <InfoRow label="色温" value={`${source.colorTemperature}K`} />
        <InfoRow label="光束角" value={`${source.beamAngle}°`} />
        <InfoRow label="位置" value={`(${source.posX.toFixed(1)}, ${source.posY.toFixed(1)}, ${source.posZ.toFixed(1)})`} />
        <InfoRow label="角度" value={`(${source.angleX.toFixed(0)}°, ${source.angleY.toFixed(0)}°, ${source.angleZ.toFixed(0)}°)`} />
        {source.calibrationCertNo && <InfoRow label="校准证书" value={source.calibrationCertNo} />}
      </div>
    </div>
  );
}

function RiskDetail({ risk }: { risk: Risk }) {
  return (
    <div className="p-4">
      <RiskCard risk={risk} />
      <div className="mt-4 p-3 rounded-lg bg-[#16181D] border border-[#2A2D34]">
        <div className="flex items-center gap-2 mb-2">
          <Clock size={14} className="text-[#8B8D93]" />
          <span className="text-xs text-[#8B8D93]" style={{ fontFamily: "'Noto Serif SC', serif" }}>检测时间</span>
        </div>
        <p className="text-xs text-[#B0B2B8] font-mono">{risk.detectedAt}</p>
        {risk.evidence.notes && (
          <div className="mt-3 pt-3 border-t border-[#2A2D34]">
            <p className="text-xs text-[#8B8D93] mb-1" style={{ fontFamily: "'Noto Serif SC', serif" }}>备注</p>
            <p className="text-xs text-[#B0B2B8]">{risk.evidence.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ExposureDetail({ artwork }: { artwork: Artwork }) {
  const threshold = LIGHT_RESISTANCE_THRESHOLDS[artwork.lightResistanceGrade];
  const exposure = artwork.cumulativeExposure || 0;
  const percentage = Math.min((exposure / threshold.maxAnnualExposure) * 100, 100);
  const barColor = percentage > 90 ? '#E5484D' : percentage > 70 ? '#F2994A' : '#C9A962';

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-[#C9A962]" style={{ fontFamily: "'Noto Serif SC', serif" }}>{artwork.name}</h3>
        <p className="text-xs text-[#5A5D63] font-mono">{artwork.registrationNo}</p>
      </div>
      <div className="p-4 rounded-xl bg-gradient-to-br from-[#16181D] to-[#1A1D24] border border-[#2A2D34]">
        <div className="text-center">
          <div className="text-3xl font-bold text-[#C9A962] font-mono mb-1">{exposure.toLocaleString()}</div>
          <div className="text-xs text-[#8B8D93]" style={{ fontFamily: "'Noto Serif SC', serif" }}>累计曝光量 (lx·h)</div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-[#8B8D93]">已使用</span>
            <span className="text-[#C9A962] font-mono">{percentage.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-[#2A2D34] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${percentage}%`, backgroundColor: barColor }} />
          </div>
          <div className="flex justify-between text-xs mt-1.5 text-[#5A5D63] font-mono">
            <span>0</span>
            <span>{threshold.maxAnnualExposure.toLocaleString()}</span>
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <InfoRow label="年度限制" value={`${threshold.maxAnnualExposure.toLocaleString()} lx·h`} />
        <InfoRow label="剩余额度" value={`${(threshold.maxAnnualExposure - exposure).toLocaleString()} lx·h`} color={threshold.maxAnnualExposure > exposure ? '#27AE60' : '#E5484D'} />
      </div>
    </div>
  );
}

export default function DetailPanel() {
  const [activeTab, setActiveTab] = useState('artwork');
  const { selectedArtworkId, selectedLightSourceId, selectedRiskId, artworks, lightSources, risks } = useMainStore();

  const selectedArtwork = artworks.find((a) => a.id === selectedArtworkId);
  const selectedLightSource = lightSources.find((l) => l.id === selectedLightSourceId);
  const selectedRisk = risks.find((r) => r.id === selectedRiskId);

  const renderContent = () => {
    if (!selectedArtwork && !selectedLightSource && !selectedRisk) {
      return (
        <div className="flex-1 flex items-center justify-center text-[#5A5D63]">
          <div className="text-center">
            <MapPin size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm" style={{ fontFamily: "'Noto Serif SC', serif" }}>请选择数据项查看详情</p>
          </div>
        </div>
      );
    }
    switch (activeTab) {
      case 'artwork': return selectedArtwork ? <ArtworkDetail artwork={selectedArtwork} /> : null;
      case 'lightSource': return selectedLightSource ? <LightSourceDetail source={selectedLightSource} /> : null;
      case 'risk': return selectedRisk ? <RiskDetail risk={selectedRisk} /> : null;
      case 'exposure': return selectedArtwork ? <ExposureDetail artwork={selectedArtwork} /> : null;
      default: return null;
    }
  };

  return (
    <div className="w-80 bg-[#121418] border-l border-[#2A2D34] flex flex-col h-full">
      <TabSwitcher tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto">{renderContent()}</div>
    </div>
  );
}
