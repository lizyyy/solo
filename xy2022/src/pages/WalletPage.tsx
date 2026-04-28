import { useState } from 'react';
import { Header } from '../components/UI';
import { useToast } from '../components/Toast';
import { useAppStore } from '../store/appStore';

const WalletPage = () => {
  const { showToast } = useToast();
  const { wallet, rechargeWallet } = useAppStore();

  const [rechargeAmount, setRechargeAmount] = useState(100);

  const rechargeOptions = [50, 100, 200, 500, 1000];

  const handleRecharge = () => {
    rechargeWallet(rechargeAmount);
    showToast(`充值成功！到账 ¥${rechargeAmount}`);
  };

  return (
    <div className="page-container" style={{ paddingBottom: 100 }}>
      <Header title="我的钱包" />

      <div className="card" style={{ marginTop: 16 }}>
        <p className="text-sm text-secondary mb-2">账户余额</p>
        <p className="text-3xl font-semibold text-orange">¥{wallet.balance}</p>
        <div className="flex gap-6 mt-4">
          <div>
            <p className="text-xs text-secondary">冻结金额</p>
            <p className="font-medium mt-1">¥{wallet.frozen}</p>
          </div>
          <div>
            <p className="text-xs text-secondary">积分</p>
            <p className="font-medium mt-1">{wallet.points}分</p>
          </div>
        </div>
      </div>

      <h2 className="section-title">充值金额</h2>
      <div className="card">
        <div className="grid grid-cols-3 gap-3 mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {rechargeOptions.map((amount) => (
            <div
              key={amount}
              className={`text-center py-3 rounded-lg border-2 cursor-pointer ${
                rechargeAmount === amount
                  ? 'border-orange bg-orange-50'
                  : 'border-gray-200'
              }`}
              style={{
                borderColor: rechargeAmount === amount ? '#FF6B35' : '#E5E5EA',
                background: rechargeAmount === amount ? '#FFF0EB' : 'transparent',
              }}
              onClick={() => setRechargeAmount(amount)}
            >
              <p className="font-semibold text-orange">¥{amount}</p>
              {amount >= 200 && (
                <p className="text-xs text-secondary mt-1">送¥{Math.floor(amount * 0.1)}</p>
              )}
            </div>
          ))}
        </div>

        <div className="input-group">
          <label>自定义金额</label>
          <input
            type="number"
            placeholder="输入充值金额"
            value={rechargeAmount || ''}
            onChange={(e) => setRechargeAmount(Number(e.target.value))}
          />
        </div>
      </div>

      <h2 className="section-title">充值说明</h2>
      <div className="card">
        <p className="text-sm text-secondary">
          1. 充值金额永久有效，不设有效期
        </p>
        <p className="text-sm text-secondary mt-2">
          2. 充值满200元送20元，满500元送50元，满1000元送100元
        </p>
        <p className="text-sm text-secondary mt-2">
          3. 充值金额可用于平台内所有服务消费
        </p>
        <p className="text-sm text-secondary mt-2">
          4. 如有问题请联系在线客服
        </p>
      </div>

      <div className="bottom-actions">
        <button className="btn btn-primary btn-full" onClick={handleRecharge}>
          立即充值 ¥{rechargeAmount}
        </button>
      </div>
    </div>
  );
};

export default WalletPage;
