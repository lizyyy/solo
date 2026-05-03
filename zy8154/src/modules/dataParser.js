import Papa from 'papaparse';
import yaml from 'js-yaml';

export class DataParser {
  async parseTeeth(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      return {
        upper: data.upper || this.generateDefaultTeeth(true),
        lower: data.lower || this.generateDefaultTeeth(false)
      };
    } catch (error) {
      console.error('解析 teeth.json 失败:', error);
      return {
        upper: this.generateDefaultTeeth(true),
        lower: this.generateDefaultTeeth(false)
      };
    }
  }

  generateDefaultTeeth(isUpper) {
    const teeth = [];
    const prefix = isUpper ? 1 : 3;
    const positions = [7, 6, 5, 4, 3, 2, 1, 1, 2, 3, 4, 5, 6, 7];
    
    positions.forEach((pos, index) => {
      const toothNumber = index < 7 ? prefix * 10 + (8 - pos) : (prefix + 1) * 10 + pos;
      const angle = (index - 6.5) * (Math.PI / 7);
      const radius = 3 + (pos - 1) * 0.15;
      
      teeth.push({
        id: toothNumber,
        position: pos,
        quadrant: index < 7 ? prefix : prefix + 1,
        center: {
          x: Math.sin(angle) * radius,
          y: isUpper ? 1.5 : -1.5,
          z: Math.cos(angle) * radius
        },
        rotation: {
          x: 0,
          y: -angle,
          z: 0
        },
        size: {
          width: 0.6,
          height: pos <= 3 ? 0.9 : 0.7,
          depth: 0.45
        },
        isMissing: false,
        buccalRange: {
          min: 0.05,
          max: 0.3,
          ideal: 0.18
        },
        lingualRange: {
          min: -0.3,
          max: -0.05,
          ideal: -0.18
        }
      });
    });
    
    return teeth;
  }

  async parseAttachments(csvText) {
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const attachments = [];
          
          results.data.forEach((row, index) => {
            if (row.tooth_number || row.toothNumber) {
              const toothNumber = parseInt(row.tooth_number || row.toothNumber) || 0;
              const step = parseInt(row.step || row.stage) || 1;
              
              attachments.push({
                id: row.id || `attachment_${index}`,
                toothNumber: toothNumber,
                step: step,
                type: row.type || 'bracket',
                position: {
                  x: parseFloat(row.position_x || row.posX || 0),
                  y: parseFloat(row.position_y || row.posY || 0),
                  z: parseFloat(row.position_z || row.posZ || 0)
                },
                rotation: {
                  x: parseFloat(row.rotation_x || row.rotX || 0),
                  y: parseFloat(row.rotation_y || row.rotY || 0),
                  z: parseFloat(row.rotation_z || row.rotZ || 0)
                },
                size: {
                  width: parseFloat(row.width || 0.3),
                  height: parseFloat(row.height || 0.25),
                  depth: parseFloat(row.depth || 0.08)
                },
                isMirrored: (row.mirrored || row.isMirrored) === 'true' || 
                           (row.mirrored || row.isMirrored) === true,
                side: row.side || 'buccal'
              });
            }
          });
          
          resolve(attachments);
        },
        error: (error) => {
          console.error('解析 CSV 失败:', error);
          resolve([]);
        }
      });
    });
  }

  parsePlacementRules(yamlText) {
    try {
      const data = yaml.load(yamlText);
      return {
        collision: data.collision || {
          minDistance: 0.1,
          checkAdjacentOnly: true
        },
        range: data.range || {
          buccal: { min: 0.05, max: 0.35 },
          lingual: { min: -0.35, max: -0.05 }
        },
        mirror: data.mirror || {
          enableCheck: true,
          symmetryThreshold: 0.1
        },
        missing: data.missing || {
          enableCheck: true
        },
        steps: data.steps || {
          maxStep: 20,
          allowMultiStep: true
        }
      };
    } catch (error) {
      console.error('解析 YAML 失败:', error);
      return {
        collision: { minDistance: 0.1, checkAdjacentOnly: true },
        range: { buccal: { min: 0.05, max: 0.35 }, lingual: { min: -0.35, max: -0.05 } },
        mirror: { enableCheck: true, symmetryThreshold: 0.1 },
        missing: { enableCheck: true },
        steps: { maxStep: 20, allowMultiStep: true }
      };
    }
  }

  getToothById(teethData, toothNumber) {
    const allTeeth = [...(teethData.upper || []), ...(teethData.lower || [])];
    return allTeeth.find(t => t.id === toothNumber) || null;
  }

  getAdjacentTeeth(teethData, toothNumber) {
    const tooth = this.getToothById(teethData, toothNumber);
    if (!tooth) return [];
    
    const quadrant = tooth.quadrant;
    const position = tooth.position;
    const isUpper = quadrant <= 2;
    const teeth = isUpper ? teethData.upper : teethData.lower;
    
    return teeth.filter(t => {
      if (t.id === toothNumber) return false;
      if (t.quadrant !== quadrant && t.quadrant !== quadrant + (quadrant % 2 === 0 ? -1 : 1)) {
        return false;
      }
      return Math.abs(t.position - position) === 1;
    });
  }

  getMirrorTooth(teethData, toothNumber) {
    const mirrorMap = {
      11: 21, 12: 22, 13: 23, 14: 24, 15: 25, 16: 26, 17: 27,
      21: 11, 22: 12, 23: 13, 24: 14, 25: 15, 26: 16, 27: 17,
      31: 41, 32: 42, 33: 43, 34: 44, 35: 45, 36: 46, 37: 47,
      41: 31, 42: 32, 43: 33, 44: 34, 45: 35, 46: 36, 47: 37
    };
    
    const mirrorNumber = mirrorMap[toothNumber];
    if (!mirrorNumber) return null;
    
    return this.getToothById(teethData, mirrorNumber);
  }

  getAttachmentsByStep(attachments, step) {
    return attachments.filter(a => a.step === step);
  }

  getAttachmentsByTooth(attachments, toothNumber) {
    return attachments.filter(a => a.toothNumber === toothNumber);
  }

  getMaxStep(attachments) {
    if (attachments.length === 0) return 1;
    return Math.max(...attachments.map(a => a.step));
  }
}
