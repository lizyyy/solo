import React, { useState } from 'react';
import { 
  allBreeds, 
  dogBreeds, 
  catBreeds
} from '../data/breeds';
import { 
  allSizeCharts, 
  dogSizeCharts, 
  catSizeCharts
} from '../data/sizeCharts';
import { materialRules } from '../data/materialRules';
import { 
  dogBodyShapeRules, 
  catBodyShapeRules,
  getBodyShapeRulesByPetType 
} from '../data/bodyShapeRules';
import { 
  PET_TYPE_LABELS, 
  BODY_SHAPE_LABELS, 
  COAT_TYPE_LABELS, 
  SEASON_LABELS, 
  SCENARIO_LABELS,
  SIZE_LABELS,
  PetType,
  BodyShape,
  Season,
  Scenario
} from '../types';

type TabType = 'breeds' | 'sizeCharts' | 'materials' | 'bodyShapes' | 'statistics';

const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('breeds');
  const [filterPetType, setFilterPetType] = useState<PetType | 'all'>('all');
  const [filterBodyShape, setFilterBodyShape] = useState<BodyShape | 'all'>('all');
  const [filterSeason, setFilterSeason] = useState<Season | 'all'>('all');
  const [filterScenario, setFilterScenario] = useState<Scenario | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'breeds', label: '品种数据', icon: '🐕' },
    { id: 'sizeCharts', label: '尺码表', icon: '📏' },
    { id: 'materials', label: '材质规则', icon: '🧵' },
    { id: 'bodyShapes', label: '体型规则', icon: '📐' },
    { id: 'statistics', label: '数据统计', icon: '📊' },
  ];

  const filteredBreeds = (() => {
    let breeds = allBreeds;
    if (filterPetType !== 'all') {
      breeds = breeds.filter(b => b.petType === filterPetType);
    }
    if (searchTerm) {
      breeds = breeds.filter(b => 
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return breeds;
  })();

  const filteredSizeCharts = (() => {
    let charts = allSizeCharts;
    if (filterPetType !== 'all') {
      charts = charts.filter(c => c.petType === filterPetType);
    }
    if (filterBodyShape !== 'all') {
      charts = charts.filter(c => c.bodyShape === filterBodyShape);
    }
    return charts;
  })();

  const filteredMaterials = (() => {
    let materials = materialRules;
    if (filterSeason !== 'all') {
      materials = materials.filter(m => m.suitableSeasons.includes(filterSeason));
    }
    if (filterScenario !== 'all') {
      materials = materials.filter(m => m.suitableScenarios.includes(filterScenario));
    }
    if (searchTerm) {
      materials = materials.filter(m => 
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return materials;
  })();

  const filteredBodyShapes = (() => {
    let rules = [...dogBodyShapeRules, ...catBodyShapeRules];
    if (filterPetType !== 'all') {
      rules = getBodyShapeRulesByPetType(filterPetType);
    }
    return rules;
  })();

  const renderBreedsTab = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索品种名称..."
            className="input-field"
          />
        </div>
        <select
          value={filterPetType}
          onChange={(e) => setFilterPetType(e.target.value as PetType | 'all')}
          className="input-field w-40"
        >
          <option value="all">全部类型</option>
          <option value="dog">狗狗</option>
          <option value="cat">猫咪</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">品种名称</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">类型</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">体型</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">毛发类型</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">体重范围</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">胸围范围</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">背长范围</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredBreeds.map((breed) => (
              <tr key={breed.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">{breed.name}</div>
                  {breed.description && (
                    <div className="text-xs text-gray-500 mt-0.5">{breed.description}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${
                    breed.petType === 'dog' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                  }`}>
                    {PET_TYPE_LABELS[breed.petType]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {BODY_SHAPE_LABELS[breed.bodyShape]}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {COAT_TYPE_LABELS[breed.defaultCoatType]}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {breed.typicalWeightRange.min}-{breed.typicalWeightRange.max} kg
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {breed.typicalChestRange.min}-{breed.typicalChestRange.max} cm
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {breed.typicalLengthRange.min}-{breed.typicalLengthRange.max} cm
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-gray-500">
        共 {filteredBreeds.length} 个品种
        ({dogBreeds.length} 个狗狗品种, {catBreeds.length} 个猫咪品种)
      </div>
    </div>
  );

  const renderSizeChartsTab = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <select
          value={filterPetType}
          onChange={(e) => {
            setFilterPetType(e.target.value as PetType | 'all');
            setFilterBodyShape('all');
          }}
          className="input-field w-40"
        >
          <option value="all">全部类型</option>
          <option value="dog">狗狗</option>
          <option value="cat">猫咪</option>
        </select>
        
        {filterPetType !== 'all' && (
          <select
            value={filterBodyShape}
            onChange={(e) => setFilterBodyShape(e.target.value as BodyShape | 'all')}
            className="input-field w-40"
          >
            <option value="all">全部体型</option>
            {getBodyShapeRulesByPetType(filterPetType).map(rule => (
              <option key={rule.shape} value={rule.shape}>{rule.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">尺码</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">类型</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">体型</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">胸围(cm)</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">背长(cm)</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">颈围(cm)</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">体重(kg)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredSizeCharts.map((chart) => (
              <tr key={chart.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-semibold text-primary-600">{chart.sizeCode}</span>
                  <div className="text-xs text-gray-500">{SIZE_LABELS[chart.sizeCode]}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${
                    chart.petType === 'dog' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                  }`}>
                    {PET_TYPE_LABELS[chart.petType]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {BODY_SHAPE_LABELS[chart.bodyShape]}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {chart.chestMin} - {chart.chestMax}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {chart.lengthMin} - {chart.lengthMax}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {chart.neckMin} - {chart.neckMax}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {chart.weightMin !== undefined && chart.weightMax !== undefined
                    ? `${chart.weightMin} - ${chart.weightMax}`
                    : '-'
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-gray-500">
        共 {filteredSizeCharts.length} 条尺码规则
        ({dogSizeCharts.length} 条狗狗尺码, {catSizeCharts.length} 条猫咪尺码)
      </div>
    </div>
  );

  const renderMaterialsTab = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索材质名称..."
            className="input-field"
          />
        </div>
        <select
          value={filterSeason}
          onChange={(e) => setFilterSeason(e.target.value as Season | 'all')}
          className="input-field w-40"
        >
          <option value="all">全部季节</option>
          {(Object.keys(SEASON_LABELS) as Season[]).map(season => (
            <option key={season} value={season}>{SEASON_LABELS[season]}</option>
          ))}
        </select>
        <select
          value={filterScenario}
          onChange={(e) => setFilterScenario(e.target.value as Scenario | 'all')}
          className="input-field w-40"
        >
          <option value="all">全部场景</option>
          {(Object.keys(SCENARIO_LABELS) as Scenario[]).map(scenario => (
            <option key={scenario} value={scenario}>{SCENARIO_LABELS[scenario]}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredMaterials.map((material) => (
          <div key={material.id} className="card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{material.name}</h3>
                <p className="text-sm text-gray-600">{material.description}</p>
              </div>
              <span className="text-3xl">
                {material.materialType === 'cotton' ? '👕' :
                 material.materialType === 'linen' ? '🌿' :
                 material.materialType === 'fleece' ? '🧥' :
                 material.materialType === 'wool' ? '🐑' :
                 material.materialType === 'down' ? '🦆' :
                 material.materialType === 'nylon' ? '🎽' :
                 material.materialType === 'waterproof' ? '☔' : '✨'}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-xs font-medium text-gray-500">适用季节：</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {material.suitableSeasons.map(season => (
                    <span key={season} className="badge bg-green-100 text-green-700 text-xs">
                      {SEASON_LABELS[season]}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-gray-500">适用场景：</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {material.suitableScenarios.map(scenario => (
                    <span key={scenario} className="badge bg-blue-100 text-blue-700 text-xs">
                      {SCENARIO_LABELS[scenario]}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                <div>
                  <span className="text-xs font-medium text-gray-500">优点：</span>
                  <ul className="text-xs text-gray-600 mt-1 list-disc list-inside">
                    {material.pros.slice(0, 2).map((pro, i) => (
                      <li key={i}>{pro}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500">缺点：</span>
                  <ul className="text-xs text-gray-600 mt-1 list-disc list-inside">
                    {material.cons.slice(0, 2).map((con, i) => (
                      <li key={i}>{con}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-sm text-gray-500">
        共 {filteredMaterials.length} 种材质
      </div>
    </div>
  );

  const renderBodyShapesTab = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <select
          value={filterPetType}
          onChange={(e) => setFilterPetType(e.target.value as PetType | 'all')}
          className="input-field w-40"
        >
          <option value="all">全部类型</option>
          <option value="dog">狗狗</option>
          <option value="cat">猫咪</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredBodyShapes.map((rule) => (
          <div key={`${rule.petType}-${rule.shape}`} className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-2xl">
                {rule.petType === 'dog' ? '🐕' : '🐱'}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">{rule.name}</h3>
                <span className={`badge text-xs ${
                  rule.petType === 'dog' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                }`}>
                  {PET_TYPE_LABELS[rule.petType]}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">{rule.description}</p>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-primary-500">⚖️</span>
                <span className="text-sm text-gray-700">
                  体重范围：<strong>{rule.weightRange.min} - {rule.weightRange.max} kg</strong>
                </span>
              </div>

              <div>
                <span className="text-xs font-medium text-gray-500">典型品种：</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {rule.examples.map((example, i) => (
                    <span key={i} className="badge bg-gray-100 text-gray-700 text-xs">
                      {example}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-sm text-gray-500">
        共 {filteredBodyShapes.length} 个体型分类
        ({dogBodyShapeRules.length} 个狗狗体型, {catBodyShapeRules.length} 个猫咪体型)
      </div>
    </div>
  );

  const renderStatisticsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-4xl mb-2">🐕</div>
          <div className="text-3xl font-bold text-primary-600">{dogBreeds.length}</div>
          <div className="text-sm text-gray-500">狗狗品种</div>
        </div>
        <div className="card text-center">
          <div className="text-4xl mb-2">🐱</div>
          <div className="text-3xl font-bold text-accent-600">{catBreeds.length}</div>
          <div className="text-sm text-gray-500">猫咪品种</div>
        </div>
        <div className="card text-center">
          <div className="text-4xl mb-2">📏</div>
          <div className="text-3xl font-bold text-green-600">{allSizeCharts.length}</div>
          <div className="text-sm text-gray-500">尺码规则</div>
        </div>
        <div className="card text-center">
          <div className="text-4xl mb-2">🧵</div>
          <div className="text-3xl font-bold text-orange-600">{materialRules.length}</div>
          <div className="text-sm text-gray-500">材质类型</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-bold text-gray-800 mb-4">📐 体型分布</h3>
          <div className="space-y-3">
            {[...dogBodyShapeRules, ...catBodyShapeRules].map((rule, index) => {
              const count = allBreeds.filter(
                b => b.petType === rule.petType && b.bodyShape === rule.shape
              ).length;
              return (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-gray-700">
                    {PET_TYPE_LABELS[rule.petType]} - {rule.name}
                  </div>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          rule.petType === 'dog' ? 'bg-blue-400' : 'bg-pink-400'
                        }`}
                        style={{ width: `${Math.min((count / allBreeds.length) * 100 * 2, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-8 text-right text-sm text-gray-600 font-medium">
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-bold text-gray-800 mb-4">🌸 季节-材质对应</h3>
          <div className="space-y-4">
            {(Object.keys(SEASON_LABELS) as Season[]).map(season => {
              const materials = materialRules.filter(m => m.suitableSeasons.includes(season));
              return (
                <div key={season} className="border-b border-gray-100 pb-3 last:border-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">
                      {season === 'spring' ? '🌸' : 
                       season === 'summer' ? '☀️' :
                       season === 'autumn' ? '🍂' : '❄️'}
                    </span>
                    <span className="font-medium text-gray-800">{SEASON_LABELS[season]}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {materials.map(m => (
                      <span key={m.id} className="badge bg-gray-100 text-gray-700 text-xs">
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold text-gray-800 mb-4">📋 数据结构说明</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">核心数据表：</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary-500">•</span>
                <div>
                  <span className="font-medium">品种体型规则表</span>
                  <span className="text-gray-500 ml-2">定义不同品种的体型分类、毛发类型、典型尺寸范围</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-500">•</span>
                <div>
                  <span className="font-medium">衣服尺码表</span>
                  <span className="text-gray-500 ml-2">定义各尺码对应的胸围、背长、颈围、体重范围</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-500">•</span>
                <div>
                  <span className="font-medium">材质规则表</span>
                  <span className="text-gray-500 ml-2">定义各材质适用的季节、毛发类型、场景，以及优缺点</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-500">•</span>
                <div>
                  <span className="font-medium">体型规则表</span>
                  <span className="text-gray-500 ml-2">定义超小型/小型/中型/大型/超大型的体重范围和典型品种</span>
                </div>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">用户数据表：</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-accent-500">•</span>
                <div>
                  <span className="font-medium">用户测量记录</span>
                  <span className="text-gray-500 ml-2">保存用户输入的宠物信息和测量数据</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent-500">•</span>
                <div>
                  <span className="font-medium">推荐结果记录</span>
                  <span className="text-gray-500 ml-2">保存系统生成的尺码推荐、材质推荐、建议等</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent-500">•</span>
                <div>
                  <span className="font-medium">历史记录</span>
                  <span className="text-gray-500 ml-2">关联宠物名称、测量数据、推荐结果，支持查询和管理</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1">规格管理</h1>
        <p className="text-gray-600">查看和管理系统中的品种、尺码、材质等规则数据</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSearchTerm('');
              setFilterPetType('all');
              setFilterBodyShape('all');
              setFilterSeason('all');
              setFilterScenario('all');
            }}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-all ${
              activeTab === tab.id
                ? 'text-primary-600 border-primary-500'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === 'breeds' && renderBreedsTab()}
        {activeTab === 'sizeCharts' && renderSizeChartsTab()}
        {activeTab === 'materials' && renderMaterialsTab()}
        {activeTab === 'bodyShapes' && renderBodyShapesTab()}
        {activeTab === 'statistics' && renderStatisticsTab()}
      </div>
    </div>
  );
};

export default AdminPage;
