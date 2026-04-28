import { useState } from 'react';
import { Header, EmptyState, Tag } from '../components/UI';
import { useToast } from '../components/Toast';
import { useAppStore } from '../store/appStore';
import { sampleDogs, dogBreeds, dogPersonalities } from '../data/mockData';
import type { DogInfo } from '../types';

const DogsPage = () => {
  const { showToast } = useToast();
  const { dogs, addDog, updateDog, deleteDog, fetchDogs } = useAppStore();

  const [showModal, setShowModal] = useState(false);
  const [editingDog, setEditingDog] = useState<DogInfo | null>(null);
  const [formData, setFormData] = useState<Partial<DogInfo>>({});

  const allDogs = [...dogs, ...sampleDogs.filter((s) => !dogs.find((d) => d.id === s.id))];

  const handleAdd = () => {
    setEditingDog(null);
    setFormData({
      age: 1,
      weight: 10,
      isAggressive: false,
      dietaryRestrictions: '',
    });
    setShowModal(true);
  };

  const handleEdit = (dog: DogInfo) => {
    setEditingDog(dog);
    setFormData({ ...dog });
    setShowModal(true);
  };

  const handleDelete = (dogId: string) => {
    if (confirm('确定要删除这只狗狗的档案吗？')) {
      deleteDog(dogId);
      showToast('删除成功');
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.breed) {
      showToast('请填写狗狗名字和品种');
      return;
    }

    const breedPrompt = formData.breed
      ? encodeURIComponent(`cute ${formData.breed} dog portrait friendly happy`)
      : encodeURIComponent('cute dog portrait friendly happy');
    const avatarUrl = `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${breedPrompt}&image_size=square`;

    if (editingDog) {
      updateDog({
        ...editingDog,
        ...formData,
        avatar: avatarUrl,
      } as DogInfo);
      showToast('更新成功');
    } else {
      addDog({
        name: formData.name!,
        breed: formData.breed!,
        age: formData.age || 1,
        weight: formData.weight || 10,
        personality: formData.personality || '温顺亲人',
        isAggressive: formData.isAggressive || false,
        dietaryRestrictions: formData.dietaryRestrictions || '',
        avatar: avatarUrl,
      });
      showToast('添加成功');
    }

    setShowModal(false);
    fetchDogs();
  };

  return (
    <div className="page-container" style={{ paddingBottom: 100 }}>
      <Header title="狗狗档案" />

      {allDogs.length === 0 ? (
        <EmptyState
          icon="🐕"
          title="暂无狗狗档案"
          desc="添加您的爱犬档案，方便预约服务"
          action={
            <button className="btn btn-primary btn-sm" onClick={handleAdd}>
              添加狗狗
            </button>
          }
        />
      ) : (
        <>
          <p className="text-sm text-secondary px-5 py-3">
            共 {allDogs.length} 只狗狗
          </p>
          {allDogs.map((dog) => (
            <div key={dog.id} className="dog-card">
              <img src={dog.avatar} alt={dog.name} className="avatar" />
              <div className="info flex-1">
                <div className="name-row">
                  <span className="name">{dog.name}</span>
                  <Tag variant="info">{dog.breed}</Tag>
                  {dog.isAggressive && <Tag variant="danger">需注意</Tag>}
                </div>
                <div className="meta">
                  <span className="meta-item">{dog.age}岁</span>
                  <span className="meta-item">{dog.weight}kg</span>
                </div>
                <p className="personality">性格：{dog.personality}</p>
                {dog.dietaryRestrictions && (
                  <p className="text-xs text-tertiary mt-1">
                    忌口：{dog.dietaryRestrictions}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleEdit(dog)}
                >
                  编辑
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDelete(dog.id)}
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
          + 添加狗狗
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
              <h3>{editingDog ? '编辑狗狗' : '添加狗狗'}</h3>
              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="input-group">
              <label>狗狗名字 *</label>
              <input
                placeholder="请输入狗狗名字"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>品种 *</label>
              <select
                value={formData.breed || ''}
                onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
              >
                <option value="">请选择品种</option>
                {dogBreeds.map((breed) => (
                  <option key={breed} value={breed}>
                    {breed}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-4">
              <div className="input-group flex-1">
                <label>年龄（岁）</label>
                <input
                  type="number"
                  placeholder="年龄"
                  value={formData.age || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, age: Number(e.target.value) })
                  }
                />
              </div>
              <div className="input-group flex-1">
                <label>体重（kg）</label>
                <input
                  type="number"
                  placeholder="体重"
                  value={formData.weight || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, weight: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="input-group">
              <label>性格</label>
              <select
                value={formData.personality || ''}
                onChange={(e) =>
                  setFormData({ ...formData, personality: e.target.value })
                }
              >
                <option value="">请选择性格</option>
                {dogPersonalities.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>是否咬人/攻击性</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="aggressive"
                    checked={!formData.isAggressive}
                    onChange={() =>
                      setFormData({ ...formData, isAggressive: false })
                    }
                  />
                  温顺
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="aggressive"
                    checked={formData.isAggressive}
                    onChange={() =>
                      setFormData({ ...formData, isAggressive: true })
                    }
                  />
                  需注意
                </label>
              </div>
            </div>

            <div className="input-group">
              <label>忌口/饮食禁忌</label>
              <textarea
                placeholder="例如：不能吃巧克力、洋葱，对鸡肉过敏等"
                value={formData.dietaryRestrictions || ''}
                onChange={(e) =>
                  setFormData({ ...formData, dietaryRestrictions: e.target.value })
                }
              />
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

export default DogsPage;
