import { motion } from 'framer-motion';
import { useEditorStore } from '../../store/useEditorStore';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useNavigate } from 'react-router-dom';
import { PARTICLE_PROPERTIES, ParticleType } from '../../types';
import { Play, Download, Upload, Zap, Target, Gauge } from 'lucide-react';
import { exportToJSON, downloadFile, generateExportFilename, importFromJSON, readFileAsText } from '../../utils/importExport';
import { useHistoryStore } from '../../store/useHistoryStore';

export function ParameterPanel() {
  const navigate = useNavigate();
  const {
    trackElements,
    magneticFields,
    particleConfig,
    setParticleConfig,
    setParticleType,
    currentSampleId,
    updateMagneticField,
    selectedFieldId,
    magneticFields: allMagneticFields,
  } = useEditorStore();

  const { startSimulation, error, clear } = useSimulationStore();
  const { addRecord } = useHistoryStore();

  const selectedField = allMagneticFields.find((f) => f.id === selectedFieldId);

  const handleEnergyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const energy = parseFloat(e.target.value) * 1e-15;
    const velocity = Math.sqrt((2 * energy) / particleConfig.mass);
    setParticleConfig({
      initialEnergy: energy,
      initialVelocity: { x: velocity, y: 0 },
    });
  };

  const handleFieldStrengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedFieldId) {
      updateMagneticField(selectedFieldId, {
        strength: parseFloat(e.target.value),
      });
    }
  };

  const handleRunSimulation = () => {
    clear();
    startSimulation(
      trackElements,
      magneticFields,
      particleConfig,
      currentSampleId
    );
    setTimeout(() => navigate('/simulation'), 100);
  };

  const handleExport = () => {
    if (trackElements.length === 0 && magneticFields.length === 0) {
      alert('画布为空，没有可导出的内容');
      return;
    }

    const tempRecord = {
      id: `export_${Date.now()}`,
      name: `导出配置 ${new Date().toLocaleString()}`,
      timestamp: Date.now(),
      sampleSource: currentSampleId,
      trackElements,
      magneticFields,
      particleConfig,
      trajectory: [],
      result: {
        success: false,
        failureType: null,
        failureReason: null,
        collisionPoint: null,
        totalFrames: 0,
        totalTime: 0,
        finalEnergy: particleConfig.initialEnergy,
        finalPosition: particleConfig.startPosition,
      },
    };

    const json = exportToJSON(tempRecord);
    const filename = generateExportFilename(tempRecord);
    downloadFile(json, filename);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await readFileAsText(file);
      const result = importFromJSON(content);

      if (result.success && result.record) {
        const { loadFromRecord } = useEditorStore.getState();
        loadFromRecord({
          trackElements: result.record.trackElements,
          magneticFields: result.record.magneticFields,
          particleConfig: result.record.particleConfig,
          sampleSource: result.record.sampleSource,
        });
        addRecord(result.record);
        alert('导入成功！已加载轨道配置并保存到历史记录。');
      } else {
        alert(`导入失败: ${result.error}`);
      }
    } catch (err) {
      alert(`文件读取失败: ${err}`);
    }

    e.target.value = '';
  };

  const energyDisplayValue = (particleConfig.initialEnergy / 1e-15).toFixed(1);

  return (
    <div className="w-72 bg-space-dark/80 backdrop-blur-sm border-l border-tech-gray/30 p-4 overflow-y-auto">
      <h2 className="font-display font-bold text-plasma-blue text-sm mb-4 tracking-wider">
        参数面板
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-energy-red/20 border border-energy-red/50 rounded-lg text-energy-red text-sm font-mono">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-plasma-blue" />
            <h3 className="font-mono text-sm text-white">粒子参数</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-mono text-tech-light mb-1">
                粒子种类
              </label>
              <select
                value={particleConfig.type}
                onChange={(e) => setParticleType(e.target.value as ParticleType)}
                className="input-field text-sm"
              >
                {Object.entries(PARTICLE_PROPERTIES).map(([key, props]) => (
                  <option key={key} value={key}>
                    {props.name} ({props.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-space-medium p-2 rounded">
                <div className="text-tech-light">电荷</div>
                <div className="text-plasma-blue">
                  {particleConfig.charge.toExponential(1)} C
                </div>
              </div>
              <div className="bg-space-medium p-2 rounded">
                <div className="text-tech-light">质量</div>
                <div className="text-plasma-blue">
                  {particleConfig.mass.toExponential(1)} kg
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-mono text-tech-light">
                  初始能量
                </label>
                <span className="text-xs font-mono text-plasma-blue">
                  {energyDisplayValue} × 10⁻¹⁵ J
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={energyDisplayValue}
                onChange={handleEnergyChange}
                className="slider"
              />
              <div className="flex justify-between text-xs font-mono text-tech-light mt-1">
                <span>低</span>
                <span>高</span>
              </div>
            </div>

            <div className="bg-space-medium p-2 rounded">
              <div className="text-xs font-mono text-tech-light">初始速度</div>
              <div className="text-sm font-mono text-neon-green">
                vₓ = {particleConfig.initialVelocity.x.toExponential(2)} m/s
              </div>
            </div>
          </div>
        </div>

        {selectedField && (
          <div className="card border-magnetic-purple/50">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-magnetic-purple" />
              <h3 className="font-mono text-sm text-white">选中磁场块</h3>
            </div>

            <div className="space-y-3">
              <div className="bg-space-medium p-2 rounded">
                <div className="text-xs font-mono text-tech-light">磁场方向</div>
                <div className="text-sm font-mono text-magnetic-purple">
                  {selectedField.direction === 'into' ? '向里 (⊗)' : '向外 (⊙)'}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-mono text-tech-light">
                    磁场强度
                  </label>
                  <span className="text-xs font-mono text-magnetic-purple">
                    {selectedField.strength.toFixed(1)} T
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={selectedField.strength}
                  onChange={handleFieldStrengthChange}
                  className="slider accent-magnetic-purple"
                />
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="w-4 h-4 text-neon-green" />
            <h3 className="font-mono text-sm text-white">场景信息</h3>
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-tech-light">轨道元素</span>
              <span className="text-white">{trackElements.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-tech-light">磁场块</span>
              <span className="text-white">{magneticFields.length}</span>
            </div>
            {currentSampleId && (
              <div className="flex justify-between">
                <span className="text-tech-light">来源样例</span>
                <span className="text-plasma-blue">{currentSampleId.replace('sample-', '')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <motion.button
            onClick={handleRunSimulation}
            disabled={trackElements.length < 2}
            className="w-full btn-success flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Play className="w-5 h-5" />
            运行模拟
          </motion.button>

          <div className="grid grid-cols-2 gap-2">
            <motion.label
              className="btn-secondary flex items-center justify-center gap-2 cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Download className="w-4 h-4" />
              导出
              <input
                type="file"
                accept=".json"
                className="hidden"
                onClick={handleExport}
              />
            </motion.label>

            <motion.label
              className="btn-secondary flex items-center justify-center gap-2 cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Upload className="w-4 h-4" />
              导入
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
            </motion.label>
          </div>
        </div>
      </div>
    </div>
  );
}
