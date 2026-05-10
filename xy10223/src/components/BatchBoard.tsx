import type { Batch } from '../types';
import { FermentationStage } from '../types';
import BatchCard from './BatchCard';
import { getStageName, getStageColor } from '../utils';

interface BatchBoardProps {
  batches: Batch[];
  onSelectBatch: (batch: Batch) => void;
}

export default function BatchBoard({ batches, onSelectBatch }: BatchBoardProps) {
  const stages = [
    FermentationStage.PRE_FERMENT,
    FermentationStage.BULK_FERMENT,
    FermentationStage.BENCH_REST,
    FermentationStage.FINAL_PROOF,
    FermentationStage.COMPLETED
  ];

  const batchesByStage = stages.reduce((acc, stage) => {
    acc[stage] = batches.filter(batch => batch.currentStage === stage);
    return acc;
  }, {} as Record<FermentationStage, Batch[]>);

  return (
    <div className="batch-board">
      <div className="board-header">
        <h1>面包房发酵批次看板</h1>
        <div className="stats-summary">
          <span>总批次: {batches.length}</span>
          <span>进行中: {batches.filter(b => b.currentStage !== FermentationStage.COMPLETED).length}</span>
          <span>已完成: {batches.filter(b => b.currentStage === FermentationStage.COMPLETED).length}</span>
        </div>
      </div>
      
      <div className="board-columns">
        {stages.map(stage => (
          <div key={stage} className="stage-column">
            <div className="column-header" style={{ backgroundColor: getStageColor(stage) }}>
              <span className="stage-name">{getStageName(stage)}</span>
              <span className="batch-count">{batchesByStage[stage].length}</span>
            </div>
            <div className="column-content">
              {batchesByStage[stage].length > 0 ? (
                batchesByStage[stage].map(batch => (
                  <BatchCard 
                    key={batch.id} 
                    batch={batch} 
                    onSelect={onSelectBatch}
                  />
                ))
              ) : (
                <div className="empty-column">暂无批次</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
