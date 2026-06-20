import { useState } from 'react';
import { Search, Eye, MapPin, Bus, AlertTriangle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import StatusBadge from '@/components/StatusBadge';
import { cn } from '@/lib/utils';
import type { Point } from '@/types';

export default function Points() {
  const { points } = useStore();
  const [search, setSearch] = useState('');
  return <div>Points</div>;
}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <p className="text-slate-600">
                          批次ID：<span className="font-mono text-slate-700">{batch.batchId}</span>
                        </p>
                        <p className="text-slate-600">来源：{batch.source}</p>
                        <p className="text-slate-600 flex items-center gap-1">
                          <Clock size={12} />
                          {formatDateTime(batch.importedAt)}
                        </p>
                        <p className="text-slate-600 flex items-center gap-1">
                          <Bus size={12} className="text-blue-500" />
                          {batch.busCardTime}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedPoint.hasConstructionDetour && (
                <div className="flex items-start gap-3 pt-2 border-t border-slate-100">
                  <span className="text-sm text-slate-500 w-20 flex-shrink-0 pt-1">施工改道</span>
                  <div className="flex-1">
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 mb-3">
                      <div className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle size={16} />
                        <span className="text-sm font-medium">存在施工改道</span>
                      </div>
                      <p className="text-xs text-amber-600 mt-1">
                        {selectedPoint.mapSynced ? '地图已同步' : '地图未同步，待复核'}
                      </p>
                    </div>
                    {selectedPoint.reviewStatus === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            approveReview(selectedPoint.id);
                            setSelectedPoint({
                              ...selectedPoint,
                              reviewStatus: 'approved',
                              status: 'normal',
                              mapSynced: true,
                            });
                          }}
                          className="flex-1 flex items-center justify-center gap-1 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600"
                        >
                          <CheckCircle size={16} />
                          通过
                        </button>
                        <button
                          onClick={() => {
                            rejectReview(selectedPoint.id);
                            setSelectedPoint({
                              ...selectedPoint,
                              reviewStatus: 'rejected',
                            });
                          }}
                          className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
                        >
                          <XCircle size={16} />
                          驳回
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
                            <span className="text-slate-700">{batch.busCardTime || '暂无数据'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={16} className="text-purple-600" />
                    <p className="text-sm font-medium text-purple-800">红线图备注</p>
                  </div>
                  <p className="text-sm text-purple-700">
                    {selectedPointData.redLineNote || '暂无备注'}
                  </p>
                </div>
              </div>

              {selectedPointData.hasConstructionDetour && (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-amber-600" />
                      <p className="text-sm font-medium text-amber-800">施工临时改道提示</p>
                    </div>
                    {getReviewStatusBadge(selectedPointData.reviewStatus)}
                  </div>
                  <p className="text-sm text-amber-700 mb-3">
                    {selectedPointData.mapSynced
                      ? '地图已同步改道信息'
                      : '⚠️ 施工临时改道没有同步到地图，请居民代表复核'}
                  </p>
                  {selectedPointData.reviewStatus === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          approveReview(selectedPointData.id);
                          setSelectedPoint(null);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white rounded text-sm hover:bg-emerald-600 transition-colors"
                      >
                        <CheckCircle size={14} />
                        通过复核
                      </button>
                      <button
                        onClick={() => {
                          rejectReview(selectedPointData.id);
                          setSelectedPoint(null);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
                      >
                        <XCircle size={14} />
                        驳回
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
