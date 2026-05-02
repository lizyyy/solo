import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

export const ToothPosition = {
  MAXILLARY: 'maxillary',
  MANDIBULAR: 'mandibular'
};

export class ModelParser {
  constructor() {
    this.stlLoader = new STLLoader();
    this.objLoader = new OBJLoader();
  }

  async parseSTL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const arrayBuffer = event.target.result;
          const geometry = this.stlLoader.parse(arrayBuffer);
          geometry.computeBoundingBox();
          geometry.computeVertexNormals();
          resolve({
            type: 'stl',
            geometry,
            vertices: geometry.attributes.position.array,
            faces: geometry.index ? geometry.index.array : null,
            boundingBox: geometry.boundingBox
          });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  async parseSTLFromURL(url) {
    return new Promise((resolve, reject) => {
      this.stlLoader.load(
        url,
        (geometry) => {
          geometry.computeBoundingBox();
          geometry.computeVertexNormals();
          resolve({
            type: 'stl',
            geometry,
            vertices: geometry.attributes.position.array,
            faces: geometry.index ? geometry.index.array : null,
            boundingBox: geometry.boundingBox
          });
        },
        undefined,
        reject
      );
    });
  }

  async parseOBJ(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target.result;
          const object = this.objLoader.parse(content);
          
          const geometries = [];
          object.traverse((child) => {
            if (child.isMesh) {
              const geometry = child.geometry;
              geometry.computeBoundingBox();
              geometry.computeVertexNormals();
              geometries.push({
                geometry,
                vertices: geometry.attributes.position.array,
                faces: geometry.index ? geometry.index.array : null,
                boundingBox: geometry.boundingBox
              });
            }
          });

          resolve({
            type: 'obj',
            geometries,
            object
          });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  async parseOBJFromURL(url) {
    return new Promise((resolve, reject) => {
      this.objLoader.load(
        url,
        (object) => {
          const geometries = [];
          object.traverse((child) => {
            if (child.isMesh) {
              const geometry = child.geometry;
              geometry.computeBoundingBox();
              geometry.computeVertexNormals();
              geometries.push({
                geometry,
                vertices: geometry.attributes.position.array,
                faces: geometry.index ? geometry.index.array : null,
                boundingBox: geometry.boundingBox
              });
            }
          });

          resolve({
            type: 'obj',
            geometries,
            object
          });
        },
        undefined,
        reject
      );
    });
  }

  parseToothAnnotation(jsonData) {
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    
    return {
      caseId: data.caseId || 'unknown',
      position: data.position === 'lower' ? ToothPosition.MANDIBULAR : ToothPosition.MAXILLARY,
      teeth: data.teeth.map((tooth) => ({
        id: tooth.id,
        fdiNumber: tooth.fdiNumber || tooth.number,
        name: this.getToothName(tooth.fdiNumber || tooth.number),
        present: tooth.present !== false,
        hasAttachment: tooth.hasAttachment || false,
        attachment: tooth.attachment ? {
          type: tooth.attachment.type,
          position: new THREE.Vector3(
            tooth.attachment.position?.x || 0,
            tooth.attachment.position?.y || 0,
            tooth.attachment.position?.z || 0
          ),
          size: new THREE.Vector3(
            tooth.attachment.size?.x || 2,
            tooth.attachment.size?.y || 2,
            tooth.attachment.size?.z || 1
          ),
          rotation: tooth.attachment.rotation || 0
        } : null,
        movement: tooth.movement ? {
          translation: new THREE.Vector3(
            tooth.movement.translation?.x || 0,
            tooth.movement.translation?.y || 0,
            tooth.movement.translation?.z || 0
          ),
          rotation: new THREE.Euler(
            (tooth.movement.rotation?.x || 0) * Math.PI / 180,
            (tooth.movement.rotation?.y || 0) * Math.PI / 180,
            (tooth.movement.rotation?.z || 0) * Math.PI / 180
          )
        } : null,
        meshId: tooth.meshId || `tooth_${tooth.id}`
      })),
      unit: data.unit || 'mm',
      scale: data.scale || 1.0,
      notes: data.notes || ''
    };
  }

  parseToothAnnotationFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target.result;
          const data = JSON.parse(content);
          resolve(this.parseToothAnnotation(data));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  getToothName(fdiNumber) {
    const toothNames = {
      11: '右上中切牙', 12: '右上侧切牙', 13: '右上尖牙', 14: '右上第一前磨牙', 15: '右上第二前磨牙',
      16: '右上第一磨牙', 17: '右上第二磨牙', 18: '右上第三磨牙',
      21: '左上中切牙', 22: '左上侧切牙', 23: '左上尖牙', 24: '左上第一前磨牙', 25: '左上第二前磨牙',
      26: '左上第一磨牙', 27: '左上第二磨牙', 28: '左上第三磨牙',
      31: '左下中切牙', 32: '左下侧切牙', 33: '左下尖牙', 34: '左下第一前磨牙', 35: '左下第二前磨牙',
      36: '左下第一磨牙', 37: '左下第二磨牙', 38: '左下第三磨牙',
      41: '右下中切牙', 42: '右下侧切牙', 43: '右下尖牙', 44: '右下第一前磨牙', 45: '右下第二前磨牙',
      46: '右下第一磨牙', 47: '右下第二磨牙', 48: '右下第三磨牙'
    };
    return toothNames[fdiNumber] || `牙位 ${fdiNumber}`;
  }

  createToothAnnotation(annotation) {
    return {
      caseId: annotation.caseId,
      position: annotation.position === ToothPosition.MANDIBULAR ? 'lower' : 'upper',
      teeth: annotation.teeth.map((tooth) => ({
        id: tooth.id,
        fdiNumber: tooth.fdiNumber,
        number: tooth.fdiNumber,
        present: tooth.present,
        hasAttachment: tooth.hasAttachment,
        attachment: tooth.attachment ? {
          type: tooth.attachment.type,
          position: {
            x: tooth.attachment.position.x,
            y: tooth.attachment.position.y,
            z: tooth.attachment.position.z
          },
          size: {
            x: tooth.attachment.size.x,
            y: tooth.attachment.size.y,
            z: tooth.attachment.size.z
          },
          rotation: tooth.attachment.rotation
        } : null,
        movement: tooth.movement ? {
          translation: {
            x: tooth.movement.translation.x,
            y: tooth.movement.translation.y,
            z: tooth.movement.translation.z
          },
          rotation: {
            x: tooth.movement.rotation.x * 180 / Math.PI,
            y: tooth.movement.rotation.y * 180 / Math.PI,
            z: tooth.movement.rotation.z * 180 / Math.PI
          }
        } : null,
        meshId: tooth.meshId
      })),
      unit: annotation.unit,
      scale: annotation.scale,
      notes: annotation.notes
    };
  }
}

export default ModelParser;
