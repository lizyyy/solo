import BallConfig from '@/components/BallConfig';
import CollisionCanvas from '@/components/CollisionCanvas';
import DataPanel from '@/components/DataPanel';

export default function Simulator() {
  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 font-body">
      <div className="lg:col-span-2 space-y-4">
        <CollisionCanvas />
        <DataPanel />
      </div>
      <div className="lg:col-span-1">
        <BallConfig />
      </div>
    </div>
  );
}
