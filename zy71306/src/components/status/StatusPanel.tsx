import { Card } from '../common/Card';
import TorqueMeter from './TorqueMeter';
import WearBar from './WearBar';

export default function StatusPanel() {
  return (
    <div className="flex flex-col gap-4">
      <Card title="实时状态">
        <div className="space-y-6">
          <TorqueMeter />
          <div className="border-t border-brass-500/20 pt-4">
            <WearBar />
          </div>
        </div>
      </Card>
    </div>
  );
}
