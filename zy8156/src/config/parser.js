import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import csv from 'csv-parser';
import { Readable } from 'stream';

export class ConfigParser {
  constructor(baseDir) {
    this.baseDir = baseDir;
  }

  async parseYaml(filePath) {
    const fullPath = path.resolve(this.baseDir, filePath);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return yaml.load(content);
    } catch (error) {
      throw new Error(`Failed to parse YAML file ${filePath}: ${error.message}`);
    }
  }

  async parseJson(filePath) {
    const fullPath = path.resolve(this.baseDir, filePath);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse JSON file ${filePath}: ${error.message}`);
    }
  }

  async parseCsv(filePath) {
    const fullPath = path.resolve(this.baseDir, filePath);
    const results = [];
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const stream = Readable.from(content);
      
      return new Promise((resolve, reject) => {
        stream
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', (error) => reject(new Error(`Failed to parse CSV file ${filePath}: ${error.message}`)));
      });
    } catch (error) {
      throw new Error(`Failed to read CSV file ${filePath}: ${error.message}`);
    }
  }

  async parseCalibrationFiles(calibrationDir = 'calibration') {
    const calibrationPath = path.resolve(this.baseDir, calibrationDir);
    const files = [];
    
    try {
      const dirEntries = await fs.readdir(calibrationPath, { withFileTypes: true });
      
      for (const entry of dirEntries) {
        if (entry.isFile() && entry.name.endsWith('.json')) {
          const filePath = path.join(calibrationPath, entry.name);
          const content = await this.parseJson(filePath);
          files.push({
            fileName: entry.name,
            filePath: path.relative(this.baseDir, filePath),
            content
          });
        }
      }
      
      return files;
    } catch (error) {
      throw new Error(`Failed to parse calibration directory: ${error.message}`);
    }
  }

  async parseAll(releasePolicyPath = 'release_policy.yaml') {
    const releasePolicy = await this.parseYaml(releasePolicyPath);
    
    const cameraProfilesPath = releasePolicy.camera_profiles || 'camera_profiles.yaml';
    const sensorModesPath = releasePolicy.sensor_modes || 'sensor_modes.csv';
    const calibrationDir = releasePolicy.calibration_dir || 'calibration';
    
    const cameraProfiles = await this.parseYaml(cameraProfilesPath);
    const sensorModes = await this.parseCsv(sensorModesPath);
    const calibrationFiles = await this.parseCalibrationFiles(calibrationDir);
    
    return {
      releasePolicy,
      cameraProfiles,
      sensorModes,
      calibrationFiles
    };
  }
}
