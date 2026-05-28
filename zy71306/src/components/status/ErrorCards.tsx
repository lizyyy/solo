import { useCalibrationStore } from '../../store/calibrationStore';
import { Card } from '../common/Card';
import { AlertTriangle, XCircle, Info } from 'lucide-react';
import { getSeverityLabel } from '../../utils/formatters';

export default function ErrorCards() {
  const { errors } = useCalibrationStore();

  if (errors.length === 0) {
    return (
      <Card variant="default" title="状态检测">
        <div className="flex items-center gap-3 p-4 bg-success-500/10 rounded-lg border border-success-500/30">
          <Info size={20} className="text-success-500" />
          <div>
            <p className="text-success-400 font-medium">未检测到异常</p>
            <p className="text-sm text-walnut-400">参数设置在合理范围内</p>
          </div>
        </div>
      </Card>
    );
  }

  const severityIcons = {
    high: <XCircle size={20} className="text-danger-500" />,
    medium: <AlertTriangle size={20} className="text-amber-500" />,
    low: <Info size={20} className="text-blue-500" />,
  };

  const cardVariants = {
    high: 'error' as const,
    medium: 'warning' as const,
    low: 'default' as const,
  };

  return (
    <Card title={`问题检测 (${errors.length})`} variant={errors.some(e => e.severity === 'high') ? 'error' : 'warning'}>
      <div className="space-y-3">
        {errors.map((error, index) => (
          <div
            key={index}
            className={`
              p-3 rounded-lg border
              ${error.severity === 'high'
                ? 'bg-danger-500/10 border-danger-500/30'
                : error.severity === 'medium'
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-blue-500/10 border-blue-500/30'}
            `}
          >
            <div className="flex items-start gap-2">
              {severityIcons[error.severity]}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`
                      text-xs font-bold px-2 py-0.5 rounded
                      ${error.severity === 'high'
                        ? 'bg-danger-500/30 text-danger-400'
                        : error.severity === 'medium'
                        ? 'bg-amber-500/30 text-amber-400'
                        : 'bg-blue-500/30 text-blue-400'}
                    `}
                  >
                    {getSeverityLabel(error.severity)}
                  </span>
                </div>
                <p
                  className={`
                    text-sm
                    ${error.severity === 'high'
                      ? 'text-danger-300'
                      : error.severity === 'medium'
                      ? 'text-amber-300'
                      : 'text-blue-300'}
                  `}
                >
                  {error.message}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-walnut-400 mt-3 text-center">
        ⚠ 这些问题将被记录在校准报告中
      </p>
    </Card>
  );
}
