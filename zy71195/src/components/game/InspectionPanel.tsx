import { AlertTriangle, CheckCircle, XCircle, FileText, Truck } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

export function InspectionPanel() {
  const { gameState } = useGameStore();
  const { currentVehicle } = gameState;

  if (!currentVehicle) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            验放信息
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-slate-500">
          等待车辆...
        </CardContent>
      </Card>
    );
  }

  const { container, reservation } = currentVehicle;

  const containerNoMatch = container.containerNo === reservation.containerNo;
  const licenseMatch = container.licensePlate === reservation.licensePlate;
  const dangerousOk = !container.hasDangerous || reservation.allowDangerous;
  const reservationValid = reservation.isValid;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="w-5 h-5" />
          验放信息
          {container.hasDangerous && (
            <span className="ml-auto flex items-center gap-1 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 animate-pulse" />
              危品
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-400">实际信息</h4>
            <div className="bg-slate-800 p-3 border border-slate-700">
              <div className="text-xs text-slate-500 mb-1">箱号</div>
              <div className="font-mono text-lg text-yellow-400 font-bold tracking-wider">
                {container.containerNo}
              </div>
            </div>
            <div className="bg-slate-800 p-3 border border-slate-700">
              <div className="text-xs text-slate-500 mb-1">车牌</div>
              <div className="font-mono text-lg text-slate-200">
                {container.licensePlate}
              </div>
            </div>
            {container.hasDangerous && (
              <div className="bg-red-900/30 p-3 border border-red-700">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-semibold">危险品</span>
                  {container.dangerousLevel && (
                    <span className="text-xs bg-red-700 px-2 py-0.5 rounded">
                      等级 {container.dangerousLevel}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              预约单
            </h4>
            <div className={`p-3 border ${containerNoMatch ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'}`}>
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500 mb-1">箱号</div>
                {containerNoMatch ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
              </div>
              <div className={`font-mono text-lg font-bold tracking-wider ${containerNoMatch ? 'text-green-400' : 'text-red-400'}`}>
                {reservation.containerNo}
              </div>
            </div>
            <div className={`p-3 border ${licenseMatch ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'}`}>
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500 mb-1">车牌</div>
                {licenseMatch ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
              </div>
              <div className={`font-mono text-lg ${licenseMatch ? 'text-green-400' : 'text-red-400'}`}>
                {reservation.licensePlate}
              </div>
            </div>
            <div className={`p-3 border ${reservationValid ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'}`}>
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500 mb-1">预约状态</div>
                {reservationValid ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
              </div>
              <div className={`font-semibold ${reservationValid ? 'text-green-400' : 'text-red-400'}`}>
                {reservationValid ? '有效' : '已失效'}
              </div>
            </div>
            {container.hasDangerous && (
              <div className={`p-3 border ${dangerousOk ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'}`}>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500 mb-1">危品许可</div>
                  {dangerousOk ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>
                <div className={`font-semibold ${dangerousOk ? 'text-green-400' : 'text-red-400'}`}>
                  {reservation.allowDangerous ? '已申报' : '未申报'}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
