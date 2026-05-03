/**
 * 导入模块
 * 负责处理CSV轨迹和JSON地图文件的导入，包括文件读取、解析和校验
 */

import { CSVParser } from '../parsers/csvParser.js';
import { JSONMapParser } from '../parsers/jsonParser.js';
import store from '../state/store.js';
import { RiskRules } from '../risk/rules.js';

export class ImportManager {
    constructor(options = {}) {
        this.csvParser = new CSVParser(options.csvParserOptions);
        this.mapParser = new JSONMapParser(options.mapParserOptions);
        this.riskRules = new RiskRules(options.riskRulesOptions);
        
        this.options = {
            onImportStart: options.onImportStart || (() => {}),
            onImportComplete: options.onImportComplete || (() => {}),
            onImportError: options.onImportError || (() => {}),
            appendMode: options.appendMode !== false,
            ...options
        };
    }

    async importTrajectoryCSV(fileOrInput) {
        this.options.onImportStart('trajectory');

        try {
            let csvText;

            if (typeof fileOrInput === 'string') {
                csvText = fileOrInput;
            } else if (fileOrInput instanceof File) {
                csvText = await this.readFileAsText(fileOrInput);
            } else if (fileOrInput instanceof Event) {
                const file = fileOrInput.target.files[0];
                if (!file) {
                    throw new Error('No file selected');
                }
                csvText = await this.readFileAsText(file);
            } else {
                throw new Error('Invalid input type');
            }

            const parseResult = this.csvParser.parse(csvText);

            if (parseResult.statistics.validRows === 0 && parseResult.statistics.totalRows > 0) {
                this.options.onImportError({
                    type: 'trajectory',
                    error: 'No valid data rows found',
                    details: parseResult
                });
                return {
                    success: false,
                    error: 'No valid data rows found',
                    details: parseResult
                };
            }

            const existingData = store.getTrajectoryData();
            
            if (this.options.appendMode && existingData.length > 0) {
                store.appendTrajectoryData(
                    parseResult.validData,
                    parseResult.invalidRows,
                    parseResult.statistics
                );
            } else {
                store.setTrajectoryData(
                    parseResult.validData,
                    parseResult.invalidRows,
                    parseResult.statistics
                );
            }

            this.updateRisks();

            this.options.onImportComplete({
                type: 'trajectory',
                success: true,
                statistics: parseResult.statistics,
                invalidRows: parseResult.invalidRows
            });

            return {
                success: true,
                statistics: parseResult.statistics,
                invalidRows: parseResult.invalidRows,
                validDataCount: parseResult.validData.length
            };

        } catch (error) {
            this.options.onImportError({
                type: 'trajectory',
                error: error.message,
                stack: error.stack
            });

            return {
                success: false,
                error: error.message,
                stack: error.stack
            };
        }
    }

    async importMapJSON(fileOrInput) {
        this.options.onImportStart('map');

        try {
            let jsonText;

            if (typeof fileOrInput === 'string') {
                jsonText = fileOrInput;
            } else if (fileOrInput instanceof File) {
                jsonText = await this.readFileAsText(fileOrInput);
            } else if (fileOrInput instanceof Event) {
                const file = fileOrInput.target.files[0];
                if (!file) {
                    throw new Error('No file selected');
                }
                jsonText = await this.readFileAsText(file);
            } else {
                throw new Error('Invalid input type');
            }

            const parseResult = this.mapParser.parse(jsonText);

            if (!parseResult.valid) {
                this.options.onImportError({
                    type: 'map',
                    error: 'Map validation failed',
                    details: parseResult
                });
                return {
                    success: false,
                    error: 'Map validation failed',
                    details: parseResult
                };
            }

            store.setMapData(parseResult.mapData);

            const existingTrajectoryData = store.getTrajectoryData();
            if (existingTrajectoryData.length > 0) {
                this.updateRisks();
            }

            if (parseResult.warnings && parseResult.warnings.length > 0) {
                console.warn('Map import warnings:', parseResult.warnings);
            }

            this.options.onImportComplete({
                type: 'map',
                success: true,
                warnings: parseResult.warnings || [],
                mapData: parseResult.mapData
            });

            return {
                success: true,
                warnings: parseResult.warnings || [],
                mapData: parseResult.mapData
            };

        } catch (error) {
            this.options.onImportError({
                type: 'map',
                error: error.message,
                stack: error.stack
            });

            return {
                success: false,
                error: error.message,
                stack: error.stack
            };
        }
    }

    async readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                resolve(event.target.result);
            };
            
            reader.onerror = (event) => {
                reject(new Error(`File read error: ${reader.error}`));
            };
            
            reader.readAsText(file);
        });
    }

    updateRisks() {
        const trajectoryData = store.getTrajectoryData();
        const mapData = store.getMapData();

        if (trajectoryData.length === 0) {
            store.setRisks(null);
            return;
        }

        const risks = this.riskRules.detectRisks(trajectoryData, mapData);
        store.setRisks(risks);
    }

    setAppendMode(append) {
        this.options.appendMode = append;
    }

    getAppendMode() {
        return this.options.appendMode;
    }

    validateTrajectoryData(data) {
        const sampleCSV = this.generateSampleCSV(data);
        return this.csvParser.parse(sampleCSV);
    }

    generateSampleCSV(data) {
        if (!data || data.length === 0) {
            return '';
        }

        const headers = Object.keys(data[0]);
        let csv = headers.join(',') + '\n';

        const sampleData = data.slice(0, Math.min(100, data.length));
        
        sampleData.forEach(row => {
            const values = headers.map(header => {
                const value = row[header];
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            });
            csv += values.join(',') + '\n';
        });

        return csv;
    }

    getLastInvalidRows() {
        return store.getInvalidRows();
    }

    getLastParseStatistics() {
        return store.getParseStatistics();
    }

    createFileInput(accept = '.csv,.json', multiple = false) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.multiple = multiple;
        
        return input;
    }

    triggerFileInput(inputElement, callback) {
        inputElement.onchange = async (event) => {
            const files = event.target.files;
            const results = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const extension = file.name.split('.').pop().toLowerCase();

                let result;
                if (extension === 'csv') {
                    result = await this.importTrajectoryCSV(file);
                } else if (extension === 'json') {
                    result = await this.importMapJSON(file);
                } else {
                    result = {
                        success: false,
                        error: `Unsupported file type: .${extension}`
                    };
                }

                results.push({
                    fileName: file.name,
                    ...result
                });
            }

            if (callback) {
                callback(results);
            }

            inputElement.value = '';
        };

        inputElement.click();
    }
}

const importManager = new ImportManager();
export default importManager;
