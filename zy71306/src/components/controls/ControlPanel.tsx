import { Card } from '../common/Card';
import PressureKnob from './PressureKnob';
import AntiSkatingKnob from './AntiSkatingKnob';
import TonearmSlider from './TonearmSlider';
import RadiusInput from './RadiusInput';
import TrackSelector from './TrackSelector';

export default function ControlPanel() {
  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-2">
      <Card title="参数控制">
        <div className="space-y-6">
          <div className="flex justify-around items-start py-4">
            <PressureKnob />
            <AntiSkatingKnob />
          </div>

          <div className="border-t border-brass-500/20 pt-4">
            <TonearmSlider />
          </div>

          <div className="border-t border-brass-500/20 pt-4">
            <RadiusInput />
          </div>

          <div className="border-t border-brass-500/20 pt-4">
            <TrackSelector />
          </div>
        </div>
      </Card>
    </div>
  );
}
