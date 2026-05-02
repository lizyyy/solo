import * as THREE from 'three';
import {
  ModelParser,
  ToothPosition,
  GeometryCalculator,
  ValidationRules,
  ValidationSeverity,
  ValidationType,
  StorageExporter,
  InteractionState,
  InteractionMode,
  SceneManager,
  ViewMode
} from './core/index.js';

class OcclusalCheckApp {
  constructor() {
    this.modelParser = new ModelParser();
    this.geometryCalculator = new GeometryCalculator();
    this.validationRules = new ValidationRules();
    this.storageExporter = new StorageExporter();
    this.interactionState = new InteractionState();
    
    this.sceneManager = null;
    
    this.maxillaryAnnotation = null;
    this.mandibularAnnotation = null;
    this.currentAnnotation = null;
    
    this.maxillaryModel = null;
    this.mandibularModel = null;
    
    this.validationResults = null;
    
    this.selectedToothData = null;
    
    this._init();
  }

  _init() {
    this._setupScene();
    this._setupEventListeners();
    this._updateStatus('ready', '就绪');
  }

  _setupScene() {
    try {
      this.sceneManager = new SceneManager('scene-canvas');
      this.sceneManager.startAnimation();
      
      this.sceneManager.addEventListener('objectSelected', (data) => {
        this._handleObjectSelection(data);
      });
      
      console.log('场景初始化完成');
    } catch (error) {
      console.error('场景初始化失败:', error);
      this._updateStatus('error', '场景初始化失败');
    }
  }

  _setupEventListeners() {
    document.getElementById('load-example-btn').addEventListener('click', () => this._loadExampleData());
    document.getElementById('new-project-btn').addEventListener('click', () => this._newProject());
    
    document.getElementById('import-annotation-btn').addEventListener('click', () => {
      document.getElementById('annotation-file-input').click();
    });
    document.getElementById('annotation-file-input').addEventListener('change', (e) => this._handleAnnotationFile(e));
    
    document.getElementById('import-stl-btn').addEventListener('click', () => {
      document.getElementById('model-file-input').click();
    });
    document.getElementById('model-file-input').addEventListener('change', (e) => this._handleModelFiles(e));
    
    document.getElementById('view-both-btn').addEventListener('click', () => this._setViewMode(ViewMode.BOTH));
    document.getElementById('view-upper-btn').addEventListener('click', () => this._setViewMode(ViewMode.MAXILLARY_ONLY));
    document.getElementById('view-lower-btn').addEventListener('click', () => this._setViewMode(ViewMode.MANDIBULAR_ONLY));
    
    document.getElementById('snap-enabled').addEventListener('change', (e) => {
      this.interactionState.setSnapEnabled(e.target.checked);
    });
    document.getElementById('snap-step').addEventListener('change', (e) => {
      this.interactionState.setSnapStep(parseFloat(e.target.value) || 0.5);
    });
    
    document.getElementById('axis-x').addEventListener('click', (e) => this._toggleAxisLock('x', e.target));
    document.getElementById('axis-y').addEventListener('click', (e) => this._toggleAxisLock('y', e.target));
    document.getElementById('axis-z').addEventListener('click', (e) => this._toggleAxisLock('z', e.target));
    
    document.getElementById('view-front').addEventListener('click', () => this._setPresetView('front'));
    document.getElementById('view-side').addEventListener('click', () => this._setPresetView('side'));
    document.getElementById('view-top').addEventListener('click', () => this._setPresetView('top'));
    document.getElementById('view-reset').addEventListener('click', () => this._setPresetView('reset'));
    
    document.getElementById('save-project-btn').addEventListener('click', () => this._saveProject());
    document.getElementById('load-project-btn').addEventListener('click', () => this._loadProject());
    document.getElementById('export-report-btn').addEventListener('click', () => this._exportReport());
    document.getElementById('export-csv-btn').addEventListener('click', () => this._exportCSV());
    document.getElementById('run-validation-btn').addEventListener('click', () => this._runValidation());
    
    document.getElementById('close-validation-btn').addEventListener('click', () => {
      document.getElementById('validation-panel').classList.add('hidden');
    });
  }

  async _loadExampleData() {
    this._showLoading('加载示例数据...');
    
    try {
      const maxillaryResponse = await fetch('data/maxillary-annotation.json');
      const maxillaryData = await maxillaryResponse.json();
      this.maxillaryAnnotation = this.modelParser.parseToothAnnotation(maxillaryData);
      
      const mandibularResponse = await fetch('data/mandibular-annotation.json');
      const mandibularData = await mandibularResponse.json();
      this.mandibularAnnotation = this.modelParser.parseToothAnnotation(mandibularData);
      
      this.currentAnnotation = this.maxillaryAnnotation;
      
      this._createSyntheticModels();
      
      this._updateToothList();
      this._updateCaseId(this.currentAnnotation.caseId);
      this._updateStatus('ready', '示例数据加载完成');
      
      setTimeout(() => this._runValidation(), 500);
      
    } catch (error) {
      console.error('加载示例数据失败:', error);
      this._updateStatus('error', '加载示例数据失败');
    } finally {
      this._hideLoading();
    }
  }

  _createSyntheticModels() {
    this.sceneManager.clearAll();
    
    const maxillaryArchGeometry = this._createArchGeometry(true);
    this.sceneManager.loadMaxillaryModel(maxillaryArchGeometry);
    this.maxillaryModel = {
      geometry: maxillaryArchGeometry,
      vertices: maxillaryArchGeometry.attributes.position.array
    };
    
    const mandibularArchGeometry = this._createArchGeometry(false);
    this.sceneManager.loadMandibularModel(mandibularArchGeometry);
    this.mandibularModel = {
      geometry: mandibularArchGeometry,
      vertices: mandibularArchGeometry.attributes.position.array
    };
    
    if (this.maxillaryAnnotation) {
      this.maxillaryAnnotation.teeth.forEach(tooth => {
        if (tooth.hasAttachment && tooth.attachment) {
          this.sceneManager.addAttachment(tooth.attachment, tooth, 0xff4444);
        }
      });
    }
    
    if (this.mandibularAnnotation) {
      this.mandibularAnnotation.teeth.forEach(tooth => {
        if (tooth.hasAttachment && tooth.attachment) {
          this.sceneManager.addAttachment(tooth.attachment, tooth, 0xffaa44);
        }
      });
    }
  }

  _createArchGeometry(isUpper) {
    const group = new THREE.Group();
    
    const toothPositions = isUpper ? [
      { x: -25, y: 15, z: 0 },
      { x: -20, y: 14, z: 0 },
      { x: -14, y: 12, z: 0 },
      { x: -8, y: 10, z: 0 },
      { x: -4, y: 8, z: 0 },
      { x: 0, y: 6, z: 0 },
      { x: 4, y: 8, z: 0 },
      { x: 8, y: 10, z: 0 },
      { x: 14, y: 12, z: 0 },
      { x: 20, y: 14, z: 0 },
      { x: 25, y: 15, z: 0 },
    ] : [
      { x: -25, y: -15, z: 0 },
      { x: -20, y: -14, z: 0 },
      { x: -14, y: -12, z: 0 },
      { x: -8, y: -10, z: 0 },
      { x: -4, y: -8, z: 0 },
      { x: 0, y: -6, z: 0 },
      { x: 4, y: -8, z: 0 },
      { x: 8, y: -10, z: 0 },
      { x: 14, y: -12, z: 0 },
      { x: 20, y: -14, z: 0 },
      { x: 25, y: -15, z: 0 },
    ];

    toothPositions.forEach(pos => {
      const width = 5 + Math.random() * 2;
      const height = 8 + Math.random() * 2;
      const depth = 6 + Math.random() * 2;
      
      const toothGeometry = new THREE.BoxGeometry(width, height, depth);
      const tooth = new THREE.Mesh(toothGeometry);
      tooth.position.set(pos.x, pos.y, pos.z);
      group.add(tooth);
    });

    const curveY = isUpper ? 8 : -8;
    const curvePoints = [];
    for (let i = -30; i <= 30; i += 2) {
      curvePoints.push(new THREE.Vector3(i, curveY, 0));
    }
    
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const tubeGeometry = new THREE.TubeGeometry(curve, 50, 1.5, 8, false);
    const gum = new THREE.Mesh(tubeGeometry);
    group.add(gum);

    const resultGeometry = new THREE.BufferGeometry();
    const vertices = [];
    
    group.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const geo = child.geometry;
        const position = child.position;
        const posAttr = geo.attributes.position;
        
        for (let i = 0; i < posAttr.count; i++) {
          const x = posAttr.getX(i) + position.x;
          const y = posAttr.getY(i) + position.y;
          const z = posAttr.getZ(i) + position.z;
          vertices.push(x, y, z);
        }
      }
    });

    resultGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    resultGeometry.computeBoundingBox();
    resultGeometry.computeVertexNormals();

    return resultGeometry;
  }

  _newProject() {
    this.sceneManager.clearAll();
    this.maxillaryAnnotation = null;
    this.mandibularAnnotation = null;
    this.currentAnnotation = null;
    this.maxillaryModel = null;
    this.mandibularModel = null;
    this.validationResults = null;
    this.selectedToothData = null;
    
    this._updateToothList();
    this._updateCaseId('未命名项目');
    this._updateStatus('ready', '新项目已创建');
    
    document.getElementById('validation-panel').classList.add('hidden');
  }

  async _handleAnnotationFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    this._showLoading('加载标注文件...');
    
    try {
      const annotation = await this.modelParser.parseToothAnnotationFromFile(file);
      
      if (annotation.position === ToothPosition.MAXILLARY) {
        this.maxillaryAnnotation = annotation;
        this.currentAnnotation = annotation;
      } else {
        this.mandibularAnnotation = annotation;
        if (!this.currentAnnotation) {
          this.currentAnnotation = annotation;
        }
      }
      
      this._updateToothList();
      this._updateCaseId(this.currentAnnotation?.caseId || '未命名');
      this._updateStatus('ready', '标注文件加载完成');
      
    } catch (error) {
      console.error('加载标注文件失败:', error);
      this._updateStatus('error', '加载标注文件失败');
    } finally {
      this._hideLoading();
      event.target.value = '';
    }
  }

  async _handleModelFiles(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    this._showLoading('加载模型文件...');

    try {
      for (const file of files) {
        const ext = file.name.toLowerCase().split('.').pop();
        
        if (ext === 'stl') {
          const parsed = await this.modelParser.parseSTL(file);
          const isMaxillary = file.name.toLowerCase().includes('upper') || 
                             file.name.toLowerCase().includes('maxillary');
          
          if (isMaxillary) {
            this.sceneManager.loadMaxillaryModel(parsed.geometry);
            this.maxillaryModel = parsed;
          } else {
            this.sceneManager.loadMandibularModel(parsed.geometry);
            this.mandibularModel = parsed;
          }
        } else if (ext === 'obj') {
          const parsed = await this.modelParser.parseOBJ(file);
          if (parsed.geometries.length > 0) {
            const isMaxillary = file.name.toLowerCase().includes('upper') || 
                               file.name.toLowerCase().includes('maxillary');
            
            const firstGeo = parsed.geometries[0].geometry;
            if (isMaxillary) {
              this.sceneManager.loadMaxillaryModel(firstGeo);
              this.maxillaryModel = parsed.geometries[0];
            } else {
              this.sceneManager.loadMandibularModel(firstGeo);
              this.mandibularModel = parsed.geometries[0];
            }
          }
        }
      }
      
      this._updateStatus('ready', '模型文件加载完成');
      
    } catch (error) {
      console.error('加载模型文件失败:', error);
      this._updateStatus('error', '加载模型文件失败');
    } finally {
      this._hideLoading();
      event.target.value = '';
    }
  }

  _setViewMode(mode) {
    this.sceneManager.setViewMode(mode);
    
    const btns = ['view-both-btn', 'view-upper-btn', 'view-lower-btn'];
    btns.forEach(id => {
      document.getElementById(id).classList.remove('active');
    });
    
    const btnMap = {
      [ViewMode.BOTH]: 'view-both-btn',
      [ViewMode.MAXILLARY_ONLY]: 'view-upper-btn',
      [ViewMode.MANDIBULAR_ONLY]: 'view-lower-btn'
    };
    document.getElementById(btnMap[mode])?.classList.add('active');
  }

  _toggleAxisLock(axis, button) {
    const current = this.interactionState.axisLock;
    const newValue = !current[axis];
    
    button.classList.toggle('active', newValue);
    this.interactionState.setAxisLock(
      axis === 'x' ? newValue : current.x,
      axis === 'y' ? newValue : current.y,
      axis === 'z' ? newValue : current.z
    );
  }

  _setPresetView(viewType) {
    if (!this.sceneManager) return;
    
    const camera = this.sceneManager.camera;
    const target = this.sceneManager.controls.target;
    const box = this.sceneManager.getSceneBounds();
    
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) * 1.5;

    const btns = ['view-front', 'view-side', 'view-top', 'view-reset'];
    btns.forEach(id => {
      document.getElementById(id).classList.remove('active');
    });

    switch (viewType) {
      case 'front':
        camera.position.set(center.x, center.y, center.z + maxDim);
        document.getElementById('view-front').classList.add('active');
        break;
      case 'side':
        camera.position.set(center.x + maxDim, center.y, center.z);
        document.getElementById('view-side').classList.add('active');
        break;
      case 'top':
        camera.position.set(center.x, center.y + maxDim, center.z);
        document.getElementById('view-top').classList.add('active');
        break;
      case 'reset':
      default:
        camera.position.set(center.x, center.y + maxDim * 0.5, center.z + maxDim);
        break;
    }

    this.sceneManager.controls.target.copy(center);
    this.sceneManager.controls.update();
  }

  _handleObjectSelection(data) {
    const userData = data.userData;
    
    if (userData.type === 'attachment') {
      this.selectedToothData = {
        id: userData.toothId,
        fdiNumber: userData.fdiNumber,
        name: userData.toothName,
        hasAttachment: true
      };
      this.interactionState.selectAttachment(this.selectedToothData);
    } else if (userData.type === 'tooth') {
      this.selectedToothData = userData.toothData;
      this.interactionState.selectTooth(this.selectedToothData);
    }
    
    this._updateSelectedInfo();
    this._updateToothListSelection();
  }

  _updateToothList() {
    const container = document.getElementById('tooth-list');
    
    if (!this.currentAnnotation || !this.currentAnnotation.teeth) {
      container.innerHTML = `
        <div style="color: #888; text-align: center; padding: 20px;">
          请先加载标注文件
        </div>
      `;
      return;
    }

    const teeth = [...this.currentAnnotation.teeth].sort((a, b) => a.fdiNumber - b.fdiNumber);
    
    container.innerHTML = teeth.map(tooth => {
      const isSelected = this.selectedToothData && this.selectedToothData.id === tooth.id;
      const badges = [];
      
      if (!tooth.present) {
        badges.push('<span class="badge missing">缺失</span>');
      }
      if (tooth.hasAttachment) {
        badges.push('<span class="badge attachment">附件</span>');
      }
      if (tooth.movement) {
        badges.push('<span class="badge movement">移动</span>');
      }

      return `
        <div class="tooth-item ${isSelected ? 'selected' : ''} ${tooth.present ? '' : 'missing'}"
             data-tooth-id="${tooth.id}"
             data-fdi="${tooth.fdiNumber}">
          <div class="tooth-info">
            <div class="tooth-number">${tooth.fdiNumber}</div>
            <div class="tooth-name">${tooth.name}</div>
          </div>
          <div class="tooth-badges">
            ${badges.join('')}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.tooth-item').forEach(item => {
      item.addEventListener('click', () => {
        const toothId = parseInt(item.dataset.toothId);
        const tooth = this.currentAnnotation.teeth.find(t => t.id === toothId);
        if (tooth) {
          this.selectedToothData = tooth;
          
          if (tooth.hasAttachment) {
            this.interactionState.selectAttachment(tooth);
          } else {
            this.interactionState.selectTooth(tooth);
          }
          
          this._updateSelectedInfo();
          this._updateToothListSelection();
        }
      });
    });
  }

  _updateToothListSelection() {
    const items = document.querySelectorAll('.tooth-item');
    items.forEach(item => {
      const toothId = parseInt(item.dataset.toothId);
      const isSelected = this.selectedToothData && this.selectedToothData.id === toothId;
      item.classList.toggle('selected', isSelected);
    });
  }

  _updateSelectedInfo() {
    const infoEl = document.getElementById('selected-info');
    if (this.selectedToothData) {
      infoEl.textContent = `已选择: ${this.selectedToothData.fdiNumber} - ${this.selectedToothData.name}`;
    } else {
      infoEl.textContent = '未选择';
    }
  }

  _updateCaseId(caseId) {
    document.getElementById('case-id-display').textContent = caseId || '未命名';
  }

  _updateStatus(status, text) {
    const indicator = document.getElementById('status-indicator');
    const textEl = document.getElementById('status-text');
    
    indicator.className = 'status-indicator ' + status;
    textEl.textContent = text;
  }

  _showLoading(text = '加载中...') {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-overlay').classList.remove('hidden');
  }

  _hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
  }

  async _runValidation() {
    if (!this.currentAnnotation) {
      alert('请先加载标注文件');
      return;
    }

    this._showLoading('运行校验...');

    try {
      await new Promise(resolve => setTimeout(resolve, 300));

      this.validationResults = this.validationRules.validateAll(
        this.currentAnnotation,
        this.maxillaryModel,
        this.mandibularModel,
        {
          minimumGap: 0.5,
          criticalGap: 0.2,
          unit: 'mm'
        }
      );

      this._displayValidationResults();
      this._updateStatus('ready', '校验完成');

    } catch (error) {
      console.error('校验失败:', error);
      this._updateStatus('error', '校验失败');
    } finally {
      this._hideLoading();
    }
  }

  _displayValidationResults() {
    const panel = document.getElementById('validation-panel');
    const list = document.getElementById('validation-list');
    
    if (!this.validationResults) {
      panel.classList.add('hidden');
      return;
    }

    document.getElementById('error-count').textContent = this.validationResults.summary.errors;
    document.getElementById('warning-count').textContent = this.validationResults.summary.warnings;
    document.getElementById('info-count').textContent = this.validationResults.summary.infos;

    const allResults = [
      ...this.validationResults.errors,
      ...this.validationResults.warnings,
      ...this.validationResults.infos
    ];

    if (allResults.length === 0) {
      list.innerHTML = `
        <div class="validation-item" style="justify-content: center; padding: 20px;">
          <span style="color: #2ecc71; font-size: 1.1rem;">✅ 所有校验通过，未发现问题</span>
        </div>
      `;
    } else {
      list.innerHTML = allResults.map(result => {
        const iconMap = {
          [ValidationSeverity.ERROR]: '❌',
          [ValidationSeverity.WARNING]: '⚠️',
          [ValidationSeverity.INFO]: 'ℹ️'
        };

        return `
          <div class="validation-item ${result.severity}">
            <span class="validation-icon">${iconMap[result.severity] || 'ℹ️'}</span>
            <div class="validation-content">
              <div class="validation-message">${result.message}</div>
              ${result.details ? `<div class="validation-details">${this._formatDetails(result.details)}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    panel.classList.remove('hidden');
  }

  _formatDetails(details) {
    if (!details) return '';
    
    const items = [];
    if (details.gap !== undefined) {
      items.push(`间隙: ${details.gap.toFixed(3)}mm`);
    }
    if (details.minimumGap !== undefined) {
      items.push(`最小间隙: ${details.minimumGap}mm`);
    }
    if (details.fdiNumber) {
      items.push(`牙位: ${details.fdiNumber}`);
    }
    
    return items.join(' | ');
  }

  _saveProject() {
    if (!this.currentAnnotation) {
      alert('没有可保存的数据');
      return;
    }

    const projectData = {
      caseId: this.currentAnnotation.caseId,
      annotation: this.currentAnnotation,
      maxillaryAnnotation: this.maxillaryAnnotation,
      mandibularAnnotation: this.mandibularAnnotation,
      config: {
        viewMode: this.sceneManager?.viewMode,
        snapEnabled: this.interactionState.snapEnabled,
        snapStep: this.interactionState.snapStep
      },
      validationResults: this.validationResults,
      notes: ''
    };

    const json = this.storageExporter.exportProject(projectData);
    const filename = `${projectData.caseId || 'project'}_${Date.now()}.json`;
    
    this.storageExporter.downloadJSON(json, filename);
    this._updateStatus('ready', `方案已保存: ${filename}`);
  }

  _loadProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      this._showLoading('加载项目...');

      try {
        const text = await file.text();
        const project = this.storageExporter.importProject(text);
        
        if (project.annotation) {
          this.currentAnnotation = project.annotation;
          
          if (project.annotation.position === ToothPosition.MAXILLARY) {
            this.maxillaryAnnotation = project.annotation;
          } else {
            this.mandibularAnnotation = project.annotation;
          }
        }
        
        if (project.config) {
          if (project.config.viewMode) {
            this._setViewMode(project.config.viewMode);
          }
          if (project.config.snapEnabled !== undefined) {
            this.interactionState.setSnapEnabled(project.config.snapEnabled);
            document.getElementById('snap-enabled').checked = project.config.snapEnabled;
          }
          if (project.config.snapStep) {
            this.interactionState.setSnapStep(project.config.snapStep);
            document.getElementById('snap-step').value = project.config.snapStep;
          }
        }
        
        if (project.validationResults) {
          this.validationResults = project.validationResults;
        }
        
        this._createSyntheticModels();
        this._updateToothList();
        this._updateCaseId(project.caseId || '已加载项目');
        this._updateStatus('ready', '项目加载完成');
        
        if (this.validationResults) {
          this._displayValidationResults();
        }
        
      } catch (error) {
        console.error('加载项目失败:', error);
        this._updateStatus('error', '加载项目失败');
      } finally {
        this._hideLoading();
      }
    };

    input.click();
  }

  _exportReport() {
    if (!this.currentAnnotation) {
      alert('请先加载数据');
      return;
    }

    const projectData = {
      caseId: this.currentAnnotation.caseId,
      annotation: this.currentAnnotation,
      config: {},
      notes: ''
    };

    const markdown = this.storageExporter.exportMarkdownReport(projectData, this.validationResults);
    const filename = `${this.currentAnnotation.caseId || 'report'}_${new Date().toISOString().slice(0, 10)}.md`;
    
    this.storageExporter.downloadMarkdown(markdown, filename);
    this._updateStatus('ready', `报告已导出: ${filename}`);
  }

  _exportCSV() {
    if (!this.currentAnnotation) {
      alert('请先加载数据');
      return;
    }

    const toothListCSV = this.storageExporter.exportCSVToothList(this.currentAnnotation);
    const toothFilename = `${this.currentAnnotation.caseId || 'tooth_list'}_${new Date().toISOString().slice(0, 10)}.csv`;
    this.storageExporter.downloadCSV(toothListCSV, toothFilename);

    if (this.validationResults) {
      const validationCSV = this.storageExporter.exportCSVValidationResults(this.validationResults);
      const validationFilename = `${this.currentAnnotation.caseId || 'validation'}_${new Date().toISOString().slice(0, 10)}.csv`;
      this.storageExporter.downloadCSV(validationCSV, validationFilename);
    }

    this._updateStatus('ready', 'CSV文件已导出');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new OcclusalCheckApp();
});
