import DataImport from '../components/DataImport';
import ParamsConfig from '../components/ParamsConfig';
import ResultsPanel from '../components/ResultsPanel';

export default function MainPanel() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <DataImport />
          <ResultsPanel />
        </div>
        <div className="col-span-1">
          <div className="sticky top-6">
            <ParamsConfig />
          </div>
        </div>
      </div>
    </div>
  );
}
