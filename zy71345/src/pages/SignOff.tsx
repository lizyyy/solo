import { useState, useMemo } from 'react';
import {
  Signature,
  Check,
  Clock,
  Search,
  Filter,
  Users,
  Music,
  Calendar,
} from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { StatusBadge } from '../components/common/StatusBadge';

export default function SignOff() {
  const { currentData } = useDataStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPart, setFilterPart] = useState<string>('all');
  const [signedIds, setSignedIds] = useState<Set<string>>(new Set());

  const musiciansWithDist = useMemo(() => {
    return currentData.musicians
      .map((musician) => {
        const part = currentData.parts.find((p) => p.id === musician.partId);
        const distribution = currentData.distributions.find(
          (d) => d.musicianId === musician.id
        );
        const revisionCount = currentData.revisions.filter((r) =>
          r.partIds.includes(musician.partId)
        ).length;
        const receivedRevisions = distribution?.revisionIds.length || 0;
        const hasAllRevisions = receivedRevisions >= revisionCount;
        const hasDistribution = !!distribution;

        return {
          ...musician,
          partName: part?.name || '未知声部',
          category: part?.category || '',
          hasDistribution,
          hasAllRevisions,
          revisionCount,
          receivedRevisions,
          pagesCount: distribution?.pagesReceived.length || 0,
          totalPages: part?.totalPages || 0,
          distributedAt: distribution?.distributedAt || '',
        };
      })
      .filter((m) => {
        if (!searchTerm) return true;
        return (
          m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.partName.toLowerCase().includes(searchTerm.toLowerCase())
        );
      })
      .filter((m) => {
        if (filterPart === 'all') return true;
        return m.partId === filterPart;
      });
  }, [currentData, searchTerm, filterPart]);

  const handleSign = (musicianId: string) => {
    setSignedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(musicianId)) {
        newSet.delete(musicianId);
      } else {
        newSet.add(musicianId);
      }
      return newSet;
    });
  };

  const handleBatchSign = () => {
    const allIds = musiciansWithDist.map((m) => m.id);
    setSignedIds(new Set(allIds));
  };

  const stats = useMemo(() => {
    const total = musiciansWithDist.length;
    const signed = signedIds.size;
    const hasDist = musiciansWithDist.filter((m) => m.hasDistribution).length;
    const hasRev = musiciansWithDist.filter((m) => m.hasAllRevisions).length;
    return { total, signed, hasDist, hasRev };
  }, [musiciansWithDist, signedIds]);

  if (currentData.musicians.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <Signature className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-gray-800 mb-2">暂无乐手数据</h2>
        <p className="text-gray-500">请先导入乐手数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-serif font-bold text-gray-800">签收管理</h2>
          <p className="text-gray-500 mt-1">确认乐手已收到完整的乐谱材料</p>
        </div>
        <button
          onClick={handleBatchSign}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          <Check className="w-4 h-4" />
          <span>批量全部签收</span>
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              <p className="text-sm text-gray-500">总乐手数</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Signature className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.signed}</p>
              <p className="text-sm text-gray-500">已签收</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Music className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.hasDist}</p>
              <p className="text-sm text-gray-500">有发放记录</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.hasRev}</p>
              <p className="text-sm text-gray-500">修订页齐全</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="搜索乐手姓名或声部..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <select
              value={filterPart}
              onChange={(e) => setFilterPart(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">全部声部</option>
              {currentData.parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 w-12">
                  签收
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  乐手
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  声部
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  角色
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                  页码
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                  修订页
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  发放时间
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  状态
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {musiciansWithDist.map((musician) => (
                <tr key={musician.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleSign(musician.id)}
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                        signedIds.has(musician.id)
                          ? 'bg-green-500 border-green-500'
                          : 'border-gray-300 hover:border-primary-500'
                      }`}
                    >
                      {signedIds.has(musician.id) && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800">{musician.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{musician.partName}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{musician.role}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-sm font-medium ${
                        musician.pagesCount >= musician.totalPages
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {musician.pagesCount}/{musician.totalPages}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-sm font-medium ${
                        musician.hasAllRevisions ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {musician.receivedRevisions}/{musician.revisionCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">
                      {musician.distributedAt || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {signedIds.has(musician.id) ? (
                      <StatusBadge status="success">已签收</StatusBadge>
                    ) : musician.hasDistribution && musician.hasAllRevisions ? (
                      <StatusBadge status="warning">待签收</StatusBadge>
                    ) : (
                      <StatusBadge status="error">材料不全</StatusBadge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-50 border-t">
          <span className="text-sm text-gray-500">
            共 {musiciansWithDist.length} 名乐手，已签收 {signedIds.size} 人
          </span>
        </div>
      </div>
    </div>
  );
}
