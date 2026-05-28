import React from 'react';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: string;
  data: any;
}

export const DetailModal: React.FC<DetailModalProps> = ({ isOpen, onClose, type, data }) => {
  if (!isOpen || !data) return null;

  const renderRecordDetail = () => {
    const record = data;
    return (
      <div>
        <div className="flex gap-4 mb-4">
          <img
            src={record.imageUrl}
            alt={record.title}
            className="w-32 h-32 object-cover rounded-lg shadow-lg"
          />
          <div>
            <h3 className="text-xl font-bold text-gray-800">{record.title}</h3>
            <p className="text-gray-600">{record.artist}</p>
            <div className="flex gap-2 mt-2">
              <span className="text-sm bg-amber-100 text-amber-700 px-2 py-1 rounded">
                {record.genre}
              </span>
              <span className={`text-sm px-2 py-1 rounded ${
                record.rarity === 'legendary' ? 'bg-yellow-100 text-yellow-700' :
                record.rarity === 'rare' ? 'bg-blue-100 text-blue-700' :
                record.rarity === 'uncommon' ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {record.rarity === 'legendary' ? '传奇' :
                 record.rarity === 'rare' ? '稀有' :
                 record.rarity === 'uncommon' ? '少见' : '普通'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">进货价</p>
            <p className="text-lg font-bold text-gray-800">¥{record.purchasePrice}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">建议售价</p>
            <p className="text-lg font-bold text-green-600">¥{record.suggestedPrice}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">人气指数</p>
            <p className="text-lg font-bold text-gray-800">{record.popularity}/100</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">预期利润</p>
            <p className="text-lg font-bold text-green-600">
              ¥{record.suggestedPrice - record.purchasePrice}
            </p>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="font-medium text-gray-700 mb-1">📝 描述</h4>
          <p className="text-gray-600 text-sm">{record.description}</p>
        </div>

        <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
          <h4 className="font-medium text-amber-800 mb-1">📌 来源追溯</h4>
          <p className="text-amber-700 text-sm">{record.source}</p>
        </div>
      </div>
    );
  };

  const renderCustomerDetail = () => {
    const customer = data;
    return (
      <div>
        <div className="flex items-center gap-4 mb-4">
          <span className="text-5xl">{customer.avatar}</span>
          <div>
            <h3 className="text-xl font-bold text-gray-800">{customer.name}</h3>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="font-medium text-gray-700 mb-2">🎵 偏好风格</h4>
          <div className="flex flex-wrap gap-2">
            {customer.favoriteGenres.map((genre: string) => (
              <span
                key={genre}
                className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">预算范围</p>
            <p className="text-lg font-bold text-gray-800">¥{customer.budget}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">出价意愿</p>
            <p className="text-lg font-bold text-green-600">
              {(customer.willingnessToPay * 100).toFixed(0)}%
            </p>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="font-medium text-gray-700 mb-1">📝 顾客画像</h4>
          <p className="text-gray-600 text-sm">{customer.description}</p>
        </div>

        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-800 mb-1">📌 来源信息</h4>
          <p className="text-blue-700 text-sm">{customer.source}</p>
        </div>
      </div>
    );
  };

  const renderInventoryDetail = () => {
    const { item, record } = data;
    return (
      <div>
        <div className="flex gap-4 mb-4">
          <img
            src={record.imageUrl}
            alt={record.title}
            className="w-24 h-24 object-cover rounded-lg shadow-lg"
          />
          <div>
            <h3 className="text-xl font-bold text-gray-800">{record.title}</h3>
            <p className="text-gray-600">{record.artist} · {record.genre}</p>
            <p className="text-lg font-medium text-gray-700 mt-1">库存: {item.quantity} 张</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">进货成本</p>
            <p className="text-lg font-bold text-gray-800">¥{item.purchasePrice}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">当前售价</p>
            <p className="text-lg font-bold text-green-600">¥{item.currentPrice}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">在库天数</p>
            <p className={`text-lg font-bold ${item.daysInStock >= 7 ? 'text-orange-600' : 'text-gray-800'}`}>
              {item.daysInStock} 天
            </p>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="font-medium text-gray-700 mb-2">📦 进货历史</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {item.purchaseHistory.map((h: any, i: number) => (
              <div key={i} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                <span>第 {h.day} 天</span>
                <span>x{h.quantity} @ ¥{h.price}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-green-50 p-3 rounded-lg border border-green-200">
          <h4 className="font-medium text-green-800 mb-1">📌 唱片来源</h4>
          <p className="text-green-700 text-sm">{record.source}</p>
        </div>
      </div>
    );
  };

  const getTitle = () => {
    switch (type) {
      case 'record': return '唱片详情';
      case 'customer': return '顾客档案';
      case 'inventory': return '库存详情';
      default: return '详情';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">{getTitle()}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
          >
            ✕
          </button>
        </div>
        <div className="p-4">
          {type === 'record' && renderRecordDetail()}
          {type === 'customer' && renderCustomerDetail()}
          {type === 'inventory' && renderInventoryDetail()}
        </div>
      </div>
    </div>
  );
};
