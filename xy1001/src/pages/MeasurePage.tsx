import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { 
  Measurement, 
  PetType, 
  CoatType, 
  Season, 
  Scenario,
  PET_TYPE_LABELS,
  BODY_SHAPE_LABELS,
  COAT_TYPE_LABELS,
  SEASON_LABELS,
  SCENARIO_LABELS
} from '../types';
import { getBreedsByType, getBreedById } from '../data/breeds';
import { getBodyShapeRulesByPetType, estimateBodyShapeByWeight } from '../data/bodyShapeRules';
import { recommendationService, validateMeasurement } from '../services/recommendationService';

const MeasurePage: React.FC = () => {
  const navigate = useNavigate();
  const { setCurrentMeasurement, setCurrentRecommendation, currentMeasurement } = useAppContext();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<string[]>([]);
  const [showGuide, setShowGuide] = useState(false);

  const [formData, setFormData] = useState<Partial<Measurement>>({
    petType: undefined,
    breedId: undefined,
    bodyShape: undefined,
    coatType: undefined,
    chest: undefined,
    length: undefined,
    neck: undefined,
    weight: undefined,
    season: undefined,
    scenario: undefined,
  });

  useEffect(() => {
    if (currentMeasurement) {
      setFormData(currentMeasurement);
    }
  }, [currentMeasurement]);

  const steps = [
    { step: 1, title: '宠物信息', description: '选择宠物类型和品种' },
    { step: 2, title: '体型特征', description: '选择体型分类和毛发类型' },
    { step: 3, title: '测量数据', description: '输入胸围、背长等数据' },
    { step: 4, title: '使用场景', description: '选择季节和穿着场景' },
  ];

  const petTypes: { value: PetType; label: string; icon: string }[] = [
    { value: 'dog', label: '狗狗', icon: '🐕' },
    { value: 'cat', label: '猫咪', icon: '🐱' },
  ];

  const handlePetTypeChange = (type: PetType) => {
    setFormData(prev => ({
      ...prev,
      petType: type,
      breedId: undefined,
      bodyShape: undefined,
      coatType: undefined,
    }));
  };

  const handleBreedChange = (breedId: string) => {
    const breed = getBreedById(breedId);
    if (breed) {
      setFormData(prev => ({
        ...prev,
        breedId,
        bodyShape: breed.bodyShape,
        coatType: breed.defaultCoatType,
      }));
    }
  };

  const handleWeightChange = (weight: number | undefined) => {
    setFormData(prev => ({
      ...prev,
      weight,
    }));
    
    if (weight !== undefined && formData.petType && !formData.breedId) {
      const estimatedShape = estimateBodyShapeByWeight(formData.petType, weight);
      setFormData(prev => ({
        ...prev,
        bodyShape: estimatedShape,
      }));
    }
  };

  const handleSubmit = () => {
    const { valid, errors: validationErrors } = validateMeasurement(formData as Measurement);
    
    if (!valid) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);

    const measurement = recommendationService.createMeasurement(formData as Omit<Measurement, 'id'>);
    const recommendation = recommendationService.generateRecommendation(measurement);
    
    setCurrentMeasurement(measurement);
    setCurrentRecommendation(recommendation);
    
    navigate('/result');
  };

  const breeds = formData.petType ? getBreedsByType(formData.petType) : [];
  const bodyShapeRules = formData.petType ? getBodyShapeRulesByPetType(formData.petType) : [];
  const selectedBreed = formData.breedId ? getBreedById(formData.breedId) : undefined;

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!formData.petType;
      case 2:
        return !!formData.bodyShape && !!formData.coatType;
      case 3:
        return !!formData.chest && !!formData.length && formData.chest > 0 && formData.length > 0;
      case 4:
        return !!formData.season && !!formData.scenario;
      default:
        return true;
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <label className="form-label">选择宠物类型 *</label>
        <div className="grid grid-cols-2 gap-4">
          {petTypes.map(type => (
            <button
              key={type.value}
              type="button"
              onClick={() => handlePetTypeChange(type.value)}
              className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                formData.petType === type.value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-5xl mb-3">{type.icon}</div>
              <div className="text-lg font-semibold text-gray-800">{type.label}</div>
            </button>
          ))}
        </div>
      </div>

      {formData.petType && (
        <div>
          <label className="form-label">
            选择品种（可选）
            <span className="text-gray-400 text-xs ml-2">选择品种后将自动填充体型和毛发类型</span>
          </label>
          <select
            value={formData.breedId || ''}
            onChange={(e) => e.target.value ? handleBreedChange(e.target.value) : null}
            className="input-field"
          >
            <option value="">-- 请选择品种（可选） --</option>
            <optgroup label="超小型">
              {breeds.filter(b => b.bodyShape === 'toy').map(breed => (
                <option key={breed.id} value={breed.id}>{breed.name}</option>
              ))}
            </optgroup>
            <optgroup label="小型">
              {breeds.filter(b => b.bodyShape === 'small').map(breed => (
                <option key={breed.id} value={breed.id}>{breed.name}</option>
              ))}
            </optgroup>
            <optgroup label="中型">
              {breeds.filter(b => b.bodyShape === 'medium').map(breed => (
                <option key={breed.id} value={breed.id}>{breed.name}</option>
              ))}
            </optgroup>
            <optgroup label="大型">
              {breeds.filter(b => b.bodyShape === 'large').map(breed => (
                <option key={breed.id} value={breed.id}>{breed.name}</option>
              ))}
            </optgroup>
            {breeds.some(b => b.bodyShape === 'giant') && (
              <optgroup label="超大型">
                {breeds.filter(b => b.bodyShape === 'giant').map(breed => (
                  <option key={breed.id} value={breed.id}>{breed.name}</option>
                ))}
              </optgroup>
            )}
          </select>
          
          {selectedBreed && (
            <div className="mt-4 p-4 bg-primary-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-primary-600 font-semibold">{selectedBreed.name}</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{selectedBreed.description}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="badge bg-white text-gray-700">
                  体型: {BODY_SHAPE_LABELS[selectedBreed.bodyShape]}
                </span>
                <span className="badge bg-white text-gray-700">
                  毛发: {COAT_TYPE_LABELS[selectedBreed.defaultCoatType]}
                </span>
                <span className="badge bg-white text-gray-700">
                  体重: {selectedBreed.typicalWeightRange.min}-{selectedBreed.typicalWeightRange.max}kg
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <label className="form-label">
          体型分类 *
          {formData.breedId && (
            <span className="text-primary-500 text-xs ml-2">
              (已根据品种自动选择)
            </span>
          )}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {bodyShapeRules.map(rule => (
            <button
              key={rule.shape}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, bodyShape: rule.shape }))}
              className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                formData.bodyShape === rule.shape
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold text-gray-800">{rule.name}</div>
              <div className="text-xs text-gray-500 mt-1">
                {rule.weightRange.min}-{rule.weightRange.max}kg
              </div>
              <div className="text-xs text-gray-400 mt-1 truncate">
                {rule.examples.slice(0, 2).join('、')}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="form-label">
          毛发类型 *
          {formData.breedId && (
            <span className="text-primary-500 text-xs ml-2">
              (已根据品种自动选择)
            </span>
          )}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(Object.keys(COAT_TYPE_LABELS) as CoatType[]).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, coatType: type }))}
              className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                formData.coatType === type
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold text-gray-800">{COAT_TYPE_LABELS[type]}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="form-label">
          体重（kg）
          <span className="text-gray-400 text-xs ml-2">
            输入体重可辅助估算体型
          </span>
        </label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="100"
          value={formData.weight || ''}
          onChange={(e) => handleWeightChange(e.target.value ? parseFloat(e.target.value) : undefined)}
          placeholder="例如：5.5"
          className="input-field"
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-primary-500 font-medium">💡</span>
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="text-primary-600 hover:text-primary-700 font-medium text-sm"
          >
            {showGuide ? '收起测量指南' : '查看测量指南'}
          </button>
        </div>
      </div>

      {showGuide && (
        <div className="bg-primary-50 rounded-xl p-4 space-y-3">
          <h4 className="font-semibold text-primary-800">测量指南</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="bg-white rounded-lg p-3">
              <div className="font-medium text-gray-800 mb-1">📏 胸围（最重要）</div>
              <p className="text-gray-600">测量宠物前腿根部最宽处的周长，即胸部最丰满的部位。</p>
              <p className="text-primary-600 text-xs mt-1">建议留2-3cm余量，避免过紧</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="font-medium text-gray-800 mb-1">📐 背长</div>
              <p className="text-gray-600">从后颈底部（肩胛骨处）到尾巴根部的距离。</p>
              <p className="text-primary-600 text-xs mt-1">不包括尾巴长度</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="font-medium text-gray-800 mb-1">🔗 颈围</div>
              <p className="text-gray-600">测量脖子根部的周长，即平时戴项圈的位置。</p>
              <p className="text-primary-600 text-xs mt-1">建议留1-2cm余量</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            注意：让宠物保持站立姿势测量，数据会更准确。如果宠物体型偏胖，建议选择大一号。
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="form-label">
            胸围 (cm) *
            <span className="text-red-500 text-xs ml-1">最重要</span>
          </label>
          <input
            type="number"
            step="0.5"
            min="10"
            max="150"
            value={formData.chest || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              chest: e.target.value ? parseFloat(e.target.value) : undefined 
            }))}
            placeholder="例如：40"
            className="input-field"
          />
          {selectedBreed && (
            <p className="text-xs text-gray-500 mt-1">
              该品种典型范围：{selectedBreed.typicalChestRange.min}-{selectedBreed.typicalChestRange.max}cm
            </p>
          )}
        </div>

        <div>
          <label className="form-label">背长 (cm) *</label>
          <input
            type="number"
            step="0.5"
            min="10"
            max="120"
            value={formData.length || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              length: e.target.value ? parseFloat(e.target.value) : undefined 
            }))}
            placeholder="例如：35"
            className="input-field"
          />
          {selectedBreed && (
            <p className="text-xs text-gray-500 mt-1">
              该品种典型范围：{selectedBreed.typicalLengthRange.min}-{selectedBreed.typicalLengthRange.max}cm
            </p>
          )}
        </div>

        <div>
          <label className="form-label">
            颈围 (cm)
            <span className="text-gray-400 text-xs ml-1">可选</span>
          </label>
          <input
            type="number"
            step="0.5"
            min="5"
            max="80"
            value={formData.neck || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              neck: e.target.value ? parseFloat(e.target.value) : undefined 
            }))}
            placeholder="例如：20"
            className="input-field"
          />
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div className="text-sm text-gray-600">
            <p className="font-medium text-gray-800 mb-1">选购小贴士</p>
            <ul className="list-disc list-inside space-y-1">
              <li>胸围是最重要的参考指标，优先以胸围为准</li>
              <li>如果数据在两个尺码之间，建议选择大一号</li>
              <li>长毛宠物建议选择大一号，考虑毛发蓬松因素</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <label className="form-label">选择季节 *</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.keys(SEASON_LABELS) as Season[]).map(season => (
            <button
              key={season}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, season }))}
              className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                formData.season === season
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-2">
                {season === 'spring' ? '🌸' : season === 'summer' ? '☀️' : season === 'autumn' ? '🍂' : '❄️'}
              </div>
              <div className="font-semibold text-gray-800">{SEASON_LABELS[season]}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="form-label">穿着场景 *</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(Object.keys(SCENARIO_LABELS) as Scenario[]).map(scenario => (
            <button
              key={scenario}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, scenario }))}
              className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                formData.scenario === scenario
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-2">
                {scenario === 'daily' ? '🏠' : 
                 scenario === 'outdoor' ? '🚶' :
                 scenario === 'sports' ? '⚽' :
                 scenario === 'party' ? '🎉' : '😴'}
              </div>
              <div className="font-semibold text-gray-800">{SCENARIO_LABELS[scenario]}</div>
              <div className="text-xs text-gray-500 mt-1">
                {scenario === 'daily' && '日常居家穿着'}
                {scenario === 'outdoor' && '户外散步出行'}
                {scenario === 'sports' && '运动健身活动'}
                {scenario === 'party' && '派对节日装扮'}
                {scenario === 'sleep' && '睡眠保暖睡衣'}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="card bg-gray-50">
        <h4 className="font-semibold text-gray-800 mb-3">📋 确认信息</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">宠物类型：</span>
            <span className="font-medium">{formData.petType ? PET_TYPE_LABELS[formData.petType] : '-'}</span>
          </div>
          <div>
            <span className="text-gray-500">体型分类：</span>
            <span className="font-medium">{formData.bodyShape ? BODY_SHAPE_LABELS[formData.bodyShape] : '-'}</span>
          </div>
          <div>
            <span className="text-gray-500">毛发类型：</span>
            <span className="font-medium">{formData.coatType ? COAT_TYPE_LABELS[formData.coatType] : '-'}</span>
          </div>
          <div>
            <span className="text-gray-500">测量数据：</span>
            <span className="font-medium">
              {formData.chest && formData.length 
                ? `胸围${formData.chest}cm / 背长${formData.length}cm` 
                : '-'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">季节：</span>
            <span className="font-medium">{formData.season ? SEASON_LABELS[formData.season] : '-'}</span>
          </div>
          <div>
            <span className="text-gray-500">场景：</span>
            <span className="font-medium">{formData.scenario ? SCENARIO_LABELS[formData.scenario] : '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">测量向导</h1>
        <p className="text-gray-600">按照步骤填写信息，获取专业的尺码和材质推荐</p>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <React.Fragment key={step.step}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                    currentStep > step.step
                      ? 'bg-primary-500 text-white'
                      : currentStep === step.step
                      ? 'bg-primary-500 text-white ring-4 ring-primary-100'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {currentStep > step.step ? '✓' : step.step}
                </div>
                <span className="text-xs mt-2 font-medium text-gray-700 hidden sm:block">
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 rounded-full ${
                    currentStep > step.step ? 'bg-primary-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="card mb-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            {steps[currentStep - 1].title}
          </h2>
          <p className="text-gray-600 text-sm">{steps[currentStep - 1].description}</p>
        </div>

        {errors.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600 font-medium mb-2">请检查以下问题：</p>
            <ul className="list-disc list-inside text-sm text-red-500 space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
          disabled={currentStep === 1}
          className={`px-6 py-3 rounded-xl font-medium transition-all ${
            currentStep === 1
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'btn-secondary'
          }`}
        >
          上一步
        </button>

        {currentStep < 4 ? (
          <button
            type="button"
            onClick={() => {
              setErrors([]);
              setCurrentStep(prev => prev + 1);
            }}
            disabled={!canProceed()}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${
              canProceed()
                ? 'btn-primary'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            下一步 →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canProceed()}
            className={`px-8 py-3 rounded-xl font-semibold transition-all ${
              canProceed()
                ? 'bg-accent-500 hover:bg-accent-600 text-white shadow-lg hover:shadow-xl'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            获取推荐结果 🎯
          </button>
        )}
      </div>
    </div>
  );
};

export default MeasurePage;
