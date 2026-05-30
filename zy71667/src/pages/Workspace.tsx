import ParamInput from '../components/ParamInput';
import FreqResult from '../components/FreqResult';
import DeviationPanel from '../components/DeviationPanel';
import TensionChart from '../components/TensionChart';

export default function Workspace() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl text-drum-text">换算工作台</h1>
        <p className="text-drum-textMuted text-sm mt-1">输入鼓皮参数，计算频率、张力与偏差</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <ParamInput />
        </div>
        <div className="lg:col-span-3 space-y-5">
          <FreqResult />
          <DeviationPanel />
          <TensionChart />
        </div>
      </div>
    </div>
  );
}
