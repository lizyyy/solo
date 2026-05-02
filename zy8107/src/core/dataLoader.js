import Papa from 'papaparse';
import yaml from 'js-yaml';

export class DataLoader {
  constructor() {
    this.siteLayout = null;
    this.craneSpecs = null;
    this.liftPlan = null;
    this.loadErrors = [];
  }

  async loadAllData() {
    try {
      const [siteLayout, craneSpecs, liftPlan] = await Promise.all([
        this.loadSiteLayout(),
        this.loadCraneSpecs(),
        this.loadLiftPlan()
      ]);

      return {
        siteLayout,
        craneSpecs,
        liftPlan,
        loadErrors: this.loadErrors
      };
    } catch (error) {
      this.loadErrors.push({
        type: 'fatal',
        message: '数据加载失败',
        details: error.message
      });
      return {
        siteLayout: null,
        craneSpecs: null,
        liftPlan: null,
        loadErrors: this.loadErrors
      };
    }
  }

  async loadSiteLayout() {
    try {
      const response = await fetch('/data/site_layout.json');
      if (!response.ok) {
        throw new Error(`无法加载场地布局数据: ${response.status}`);
      }
      this.siteLayout = await response.json();
      return this.siteLayout;
    } catch (error) {
      this.loadErrors.push({
        type: 'site_layout',
        message: '场地布局数据加载失败',
        details: error.message
      });
      return null;
    }
  }

  async loadCraneSpecs() {
    try {
      const response = await fetch('/data/crane_specs.yaml');
      if (!response.ok) {
        throw new Error(`无法加载吊机规格数据: ${response.status}`);
      }
      const yamlText = await response.text();
      this.craneSpecs = yaml.load(yamlText);
      return this.craneSpecs;
    } catch (error) {
      this.loadErrors.push({
        type: 'crane_specs',
        message: '吊机规格数据加载失败',
        details: error.message
      });
      return null;
    }
  }

  async loadLiftPlan() {
    try {
      const response = await fetch('/data/lift_plan.csv');
      if (!response.ok) {
        throw new Error(`无法加载吊装计划数据: ${response.status}`);
      }
      const csvText = await response.text();
      
      return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete: (results) => {
            this.liftPlan = results.data.map(row => this.normalizeLiftRow(row));
            resolve(this.liftPlan);
          },
          error: (error) => {
            reject(error);
          }
        });
      });
    } catch (error) {
      this.loadErrors.push({
        type: 'lift_plan',
        message: '吊装计划数据加载失败',
        details: error.message
      });
      return null;
    }
  }

  normalizeLiftRow(row) {
    return {
      lift_id: String(row.lift_id || ''),
      lift_name: String(row.lift_name || ''),
      component_name: String(row.component_name || ''),
      component_id: String(row.component_id || ''),
      weight: parseFloat(row.weight) || 0,
      weight_unit: String(row.weight_unit || 'tons'),
      crane_id: String(row.crane_id || ''),
      boom_length: parseFloat(row.boom_length) || 0,
      start_time: this.parseDateTime(row.start_time),
      end_time: this.parseDateTime(row.end_time),
      start_position: {
        x: parseFloat(row.start_x) || 0,
        y: parseFloat(row.start_y) || 0,
        z: parseFloat(row.start_z) || 0
      },
      end_position: {
        x: parseFloat(row.end_x) || 0,
        y: parseFloat(row.end_y) || 0,
        z: parseFloat(row.end_z) || 0
      },
      min_clearance: parseFloat(row.min_clearance) || 2,
      notes: String(row.notes || '')
    };
  }

  parseDateTime(dateStr) {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date;
    } catch {
      return null;
    }
  }

  getCraneById(craneId) {
    if (!this.craneSpecs || !this.craneSpecs.cranes) return null;
    return this.craneSpecs.cranes.find(c => c.crane_id === craneId);
  }

  getObstacleById(obstacleId) {
    if (!this.siteLayout || !this.siteLayout.obstacles) return null;
    return this.siteLayout.obstacles.find(o => o.id === obstacleId);
  }

  getLiftById(liftId) {
    if (!this.liftPlan) return null;
    return this.liftPlan.find(l => l.lift_id === liftId);
  }
}
