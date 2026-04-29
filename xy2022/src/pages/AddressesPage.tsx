import { useState } from 'react';
import { Header, EmptyState, Tag } from '../components/UI';
import { useToast } from '../components/Toast';
import { useAppStore } from '../store/appStore';
import { sampleAddresses } from '../data/mockData';
import type { Address } from '../types';

const AddressesPage = () => {
  const { showToast } = useToast();
  const { addresses, addAddress, updateAddress, deleteAddress, fetchAddresses } =
    useAppStore();

  const [showModal, setShowModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [formData, setFormData] = useState<Partial<Address>>({});

  const allAddresses = [
    ...sampleAddresses,
    ...addresses.filter((a) => !sampleAddresses.find((s) => s.id === a.id)),
  ];

  const handleAdd = () => {
    setEditingAddress(null);
    setFormData({
      province: '广东省',
      city: '深圳市',
      district: '南山区',
      isDefault: addresses.length === 0 && sampleAddresses.length === 0,
    });
    setShowModal(true);
  };

  const handleEdit = (address: Address) => {
    setEditingAddress(address);
    setFormData({ ...address });
    setShowModal(true);
  };

  const handleDelete = (addressId: string) => {
    if (confirm('确定要删除这个地址吗？')) {
      deleteAddress(addressId);
      showToast('删除成功');
    }
  };

  const handleSetDefault = (addressId: string) => {
    const addr = allAddresses.find((a) => a.id === addressId);
    if (addr) {
      const existsInStorage = addresses.find((a) => a.id === addressId);
      if (existsInStorage) {
        updateAddress({ ...addr, isDefault: true });
      } else {
        addAddress({
          name: addr.name,
          phone: addr.phone,
          province: addr.province,
          city: addr.city,
          district: addr.district,
          detail: addr.detail,
          isDefault: true,
        });
      }
      showToast('已设为默认地址');
      fetchAddresses();
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.phone || !formData.detail) {
      showToast('请填写完整地址信息');
      return;
    }

    if (editingAddress) {
      updateAddress({
        ...editingAddress,
        ...formData,
      } as Address);
      showToast('更新成功');
    } else {
      addAddress({
        name: formData.name!,
        phone: formData.phone!,
        province: formData.province || '广东省',
        city: formData.city || '深圳市',
        district: formData.district || '南山区',
        detail: formData.detail!,
        isDefault: formData.isDefault || false,
      });
      showToast('添加成功');
    }

    setShowModal(false);
    fetchAddresses();
  };

  return (
    <div className="page-container" style={{ paddingBottom: 100 }}>
      <Header title="收货地址" />

      {allAddresses.length === 0 ? (
        <EmptyState
          icon="📍"
          title="暂无收货地址"
          desc="添加收货地址，方便预约服务"
          action={
            <button className="btn btn-primary btn-sm" onClick={handleAdd}>
              添加地址
            </button>
          }
        />
      ) : (
        <>
          <p className="text-sm text-secondary px-5 py-3">
            共 {allAddresses.length} 个地址
          </p>
          {allAddresses.map((address) => (
            <div key={address.id} className="address-card">
              <div className="icon-wrap">
                <span className="icon">📍</span>
              </div>
              <div className="info flex-1">
                <div className="flex items-center gap-2">
                  <span className="name">{address.name}</span>
                  <span className="text-secondary">{address.phone}</span>
                  {address.isDefault && <Tag variant="primary">默认</Tag>}
                </div>
                <p className="address-text">
                  {address.province}
                  {address.city}
                  {address.district}
                  {address.detail}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleEdit(address)}
                >
                  编辑
                </button>
                {!address.isDefault && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSetDefault(address.id)}
                  >
                    设为默认
                  </button>
                )}
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#FF3B30' }}
                  onClick={() => handleDelete(address.id)}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      <div className="bottom-actions">
        <button className="btn btn-primary btn-full" onClick={handleAdd}>
          + 新增地址
        </button>
      </div>

      {showModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{editingAddress ? '编辑地址' : '新增地址'}</h3>
              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="input-group">
              <label>收货人 *</label>
              <input
                placeholder="请输入收货人姓名"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>联系电话 *</label>
              <input
                placeholder="请输入联系电话"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>所在区域</label>
              <div className="flex gap-2">
                <select
                  className="flex-1"
                  value={formData.district || '南山区'}
                  onChange={(e) =>
                    setFormData({ ...formData, district: e.target.value })
                  }
                >
                  <option value="南山区">南山区</option>
                  <option value="福田区">福田区</option>
                  <option value="罗湖区">罗湖区</option>
                  <option value="宝安区">宝安区</option>
                  <option value="龙华区">龙华区</option>
                </select>
              </div>
            </div>

            <div className="input-group">
              <label>详细地址 *</label>
              <input
                placeholder="小区/楼栋/门牌号"
                value={formData.detail || ''}
                onChange={(e) => setFormData({ ...formData, detail: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) =>
                  setFormData({ ...formData, isDefault: e.target.checked })
                }
              />
              <label htmlFor="isDefault" className="text-sm">
                设为默认地址
              </label>
            </div>

            <button className="btn btn-primary btn-full" onClick={handleSave}>
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressesPage;
