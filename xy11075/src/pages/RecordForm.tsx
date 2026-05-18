import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Upload } from 'lucide-react';
import { DeductionItem, DeductionStatus, calculateTotalScore } from '../../shared/types';

const RecordForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [items, setItems] = useState<DeductionItem[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData] = useState({
    storeId: '',
    storeName: '',
    inspectorId: 'ins-001',
    inspectorName: '王督导',
    inspectionDate: new Date().toISOString().split('T')[0],
    details: [] as Array<{
      itemId: string;
      itemName: string;
      score: number;
      remark: string;
      photos: Array<{ id: string; url: string; hash: string; fileName: string }>;
    }>,
  });

  useEffect(() => {
    const fetchData = async () => {
      const itemsRes = await fetch('/api/deduction-items');
      const itemsData = await itemsRes.json();
      setItems(itemsData);

      const storesRes = await fetch('/api/stores');
      const storesData = await storesRes.json();
      setStores(storesData);

      if (isEdit) {
        const recordRes = await fetch(`/api/records/${id}`);
        const recordData = await recordRes.json();
        setFormData({
          storeId: recordData.storeId,
          storeName: recordData.storeName,
          inspectorId: recordData.inspectorId,
          inspectorName: recordData.inspectorName,
          inspectionDate: recordData.inspectionDate,
          details: recordData.details.map((d: any) => ({
            itemId: d.itemId,
            itemName: d.itemName,
            score: d.score,
            remark: d.remark,
            photos: d.photos || [],
          })),
        });
      }
    };

    fetchData();
  }, [id, isEdit]);

  const handleStoreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const store = stores.find(s => s.id === e.target.value);
    setFormData({
      ...formData,
      storeId: e.target.value,
      storeName: store?.name || '',
    });
  };

  const addDetail = () => {
    setFormData({
      ...formData,
      details: [...formData.details, {
        itemId: '',
        itemName: '',
        score: 0,
        remark: '',
        photos: [],
      }],
    });
  };

  const updateDetail = (index: number, field: string, value: any) => {
    const newDetails = [...formData.details];
    if (field === 'itemId') {
      const item = items.find(i => i.id === value);
      newDetails[index] = {
        ...newDetails[index],
        itemId: value,
        itemName: item?.name || '',
        score: item?.maxScore || 0,
      };
    } else {
      newDetails[index] = { ...newDetails[index], [field]: value };
    }
    setFormData({ ...formData, details: newDetails });
  };

  const removeDetail = (index: number) => {
    setFormData({
      ...formData,
      details: formData.details.filter((_, i) => i !== index),
    });
  };

  const handlePhotoUpload = (detailIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPhotos = Array.from(files).map(file => ({
      id: `photo-${Date.now()}-${Math.random()}`,
      url: URL.createObjectURL(file),
      hash: `hash-${Date.now()}-${Math.random()}`,
      fileName: file.name,
    }));

    const newDetails = [...formData.details];
    newDetails[detailIndex] = {
      ...newDetails[detailIndex],
      photos: [...newDetails[detailIndex].photos, ...newPhotos],
    };
    setFormData({ ...formData, details: newDetails });
  };

  const removePhoto = (detailIndex: number, photoIndex: number) => {
    const newDetails = [...formData.details];
    newDetails[detailIndex] = {
      ...newDetails[detailIndex],
      photos: newDetails[detailIndex].photos.filter((_, i) => i !== photoIndex),
    };
    setFormData({ ...formData, details: newDetails });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.storeId) {
      alert('请选择门店');
      return;
    }

    if (formData.details.length === 0) {
      alert('请至少添加一项扣分明细');
      return;
    }

    const invalidDetail = formData.details.find(d => !d.itemId || d.score <= 0);
    if (invalidDetail) {
      alert('请完善扣分明细信息');
      return;
    }

    try {
      const url = isEdit ? `/api/records/${id}` : '/api/records';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          submissionSource: 'PC',
          status: isEdit ? DeductionStatus.DRAFT : DeductionStatus.DRAFT,
        }),
      });

      if (res.ok) {
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to save record:', error);
    }
  };

  const totalScore = calculateTotalScore(formData.details);

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? '编辑扣分记录' : '新增扣分记录'}
          </h1>
          <p className="text-gray-500">填写巡店扣分明细</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="label">门店 *</label>
              <select
                value={formData.storeId}
                onChange={handleStoreChange}
                className="input"
                required
                disabled={isEdit}
              >
                <option value="">请选择门店</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">巡店日期 *</label>
              <input
                type="date"
                value={formData.inspectionDate}
                onChange={(e) => setFormData({ ...formData, inspectionDate: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">巡店督导</label>
              <input
                type="text"
                value={formData.inspectorName}
                className="input bg-gray-50"
                disabled
              />
            </div>
            <div>
              <label className="label">当前总扣分</label>
              <div className="text-2xl font-bold text-red-600">-{totalScore} 分</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">扣分明细</h2>
            <button
              type="button"
              onClick={addDetail}
              className="flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加扣分项
            </button>
          </div>

          {formData.details.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>暂无扣分项，请点击上方按钮添加</p>
            </div>
          ) : (
            <div className="space-y-4">
              {formData.details.map((detail, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-4">
                    <span className="font-medium text-gray-900">扣分项 {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeDetail(index)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="label">扣分项目 *</label>
                      <select
                        value={detail.itemId}
                        onChange={(e) => updateDetail(index, 'itemId', e.target.value)}
                        className="input"
                        required
                      >
                        <option value="">请选择扣分项</option>
                        {items.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.name} (最高 -{item.maxScore} 分)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">扣分数值 *</label>
                      <input
                        type="number"
                        value={detail.score}
                        onChange={(e) => updateDetail(index, 'score', parseInt(e.target.value) || 0)}
                        className="input"
                        min={1}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="label">备注说明</label>
                    <textarea
                      value={detail.remark}
                      onChange={(e) => updateDetail(index, 'remark', e.target.value)}
                      className="input"
                      rows={2}
                      placeholder="请输入备注说明（选填）"
                    />
                  </div>

                  <div>
                    <label className="label">现场照片</label>
                    <div className="mb-3">
                      <label className="flex items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors">
                        <Upload className="w-5 h-5 text-gray-400" />
                        <span className="text-sm text-gray-500">点击上传照片</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handlePhotoUpload(index, e)}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {detail.photos.length > 0 && (
                      <div className="grid grid-cols-4 gap-3">
                        {detail.photos.map((photo, photoIndex) => (
                          <div key={photo.id} className="relative group">
                            <img
                              src={photo.url}
                              alt={photo.fileName}
                              className="w-full h-20 object-cover rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => removePhoto(index, photoIndex)}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                            <p className="text-xs text-gray-500 mt-1 truncate">{photo.fileName}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            取消
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 transition-colors font-medium"
          >
            保存为草稿
          </button>
        </div>
      </form>
    </div>
  );
};

export default RecordForm;
