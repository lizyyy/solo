import { parseCsv, buildBoreholes } from './parser/csvParser';
import { Borehole, Layer, ValidationIssue, MarkType } from './types';
import { SceneManager } from './scene/SceneManager';
import { generateStratumSurfaces } from './model/interpolation/surfaceInterpolator';
import { validateBoreholes, getIssueSummary } from './validation/dataValidator';
import { saveMarks, loadMarks, setLayerMark, getMarksSummary } from './persistence/storage';
import { exportToJson, exportToCsv, exportToMarkdown, downloadFile } from './export/exporter';
import { SAMPLE_CSV_DATA } from './data/sampleData';
import { getUniqueSoilTypes, SOIL_COLORS } from './config/soilColors';

class App {
  private sceneManager: SceneManager | null = null;
  private boreholes: Borehole[] = [];
  private validationIssues: ValidationIssue[] = [];
  private selectedLayerId: string | null = null;
  private showBoreholes: boolean = true;
  private showSurfaces: boolean = false;
  private showWaterLevel: boolean = false;
  private showGrid: boolean = true;

  init(): void {
    const container = document.getElementById('canvas-container');
    if (container) {
      this.sceneManager = new SceneManager(container);
      this.sceneManager.setOnLayerSelect((layerId) => {
        this.handleLayerSelect(layerId);
      });
    }

    this.bindEvents();
  }

  private bindEvents(): void {
    const csvInput = document.getElementById('csv-input') as HTMLInputElement;
    const loadSampleBtn = document.getElementById('load-sample-btn');
    const validateBtn = document.getElementById('validate-btn');
    const exportJsonBtn = document.getElementById('export-json');
    const exportCsvBtn = document.getElementById('export-csv');
    const exportMdBtn = document.getElementById('export-markdown');
    const saveMarksBtn = document.getElementById('save-marks');

    const markSuspiciousBtn = document.getElementById('mark-suspicious');
    const markConfirmedBtn = document.getElementById('mark-confirmed');
    const markDangerBtn = document.getElementById('mark-danger');
    const clearMarkBtn = document.getElementById('clear-mark');

    const toggleBoreholesBtn = document.getElementById('toggle-boreholes');
    const toggleSurfacesBtn = document.getElementById('toggle-surfaces');
    const toggleWaterBtn = document.getElementById('toggle-water');
    const toggleGridBtn = document.getElementById('toggle-grid');
    const resetViewBtn = document.getElementById('reset-view');

    if (csvInput) {
      csvInput.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          this.loadCsvFile(file);
        }
      });
    }

    if (loadSampleBtn) {
      loadSampleBtn.addEventListener('click', () => {
        this.loadSampleData();
      });
    }

    if (validateBtn) {
      validateBtn.addEventListener('click', () => {
        this.runValidation();
      });
    }

    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => {
        this.exportAsJson();
      });
    }

    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        this.exportAsCsv();
      });
    }

    if (exportMdBtn) {
      exportMdBtn.addEventListener('click', () => {
        this.exportAsMarkdown();
      });
    }

    if (saveMarksBtn) {
      saveMarksBtn.addEventListener('click', () => {
        this.saveCurrentMarks();
      });
    }

    if (markSuspiciousBtn) {
      markSuspiciousBtn.addEventListener('click', () => {
        this.markCurrentLayer('suspicious');
      });
    }

    if (markConfirmedBtn) {
      markConfirmedBtn.addEventListener('click', () => {
        this.markCurrentLayer('confirmed');
      });
    }

    if (markDangerBtn) {
      markDangerBtn.addEventListener('click', () => {
        this.markCurrentLayer('danger');
      });
    }

    if (clearMarkBtn) {
      clearMarkBtn.addEventListener('click', () => {
        this.markCurrentLayer('none');
      });
    }

    if (toggleBoreholesBtn) {
      toggleBoreholesBtn.addEventListener('click', () => {
        this.showBoreholes = !this.showBoreholes;
        this.sceneManager?.toggleBoreholes(this.showBoreholes);
        toggleBoreholesBtn.classList.toggle('active', this.showBoreholes);
      });
    }

    if (toggleSurfacesBtn) {
      toggleSurfacesBtn.addEventListener('click', () => {
        this.showSurfaces = !this.showSurfaces;
        this.sceneManager?.toggleSurfaces(this.showSurfaces);
        toggleSurfacesBtn.classList.toggle('active', this.showSurfaces);
      });
    }

    if (toggleWaterBtn) {
      toggleWaterBtn.addEventListener('click', () => {
        this.showWaterLevel = !this.showWaterLevel;
        this.sceneManager?.toggleWaterLevel(this.showWaterLevel);
        toggleWaterBtn.classList.toggle('active', this.showWaterLevel);
      });
    }

    if (toggleGridBtn) {
      toggleGridBtn.addEventListener('click', () => {
        this.showGrid = !this.showGrid;
        this.sceneManager?.toggleGrid(this.showGrid);
        toggleGridBtn.classList.toggle('active', this.showGrid);
      });
    }

    if (resetViewBtn) {
      resetViewBtn.addEventListener('click', () => {
        this.sceneManager?.resetView();
      });
    }
  }

  private loadCsvFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      this.processCsvData(content);
    };
    reader.readAsText(file);
  }

  private loadSampleData(): void {
    this.processCsvData(SAMPLE_CSV_DATA);
  }

  private processCsvData(content: string): void {
    try {
      const { boreholes: rawBoreholes, layers: rawLayers } = parseCsv(content);
      this.boreholes = buildBoreholes(rawBoreholes, rawLayers);

      const loadedMarks = loadMarks(this.boreholes);
      console.log(`Loaded ${loadedMarks} saved marks`);

      if (this.boreholes.length === 0) {
        alert('未能解析到任何钻孔数据');
        return;
      }

      this.renderScene();
      this.updateStats();
      this.updateLegend();

      this.selectedLayerId = null;
      this.hideLayerInfo();
      this.validationIssues = [];
      this.hideValidationResults();
    } catch (error) {
      console.error('Error parsing CSV:', error);
      alert('CSV解析错误，请检查数据格式');
    }
  }

  private renderScene(): void {
    if (!this.sceneManager) return;

    this.sceneManager.renderBoreholes(this.boreholes);

    this.boreholes.forEach(borehole => {
      borehole.layers.forEach(layer => {
        if (layer.mark && layer.mark.type !== 'none') {
          this.sceneManager?.updateLayerMark(layer.id, layer.mark.type);
        }
      });
    });

    const surfaces = generateStratumSurfaces(this.boreholes);
    this.sceneManager.renderSurfaces(surfaces);
    this.sceneManager.toggleSurfaces(this.showSurfaces);
    this.sceneManager.toggleWaterLevel(this.showWaterLevel);
  }

  private updateStats(): void {
    const statsPanel = document.getElementById('data-stats');
    const statsContent = document.getElementById('stats-content');

    if (!statsPanel || !statsContent) return;

    const totalLayers = this.boreholes.reduce((sum, b) => sum + b.layers.length, 0);
    const uniqueSoilTypes = getUniqueSoilTypes(
      this.boreholes.flatMap(b => b.layers)
    );
    const maxDepth = Math.max(...this.boreholes.map(b => b.totalDepth));
    const contaminatedCount = this.boreholes.reduce(
      (sum, b) => sum + b.layers.filter(l => l.isContaminated).length, 
      0
    );
    const marksSummary = getMarksSummary(this.boreholes);

    statsContent.innerHTML = `
      <div class="stat">📍 钻孔: ${this.boreholes.length} 个</div>
      <div class="stat">📊 层段: ${totalLayers} 层</div>
      <div class="stat">🏔️ 土类: ${uniqueSoilTypes.length} 种</div>
      <div class="stat">📏 最大深度: ${maxDepth.toFixed(1)}m</div>
      <div class="stat">🚨 污染层: ${contaminatedCount} 层</div>
      <div class="stat">⚠️ 标记: ${marksSummary.total} 层</div>
    `;

    statsPanel.style.display = 'block';
  }

  private updateLegend(): void {
    const legendItems = document.getElementById('legend-items');
    if (!legendItems) return;

    const allLayers = this.boreholes.flatMap(b => b.layers);
    const uniqueSoilTypes = getUniqueSoilTypes(allLayers);

    legendItems.innerHTML = uniqueSoilTypes.map(type => {
      const color = SOIL_COLORS[type]?.color || '#808080';
      return `
        <div class="legend-item">
          <div class="legend-color" style="background-color: ${color}"></div>
          <span>${type}</span>
        </div>
      `;
    }).join('');
  }

  private handleLayerSelect(layerId: string | null): void {
    this.selectedLayerId = layerId;
    
    if (layerId) {
      const layer = this.findLayerById(layerId);
      if (layer) {
        this.showLayerInfo(layer);
      }
    } else {
      this.hideLayerInfo();
    }
  }

  private findLayerById(layerId: string): { layer: Layer; borehole: Borehole } | null {
    for (const borehole of this.boreholes) {
      const layer = borehole.layers.find(l => l.id === layerId);
      if (layer) {
        return { layer, borehole };
      }
    }
    return null;
  }

  private showLayerInfo(data: { layer: Layer; borehole: Borehole }): void {
    const layerInfoPanel = document.getElementById('layer-info');
    const layerDetail = document.getElementById('layer-detail');

    if (!layerInfoPanel || !layerDetail) return;

    const { layer, borehole } = data;

    let markInfo = '';
    if (layer.mark) {
      const markText = 
        layer.mark.type === 'suspicious' ? '⚠️ 可疑' :
        layer.mark.type === 'confirmed' ? '✓ 确认正常' :
        layer.mark.type === 'danger' ? '🚨 重点关注' : '';
      markInfo = `<p><strong>标记状态:</strong> ${markText}</p>`;
    }

    layerDetail.innerHTML = `
      <p><strong>钻孔编号:</strong> ${borehole.id}</p>
      <p><strong>坐标:</strong> (${borehole.x.toFixed(2)}, ${borehole.y.toFixed(2)})</p>
      <p><strong>地面标高:</strong> ${borehole.groundElevation.toFixed(2)}m</p>
      <hr style="margin: 10px 0; border-color: #333;">
      <p><strong>层号:</strong> ${layer.layerIndex}</p>
      <p><strong>层顶深度:</strong> ${layer.topDepth.toFixed(2)}m</p>
      <p><strong>层底深度:</strong> ${layer.bottomDepth.toFixed(2)}m</p>
      <p><strong>厚度:</strong> ${layer.thickness.toFixed(2)}m</p>
      <p><strong>土类:</strong> ${layer.soilType}</p>
      ${layer.description ? `<p><strong>描述:</strong> ${layer.description}</p>` : ''}
      <p><strong>是否采样:</strong> ${layer.hasSample ? '是' : '否'}</p>
      ${layer.sampleId ? `<p><strong>样品编号:</strong> ${layer.sampleId}</p>` : ''}
      <p><strong>是否污染:</strong> ${layer.isContaminated ? '是' : '否'}</p>
      ${layer.contaminantType ? `<p><strong>污染物:</strong> ${layer.contaminantType}</p>` : ''}
      ${layer.contaminantLevel !== undefined ? `<p><strong>浓度:</strong> ${layer.contaminantLevel.toFixed(4)}</p>` : ''}
      ${markInfo}
    `;

    layerInfoPanel.classList.add('visible');
  }

  private hideLayerInfo(): void {
    const layerInfoPanel = document.getElementById('layer-info');
    if (layerInfoPanel) {
      layerInfoPanel.classList.remove('visible');
    }
  }

  private markCurrentLayer(markType: MarkType): void {
    if (!this.selectedLayerId) return;

    const success = setLayerMark(this.boreholes, this.selectedLayerId, markType);
    if (success) {
      this.sceneManager?.updateLayerMark(this.selectedLayerId, markType);
      
      const data = this.findLayerById(this.selectedLayerId);
      if (data) {
        this.showLayerInfo(data);
      }
      
      this.updateStats();
    }
  }

  private saveCurrentMarks(): void {
    saveMarks(this.boreholes);
    const summary = getMarksSummary(this.boreholes);
    alert(`已保存 ${summary.total} 个标记`);
  }

  private runValidation(): void {
    if (this.boreholes.length === 0) {
      alert('请先加载数据');
      return;
    }

    this.validationIssues = validateBoreholes(this.boreholes);
    this.showValidationResults();
  }

  private showValidationResults(): void {
    const resultsPanel = document.getElementById('validation-results');
    if (!resultsPanel) return;

    const summary = getIssueSummary(this.validationIssues);

    if (this.validationIssues.length === 0) {
      resultsPanel.innerHTML = `
        <div class="validation-item success">
          ✅ 数据校验通过，未发现问题
        </div>
      `;
    } else {
      resultsPanel.innerHTML = `
        <p style="margin-bottom: 10px;">
          <strong>总计:</strong> ${summary.total} 个问题 
          (${summary.errors} 个错误, ${summary.warnings} 个警告)
        </p>
        ${this.validationIssues.map(issue => `
          <div class="validation-item ${issue.severity === 'error' ? 'error' : 'warning'}">
            <strong>[${issue.boreholeId}]</strong> ${issue.message}
          </div>
        `).join('')}
      `;
    }

    resultsPanel.style.display = 'block';
  }

  private hideValidationResults(): void {
    const resultsPanel = document.getElementById('validation-results');
    if (resultsPanel) {
      resultsPanel.style.display = 'none';
    }
  }

  private exportAsJson(): void {
    if (this.boreholes.length === 0) {
      alert('请先加载数据');
      return;
    }
    const content = exportToJson(this.boreholes, this.validationIssues);
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadFile(content, `钻孔数据_${timestamp}.json`, 'application/json');
  }

  private exportAsCsv(): void {
    if (this.boreholes.length === 0) {
      alert('请先加载数据');
      return;
    }
    const content = exportToCsv(this.boreholes);
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadFile(content, `钻孔数据_${timestamp}.csv`, 'text/csv;charset=utf-8');
  }

  private exportAsMarkdown(): void {
    if (this.boreholes.length === 0) {
      alert('请先加载数据');
      return;
    }
    const content = exportToMarkdown(this.boreholes, this.validationIssues, '旧厂房改造勘察报告');
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadFile(content, `勘察报告_${timestamp}.md`, 'text/markdown');
  }
}

const app = new App();
app.init();
