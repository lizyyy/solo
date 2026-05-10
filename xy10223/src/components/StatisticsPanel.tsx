import type { Batch } from '../types';
import { FermentationStage } from '../types';
import { getStageName, getStageColor } from '../utils';

interface StatisticsPanelProps {
  batches: Batch[];
}

export default function StatisticsPanel({ batches }: StatisticsPanelProps) {
  const totalBatches = batches.length;
  const completedBatches = batches.filter(b => b.currentStage === FermentationStage.COMPLETED).length;
  const inProgressBatches = totalBatches - completedBatches;
  
  const allTempRecords = batches.flatMap(b => b.temperatureRecords);
  const averageTemperature = allTempRecords.length > 0
    ? allTempRecords.reduce((sum, r) => sum + r.temperature, 0) / allTempRecords.length
    : 0;
  
  const stageDistribution = Object.values(FermentationStage).reduce((acc, stage) => {
    acc[stage] = batches.filter(b => b.currentStage === stage).length;
    return acc;
  }, {} as Record<FermentationStage, number>);

  const totalWeight = batches.reduce((sum, b) => sum + b.weight, 0);
  const totalTempRecords = allTempRecords.length;

  return (
    <div className="statistics-panel">
      <h2>统计概览</h2>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{totalBatches}</div>
          <div className="stat-label">总批次数</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">{inProgressBatches}</div>
          <div className="stat-label">进行中</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">{completedBatches}</div>
          <div className="stat-label">已完成</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">{totalWeight}g</div>
          <div className="stat-label">总重量</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">{averageTemperature.toFixed(1)}°C</div>
          <div className="stat-label">平均温度</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">{totalTempRecords}</div>
          <div className="stat-label">温度记录数</div>
        </div>
      </div>
      
      <div className="stage-distribution">
        <h3>阶段分布</h3>
        <div className="distribution-list">
          {Object.entries(stageDistribution).map(([stage, count]) => (
            <div key={stage} className="distribution-item">
              <div className="distribution-label">
                <span 
                  className="stage-dot" 
                  style={{ backgroundColor: getStageColor(stage as FermentationStage) }}
                />
                {getStageName(stage as FermentationStage)}
              </div>
              <div className="distribution-bar-container">
                <div 
                  className="distribution-bar" 
                  style={{ 
                    width: `${totalBatches > 0 ? (count / totalBatches) * 100 : 0}%`,
                    backgroundColor: getStageColor(stage as FermentationStage)
                  }}
                />
              </div>
              <div className="distribution-count">{count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
