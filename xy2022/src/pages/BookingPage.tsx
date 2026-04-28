import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Header, Stepper, Tag, Rating, PriceBreakdown } from '../components/UI';
import BottomTabBar from '../components/BottomTabBar';
import { useToast } from '../components/Toast';
import {
  serviceTypes,
  serviceOptions,
  additionalServices,
  feeders,
  dogBreeds,
  dogPersonalities,
} from '../data/mockData';
import { sampleAddresses, sampleDogs } from '../data/mockData';
import { priceCalculator } from '../services/api';
import { useAppStore } from '../store/appStore';
import type {
  ServiceOption,
  Address,
  DogInfo,
  Feeder,
} from '../types';

const BookingPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    formData,
    updateFormData,
    resetFormData,
    createOrder,
    addresses,
    dogs,
    fetchAddresses,
    fetchDogs,
    addAddress,
    addDog,
  } = useAppStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showDogModal, setShowDogModal] = useState(false);
  const [showFeederModal, setShowFeederModal] = useState(false);
  const [newAddress, setNewAddress] = useState<Partial<Address>>({});
  const [newDog, setNewDog] = useState<Partial<DogInfo>>({});

  useEffect(() => {
    const serviceParam = searchParams.get('service');
    if (serviceParam && serviceTypes.find((s) => s.id === serviceParam)) {
      updateFormData({
        serviceType: serviceParam,
        serviceItems: serviceOptions[serviceParam]
          .filter((o) => o.price === 0)
          .map((o) => ({ ...o })),
      });
    }
    fetchAddresses();
    fetchDogs();
  }, [searchParams]);

  const steps = [
    { id: 1, title: '服务选择' },
    { id: 2, title: '地址时间' },
    { id: 3, title: '狗狗信息' },
    { id: 4, title: '确认下单' },
  ];

  const selectedService = serviceTypes.find((s) => s.id === formData.serviceType);
  const availableFeeders = feeders.filter(
    (f) => f.available && f.services.includes(formData.serviceType)
  );
  const selectedFeeder = feeders.find((f) => f.id === formData.feederId);

  const priceInfo = priceCalculator.calculateTotal(
    formData.serviceType,
    formData.duration,
    selectedFeeder?.distance || 1,
    formData.isUrgent,
    formData.serviceItems,
    formData.additionalServices
  );

  const handleServiceTypeChange = (serviceId: string) => {
    updateFormData({
      serviceType: serviceId,
      serviceItems: serviceOptions[serviceId]
      .filter((o) => o.price === 0)
      .map((o) => ({ ...o })),
    feederId: '',
  });
};

const handleServiceItemToggle = (item: ServiceOption) => {
  const exists = formData.serviceItems.find((i) => i.id === item.id);
  let newItems: ServiceOption[];
  if (exists) {
    newItems = formData.serviceItems.filter((i) => i.id !== item.id);
  } else {
    newItems = [...formData.serviceItems, { ...item }];
  }
  updateFormData({ serviceItems: newItems });
};

const handleAdditionalServiceToggle = (item: ServiceOption) => {
  const exists = formData.additionalServices.find((i) => i.id === item.id);
  let newItems: ServiceOption[];
  if (exists) {
    newItems = formData.additionalServices.filter((i) => i.id !== item.id);
  } else {
    newItems = [...formData.additionalServices, { ...item }];
  }
  updateFormData({ additionalServices: newItems });
};

const handleAddressSelect = (address: Address) => {
  updateFormData({ address });
  setShowAddressModal(false);
};

const handleDogSelect = (dog: DogInfo) => {
  updateFormData({ dogInfo: dog });
  setShowDogModal(false);
};

const handleFeederSelect = (feeder: Feeder) => {
  updateFormData({ feederId: feeder.id });
  setShowFeederModal(false);
};

const handleSaveAddress = () => {
  if (!newAddress.name || !newAddress.phone || !newAddress.detail) {
    showToast('请填写完整地址信息');
    return;
  }
  const address = addAddress({
    name: newAddress.name!,
    phone: newAddress.phone!,
    province: newAddress.province || '广东省',
    city: newAddress.city || '深圳市',
    district: newAddress.district || '南山区',
    detail: newAddress.detail!,
    isDefault: addresses.length === 0,
  });
  updateFormData({ address });
  setShowAddressModal(false);
  setNewAddress({});
};

const handleSaveDog = () => {
  if (!newDog.name || !newDog.breed) {
    showToast('请填写狗狗基本信息');
    return;
  }
  const dog = addDog({
    name: newDog.name!,
    breed: newDog.breed!,
    age: newDog.age || 1,
    weight: newDog.weight || 10,
    personality: newDog.personality || '温顺亲人',
    isAggressive: newDog.isAggressive || false,
    dietaryRestrictions: newDog.dietaryRestrictions || '',
    avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cute%20dog%20portrait%20friendly&image_size=square',
  });
  updateFormData({ dogInfo: dog });
  setShowDogModal(false);
  setNewDog({});
};

const handleSubmit = () => {
  if (!formData.serviceType) {
    showToast('请选择服务类型');
    setCurrentStep(1);
    return;
  }
  if (!formData.address) {
    showToast('请选择服务地址');
    setCurrentStep(2);
    return;
  }
  if (!formData.appointmentTime) {
    showToast('请选择上门时间');
    setCurrentStep(2);
    return;
  }
  if (!formData.dogInfo) {
    showToast('请选择狗狗信息');
    setCurrentStep(3);
    return;
  }
  if (!formData.feederId) {
    const available = feeders.find(
      (f) => f.available && f.services.includes(formData.serviceType)
    );
    if (available) {
      updateFormData({ feederId: available.id });
    }
  }

  const order = createOrder({
    serviceType: formData.serviceType,
    serviceItems: formData.serviceItems,
    address: formData.address!,
    appointmentTime: formData.appointmentTime,
    duration: formData.duration,
    dogInfo: formData.dogInfo!,
    specialNotes: formData.specialNotes,
    feederId: formData.feederId || availableFeeders[0]?.id || '',
    feederName: selectedFeeder?.name || availableFeeders[0]?.name || '',
    feederAvatar:
      selectedFeeder?.avatar || availableFeeders[0]?.avatar || '',
    isUrgent: formData.isUrgent,
    additionalServices: formData.additionalServices,
    totalAmount: priceInfo.total,
    videos: [],
    photos: [],
  });

  showToast('订单创建成功！');
  resetFormData();
  navigate(`/orders/${order.id}`);
};

const canProceed = () => {
  switch (currentStep) {
    case 1:
      return formData.serviceType && formData.serviceItems.length > 0;
    case 2:
      return formData.address && formData.appointmentTime;
    case 3:
      return formData.dogInfo;
    case 4:
      return true;
    default:
      return false;
  }
};

const renderStep1 = () => (
  <div>
    <h2 className="section-title">选择服务类型</h2>
    <div className="service-grid">
      {serviceTypes.map((service) => (
        <div
          key={service.id}
          className={`service-item ${
            formData.serviceType === service.id ? 'selected' : ''
          }`}
          onClick={() => handleServiceTypeChange(service.id)}
          style={{
            padding: 12,
            borderRadius: 12,
            background:
              formData.serviceType === service.id ? '#FFF0EB' : '#fff',
            border:
              formData.serviceType === service.id
                ? '2px solid #FF6B35'
                : '2px solid transparent',
          }}
        >
          <div className="icon-wrapper">
            <span className="icon">{service.icon}</span>
          </div>
          <span className="name">{service.name}</span>
          <span className="text-xs" style={{ color: '#FF6B35', marginTop: 2 }}>
            ¥{service.basePrice}
          </span>
        </div>
      ))}
    </div>

    {selectedService && (
      <>
        <h2 className="section-title">服务项目</h2>
        <div className="card">
          <p className="text-sm text-secondary mb-3">
            {selectedService.description}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {serviceOptions[formData.serviceType]?.map((item) => {
              const isSelected = formData.serviceItems.some(
                (i) => i.id === item.id
              );
              return (
                <div
                  key={item.id}
                  className={`checkbox-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleServiceItemToggle(item)}
                >
                  <input type="checkbox" checked={isSelected} readOnly />
                  <div className="flex-1">
                    <span className="font-medium">{item.name}</span>
                  </div>
                  {item.price > 0 && (
                    <span className="text-orange font-medium">+¥{item.price}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </>
    )}
  </div>
);

const renderStep2 = () => (
  <div>
    <h2 className="section-title">服务地址</h2>
    {formData.address ? (
      <div
        className="address-card"
        onClick={() => setShowAddressModal(true)}
      >
        <div className="icon-wrap">
          <span className="icon">📍</span>
        </div>
        <div className="info">
          <div className="flex items-center gap-2">
            <span className="name">{formData.address.name}</span>
            <span className="text-secondary">{formData.address.phone}</span>
          </div>
          <p className="address-text">
            {formData.address.province}
            {formData.address.city}
            {formData.address.district}
            {formData.address.detail}
          </p>
          {formData.address.isDefault && (
            <Tag variant="primary" style={{ marginTop: 4 }}>
              默认地址
            </Tag>
          )}
        </div>
        <span style={{ color: '#AEAEB2' }}>›</span>
      </div>
    ) : (
      <div
        className="card flex items-center justify-center"
        style={{ cursor: 'pointer' }}
        onClick={() => setShowAddressModal(true)}
      >
        <span style={{ fontSize: 24, marginRight: 8 }}>+</span>
        <span className="text-secondary">添加服务地址</span>
      </div>
    )}

    <h2 className="section-title">上门时间</h2>
    <div className="card">
      <div className="input-group" style={{ marginBottom: 0 }}>
        <label>选择日期时间</label>
        <input
          type="datetime-local"
          value={formData.appointmentTime ? formData.appointmentTime.slice(0, 16) : ''}
          onChange={(e) =>
            updateFormData({ appointmentTime: e.target.value + ':00' })
          }
          min={new Date().toISOString().slice(0, 16)}
        />
      </div>
    </div>

    <h2 className="section-title">服务时长</h2>
    <div className="card">
      <div className="flex justify-between items-center">
        <span className="font-medium">服务时长</span>
        <Stepper
          value={formData.duration}
          min={1}
          max={24}
          unit={selectedService?.unit === '天' ? '天' : '次'}
          onChange={(val) => updateFormData({ duration: val })}
        />
      </div>
    </div>

    <h2 className="section-title">加急服务</h2>
    <div
      className="card"
      onClick={() => updateFormData({ isUrgent: !formData.isUrgent })}
      style={{ cursor: 'pointer' }}
    >
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">⚡ 紧急加急</span>
            <Tag variant="danger">+25元</Tag>
          </div>
          <p className="text-sm text-secondary mt-1">
            1小时内安排喂养师上门
          </p>
        </div>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            border: `2px solid ${formData.isUrgent ? '#FF6B35' : '#C6C6C8'}`,
            background: formData.isUrgent ? '#FF6B35' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}
        >
          {formData.isUrgent && '✓'}
        </div>
      </div>
    </div>
  </div>
);

const renderStep3 = () => (
  <div>
    <h2 className="section-title">选择狗狗</h2>
    {formData.dogInfo ? (
      <div
        className="dog-card"
        onClick={() => setShowDogModal(true)}
        style={{ cursor: 'pointer' }}
      >
        <img
          src={formData.dogInfo.avatar}
          alt={formData.dogInfo.name}
          className="avatar"
        />
        <div className="info">
          <div className="name-row">
            <span className="name">{formData.dogInfo.name}</span>
            <Tag variant="info">{formData.dogInfo.breed}</Tag>
          </div>
          <div className="meta">
            <span className="meta-item">{formData.dogInfo.age}岁</span>
            <span className="meta-item">{formData.dogInfo.weight}kg</span>
          </div>
          <p className="personality">性格：{formData.dogInfo.personality}</p>
          {formData.dogInfo.isAggressive && (
            <Tag variant="danger" style={{ marginTop: 4 }}>
              需注意安全
            </Tag>
          )}
        </div>
        <span style={{ color: '#AEAEB2' }}>›</span>
      </div>
    ) : (
      <div
        className="card flex items-center justify-center"
        style={{ cursor: 'pointer' }}
        onClick={() => setShowDogModal(true)}
      >
        <span style={{ fontSize: 24, marginRight: 8 }}>+</span>
        <span className="text-secondary">添加狗狗档案</span>
      </div>
    )}

    {formData.dogInfo && (
      <>
        <h2 className="section-title">特殊备注</h2>
        <div className="card">
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>特殊需求/注意事项</label>
            <textarea
              placeholder="例如：怕生、分离焦虑、不能喂零食、需牵绳范围等"
              value={formData.specialNotes}
              onChange={(e) => updateFormData({ specialNotes: e.target.value })}
              rows={4}
            />
          </div>
        </div>

        <h2 className="section-title">附加增值服务</h2>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {additionalServices.map((item) => {
              const isSelected = formData.additionalServices.some(
                (i) => i.id === item.id
              );
              return (
                <div
                  key={item.id}
                  className={`checkbox-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleAdditionalServiceToggle(item)}
                >
                  <input type="checkbox" checked={isSelected} readOnly />
                  <div className="flex-1">
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <span className="text-orange font-medium">+¥{item.price}</span>
                </div>
              );
            })}
          </div>
        </div>
      </>
    )}
  </div>
);

const renderStep4 = () => (
  <div>
    <h2 className="section-title">选择喂养师</h2>
    {selectedFeeder ? (
      <div
        className="feeder-card"
        style={{ margin: '0 20px 16px', cursor: 'pointer' }}
        onClick={() => setShowFeederModal(true)}
      >
        <div className="avatar-wrap">
          <img
            src={selectedFeeder.avatar}
            alt={selectedFeeder.name}
            className="avatar"
            style={{ width: 56, height: 56 }}
          />
          <span className="status-dot" />
        </div>
        <div className="info">
          <div className="name-row">
            <span className="name">{selectedFeeder.name}</span>
            <span className="exp">{selectedFeeder.experience}年经验</span>
          </div>
          <Rating value={selectedFeeder.rating} count={selectedFeeder.reviewCount} />
          <div className="meta" style={{ marginTop: 4 }}>
            <span className="distance">📍 {selectedFeeder.distance}km</span>
            <span className="orders">✅ 完成{selectedFeeder.completedOrders}单</span>
          </div>
        </div>
        <span style={{ color: '#AEAEB2' }}>›</span>
      </div>
    ) : (
      <div
        className="card"
        onClick={() => setShowFeederModal(true)}
        style={{ cursor: 'pointer' }}
      >
        <div className="flex items-center justify-center">
        <span style={{ fontSize: 24, marginRight: 8 }}>🎲</span>
        <span className="text-secondary">系统智能匹配喂养师</span>
      </div>
      <p className="text-xs text-tertiary text-center mt-2">
        系统将为您匹配最合适的喂养师
      </p>
    </div>
  )}

<h2 className="section-title">订单详情</h2>
<div className="card">
  <div className="price-row">
    <span className="label">服务类型</span>
    <span className="value font-medium">{selectedService?.name}</span>
  </div>
  <div className="price-row">
    <span className="label">服务项目</span>
    <span className="value text-sm">
      {formData.serviceItems.map((i) => i.name).join('、')}
    </span>
  </div>
  <div className="price-row">
    <span className="label">服务地址</span>
    <span className="value text-sm text-right">
      {formData.address?.detail}
    </span>
  </div>
  <div className="price-row">
    <span className="label">上门时间</span>
    <span className="value">
      {formData.appointmentTime.replace('T', ' ')}
    </span>
  </div>
  <div className="price-row">
    <span className="label">狗狗</span>
    <span className="value">{formData.dogInfo?.name}</span>
  </div>
  {formData.specialNotes && (
    <div className="price-row">
      <span className="label">特殊备注</span>
      <span className="value text-sm text-right">
        {formData.specialNotes}
      </span>
    </div>
  )}
</div>

<PriceBreakdown
  items={[
    { label: '基础服务', value: priceInfo.basePrice },
    { label: '服务项目', value: priceInfo.serviceFee },
    { label: '距离费用', value: priceInfo.distanceFee },
    { label: '加急服务', value: priceInfo.urgentFee },
    { label: '附加服务', value: priceInfo.additionalFee },
  ]}
  total={priceInfo.total}
/>
</div>
);

return (
  <div className="page-container">
    <Header title="预约服务" />

    <div
      className="flex justify-between px-5 py-4 bg-white">
      {steps.map((step, index) => {
        const isCompleted = currentStep > step.id;
        const isCurrent = currentStep === step.id;
        const canNavigateTo = currentStep >= step.id;
        
        return (
          <div key={step.id} className="flex items-center">
            <div
              className="flex flex-col items-center"
              style={{
                cursor: canNavigateTo ? 'pointer' : 'not-allowed',
              }}
              onClick={() => {
                if (canNavigateTo) {
                  setCurrentStep(step.id);
                }
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: 14,
                  background: isCompleted || isCurrent ? '#FF6B35' : '#E5E5EA',
                  color: isCompleted || isCurrent ? 'white' : '#8E8E93',
                  border: isCurrent ? '2px solid #FF6B35' : 'none',
                }}
              >
                {isCompleted ? '✓' : step.id}
              </div>
              <span
                className="text-xs mt-1"
                style={{
                  color: isCompleted || isCurrent ? '#FF6B35' : '#8E8E93',
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                style={{
                  width: 40,
                  height: 2,
                  background: currentStep > step.id ? '#FF6B35' : '#E5E5EA',
                  marginLeft: 8,
                  marginRight: 8,
                }}
              />
            )}
          </div>
        );
      })}
    </div>

    <div style={{ paddingBottom: 100 }}>
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
      {currentStep === 4 && renderStep4()}
    </div>

    <div className="bottom-actions">
      {currentStep > 1 && (
        <button
          className="btn btn-secondary"
          style={{ padding: '12px 24px' }}
          onClick={() => setCurrentStep(currentStep - 1)}
        >
          上一步
        </button>
      )}
      <div className="flex-1">
        {currentStep < 4 ? (
          <button
            className="btn btn-primary btn-full"
            disabled={!canProceed()}
            onClick={() => setCurrentStep(currentStep + 1)}
          >
            下一步
          </button>
        ) : (
          <button
            className="btn btn-primary btn-full"
            onClick={handleSubmit}
          >
            确认下单 ¥{priceInfo.total}
          </button>
        )}
      </div>
    </div>

    {showAddressModal && (
      <div className="modal-overlay" onClick={() => setShowAddressModal(false)}>
        <div
          className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>选择地址</h3>
            <button
              className="modal-close"
              onClick={() => setShowAddressModal(false)}
            >
              ✕
            </button>
          </div>

          {(addresses.length > 0 || sampleAddresses.length > 0) && (
            <>
              <p className="text-sm text-secondary mb-3">已有地址</p>
              {[...addresses, ...sampleAddresses].map((addr) => (
                <div
                  key={addr.id}
                  className={`radio-item ${
                    formData.address?.id === addr.id ? 'selected' : ''
                  }`}
                  style={{ marginBottom: 8 }}
                  onClick={() => handleAddressSelect(addr)}
                >
                  <input
                    type="radio"
                    checked={formData.address?.id === addr.id}
                    readOnly
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{addr.name}</span>
                      <span className="text-secondary">{addr.phone}</span>
                      {addr.isDefault && <Tag variant="primary">默认</Tag>}
                    </div>
                    <p className="text-sm text-secondary mt-1">
                      {addr.province}
                      {addr.city}
                      {addr.district}
                      {addr.detail}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="divider" />
          <p className="text-sm text-secondary mb-3">添加新地址</p>

          <div className="input-group">
            <label>收货人</label>
            <input
              placeholder="请输入收货人姓名"
              value={newAddress.name || ''}
              onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
            />
          </div>

          <div className="input-group">
            <label>联系电话</label>
            <input
              placeholder="请输入联系电话"
              value={newAddress.phone || ''}
              onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
            />
          </div>

          <div className="input-group">
            <label>所在区域</label>
            <select
              value={newAddress.district || '南山区'}
              onChange={(e) =>
                setNewAddress({ ...newAddress, district: e.target.value })
              }
            >
              <option value="南山区">南山区</option>
              <option value="福田区">福田区</option>
              <option value="罗湖区">罗湖区</option>
              <option value="宝安区">宝安区</option>
              <option value="龙华区">龙华区</option>
            </select>
          </div>

          <div className="input-group">
            <label>详细地址</label>
            <input
              placeholder="小区/楼栋/门牌号"
              value={newAddress.detail || ''}
              onChange={(e) =>
                setNewAddress({ ...newAddress, detail: e.target.value })
              }
            />
          </div>

          <button className="btn btn-primary btn-full" onClick={handleSaveAddress}>
            保存地址
          </button>
        </div>
      </div>
    )}

    {showDogModal && (
      <div className="modal-overlay" onClick={() => setShowDogModal(false)}>
        <div
          className="modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h3>选择狗狗</h3>
            <button
              className="modal-close"
              onClick={() => setShowDogModal(false)}
            >
              ✕
            </button>
          </div>

          {(dogs.length > 0 || sampleDogs.length > 0) && (
            <>
              <p className="text-sm text-secondary mb-3">已有狗狗</p>
              {[...dogs, ...sampleDogs].map((dog) => (
                <div
                  key={dog.id}
                  className={`radio-item ${
                    formData.dogInfo?.id === dog.id ? 'selected' : ''
                  }`}
                  style={{ marginBottom: 8 }}
                  onClick={() => handleDogSelect(dog)}
                >
                  <input
                    type="radio"
                    checked={formData.dogInfo?.id === dog.id}
                    readOnly
                  />
                  <img
                    src={dog.avatar}
                    alt={dog.name}
                    className="avatar avatar-sm"
                    style={{ marginRight: 12 }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{dog.name}</span>
                      <Tag variant="info">{dog.breed}</Tag>
                    </div>
                    <p className="text-sm text-secondary mt-1">
                      {dog.age}岁 · {dog.weight}kg · {dog.personality}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="divider" />
          <p className="text-sm text-secondary mb-3">添加新狗狗</p>

          <div className="input-group">
            <label>狗狗名字</label>
            <input
              placeholder="请输入狗狗名字"
              value={newDog.name || ''}
              onChange={(e) => setNewDog({ ...newDog, name: e.target.value })}
            />
          </div>

          <div className="input-group">
            <label>品种</label>
            <select
              value={newDog.breed || ''}
              onChange={(e) => setNewDog({ ...newDog, breed: e.target.value })}
            >
              <option value="">请选择品种</option>
              {dogBreeds.map((breed) => (
                <option key={breed} value={breed}>
                  {breed}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>年龄（岁）</label>
            <input
              type="number"
              placeholder="请输入年龄"
              value={newDog.age || ''}
              onChange={(e) =>
                setNewDog({ ...newDog, age: Number(e.target.value) })
              }
            />
          </div>

          <div className="input-group">
            <label>体重（kg）</label>
            <input
              type="number"
              placeholder="请输入体重"
              value={newDog.weight || ''}
              onChange={(e) =>
                setNewDog({ ...newDog, weight: Number(e.target.value) })
              }
            />
          </div>

          <div className="input-group">
            <label>性格</label>
            <select
              value={newDog.personality || ''}
              onChange={(e) =>
                setNewDog({ ...newDog, personality: e.target.value })
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
                  checked={!newDog.isAggressive}
                  onChange={() => setNewDog({ ...newDog, isAggressive: false })}
                />
                温顺
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="aggressive"
                  checked={newDog.isAggressive}
                  onChange={() => setNewDog({ ...newDog, isAggressive: true })}
                />
                需注意
              </label>
            </div>
          </div>

          <div className="input-group">
            <label>忌口/饮食禁忌</label>
            <textarea
              placeholder="例如：不能吃巧克力、洋葱，对鸡肉过敏等"
              value={newDog.dietaryRestrictions || ''}
              onChange={(e) =>
                setNewDog({ ...newDog, dietaryRestrictions: e.target.value })
              }
            />
          </div>

          <button className="btn btn-primary btn-full" onClick={handleSaveDog}>
            保存狗狗档案
          </button>
        </div>
      </div>
    )}

    {showFeederModal && (
      <div
        className="modal-overlay"
        onClick={() => setShowFeederModal(false)}
      >
        <div
          className="modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h3>选择喂养师</h3>
            <button
              className="modal-close"
              onClick={() => setShowFeederModal(false)}
            >
              ✕
            </button>
          </div>

          <div
            className={`radio-item ${!formData.feederId ? 'selected' : ''}`}
            style={{ marginBottom: 16 }}
            onClick={() => {
              updateFormData({ feederId: '' });
              setShowFeederModal(false);
            }}
          >
            <input
              type="radio"
              checked={!formData.feederId}
              readOnly
            />
            <div className="flex-1">
              <span className="font-medium">🎲 智能匹配</span>
              <p className="text-sm text-secondary mt-1">
                系统将为您匹配最合适的喂养师
              </p>
            </div>
          </div>

          <p className="text-sm text-secondary mb-3">可选喂养师</p>
          {availableFeeders.map((feeder) => (
            <div
              key={feeder.id}
              className={`radio-item ${
                formData.feederId === feeder.id ? 'selected' : ''
              }`}
              style={{ marginBottom: 8 }}
              onClick={() => handleFeederSelect(feeder)}
            >
              <input
                type="radio"
                checked={formData.feederId === feeder.id}
                readOnly
              />
              <img
                src={feeder.avatar}
                alt={feeder.name}
                className="avatar avatar-sm"
                style={{ marginRight: 12 }}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{feeder.name}</span>
                  <Tag variant="primary">
                    {feeder.experience}年
                  </Tag>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Rating value={feeder.rating} />
                  <span className="text-xs text-secondary">
                    {feeder.distance}km
                  </span>
                </div>
              </div>
            </div>
          ))}

          {availableFeeders.length === 0 && (
            <p className="text-center text-secondary py-4">
              暂无可用喂养师，请更换服务类型
            </p>
          )}
        </div>
      </div>
    )}

    <BottomTabBar />
  </div>
);
};

export default BookingPage;
