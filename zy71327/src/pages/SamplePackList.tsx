import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { SamplePackCard } from '@/components/features/SamplePackCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/Input';
import type { LicenseType } from '@/types';
import { LICENSE_TYPE_LABELS } from '@/types';

export default function SamplePackList() {
  const { samplePacks, addSamplePack } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    vendor: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    licenseType: 'perpetual' as LicenseType,
    expiryDate: '',
    price: '',
    notes: '',
  });

  const filteredPacks = samplePacks.filter(
    (pack) =>
      pack.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pack.vendor.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addSamplePack({
      name: formData.name,
      vendor: formData.vendor,
      purchaseDate: formData.purchaseDate,
      licenseType: formData.licenseType,
      expiryDate: formData.expiryDate || undefined,
      price: formData.price ? Number(formData.price) : undefined,
      notes: formData.notes || undefined,
    });
    setIsModalOpen(false);
    setFormData({
      name: '',
      vendor: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      licenseType: 'perpetual',
      expiryDate: '',
      price: '',
      notes: '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">采样包管理</h1>
          <p className="text-gray-500 mt-1">管理所有采样包及其授权信息</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4" />
          新建采样包
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="搜索采样包名称或供应商..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredPacks.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Search className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-[#1A1A2E]">没有找到采样包</h3>
          <p className="text-gray-500 mt-2">
            {searchQuery ? '尝试修改搜索条件' : '点击上方按钮添加第一个采样包'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPacks.map((pack, index) => (
            <div
              key={pack.id}
              className="animate-in fade-in slide-in-from-bottom-4 duration-500"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <SamplePackCard pack={pack} />
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="新建采样包"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="采样包名称"
              name="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：Neon Dreams Collection"
              required
            />
            <Input
              label="供应商"
              name="vendor"
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              placeholder="例如：Synthwave Samples Co."
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="购买日期"
              name="purchaseDate"
              type="date"
              value={formData.purchaseDate}
              onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
              required
            />
            <Select
              label="授权类型"
              name="licenseType"
              value={formData.licenseType}
              onChange={(e) =>
                setFormData({ ...formData, licenseType: e.target.value as LicenseType })
              }
              options={Object.entries(LICENSE_TYPE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <Input
              label="到期日期（非永久必填）"
              name="expiryDate"
              type="date"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
            />
          </div>

          <Input
            label="购买价格（元）"
            name="price"
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            placeholder="可选"
          />

          <TextArea
            label="备注"
            name="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="可选，记录授权范围、使用限制等重要信息"
            rows={3}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
            >
              取消
            </Button>
            <Button type="submit">创建采样包</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
