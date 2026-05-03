/**
 * CSV轨迹解析和校验模块
 * 负责解析车辆轨迹CSV数据并进行严格的数据校验
 */

export class CSVParser {
    constructor(options = {}) {
        this.options = {
            maxSpeed: options.maxSpeed || 15,
            warehouseBounds: options.warehouseBounds || { minX: 0, maxX: 100, minY: 0, maxY: 100, minZ: 0, maxZ: 5 },
            requiredFields: options.requiredFields || ['vehicleId', 'timestamp', 'x', 'y', 'speed'],
            ...options
        };
    }

    parse(csvText) {
        const result = {
            validData: [],
            invalidRows: [],
            statistics: {
                totalRows: 0,
                validRows: 0,
                invalidRows: 0,
                errorsByType: {
                    missingFields: 0,
                    timeOutOfOrder: 0,
                    outOfBounds: 0,
                    speedAbnormal: 0,
                    invalidFormat: 0
                }
            }
        };

        if (!csvText || csvText.trim() === '') {
            return result;
        }

        const lines = csvText.trim().split('\n');
        if (lines.length < 2) {
            return result;
        }

        const headerLine = lines[0];
        const headers = this.parseCSVLine(headerLine);
        
        result.statistics.totalRows = lines.length - 1;

        const headerIndex = {};
        headers.forEach((header, index) => {
            headerIndex[header.trim()] = index;
        });

        const requiredFields = this.options.requiredFields;
        const missingHeaders = requiredFields.filter(field => !(field in headerIndex));
        
        if (missingHeaders.length > 0) {
            result.invalidRows.push({
                rowNumber: 0,
                rowData: headerLine,
                errors: [`Missing required headers: ${missingHeaders.join(', ')}`],
                errorType: 'missingFields'
            });
            return result;
        }

        const vehicleTimestamps = {};

        for (let i = 1; i < lines.length; i++) {
            const lineNumber = i + 1;
            const line = lines[i];
            
            if (line.trim() === '') continue;

            const parsedResult = this.parseAndValidateLine(line, headerIndex, vehicleTimestamps, lineNumber);
            
            if (parsedResult.valid) {
                result.validData.push(parsedResult.data);
                result.statistics.validRows++;
            } else {
                result.invalidRows.push(parsedResult.error);
                result.statistics.invalidRows++;
                
                if (parsedResult.error.errorType in result.statistics.errorsByType) {
                    result.statistics.errorsByType[parsedResult.error.errorType]++;
                }
            }
        }

        result.validData.sort((a, b) => a.timestamp - b.timestamp);

        return result;
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    parseAndValidateLine(line, headerIndex, vehicleTimestamps, lineNumber) {
        const values = this.parseCSVLine(line);
        const errors = [];
        const errorTypes = [];

        const data = {};

        const vehicleIdValue = values[headerIndex['vehicleId']];
        if (!vehicleIdValue || vehicleIdValue.trim() === '') {
            errors.push('Vehicle ID is missing or empty');
            errorTypes.push('missingFields');
        }
        data.vehicleId = vehicleIdValue ? vehicleIdValue.trim() : null;

        const timestampValue = values[headerIndex['timestamp']];
        let timestamp = null;
        
        if (!timestampValue || timestampValue.trim() === '') {
            errors.push('Timestamp is missing or empty');
            errorTypes.push('missingFields');
        } else {
            try {
                if (typeof timestampValue === 'string' && !isNaN(Number(timestampValue))) {
                    timestamp = Number(timestampValue);
                } else {
                    timestamp = new Date(timestampValue).getTime();
                    if (isNaN(timestamp)) {
                        throw new Error('Invalid date format');
                    }
                }
                data.timestamp = timestamp;
            } catch (e) {
                errors.push(`Invalid timestamp format: ${timestampValue}`);
                errorTypes.push('invalidFormat');
            }
        }

        const x = this.parseCoordinate(values[headerIndex['x']], 'X');
        const y = this.parseCoordinate(values[headerIndex['y']], 'Y');
        const z = headerIndex['z'] !== undefined ? this.parseCoordinate(values[headerIndex['z']], 'Z') : 0;

        if (x.error) {
            errors.push(x.error);
            errorTypes.push('invalidFormat');
        }
        if (y.error) {
            errors.push(y.error);
            errorTypes.push('invalidFormat');
        }

        data.x = x.value;
        data.y = y.value;
        data.z = z.value || 0;

        if (data.x !== null && data.y !== null) {
            const bounds = this.options.warehouseBounds;
            if (data.x < bounds.minX || data.x > bounds.maxX ||
                data.y < bounds.minY || data.y > bounds.maxY ||
                data.z < bounds.minZ || data.z > bounds.maxZ) {
                errors.push(`Coordinates out of bounds: (${data.x}, ${data.y}, ${data.z}) - bounds: [${bounds.minX},${bounds.maxX}] x [${bounds.minY},${bounds.maxY}] x [${bounds.minZ},${bounds.maxZ}]`);
                errorTypes.push('outOfBounds');
            }
        }

        let speed = null;
        const speedValue = values[headerIndex['speed']];
        if (speedValue === undefined || speedValue === null || speedValue.trim() === '') {
            errors.push('Speed is missing or empty');
            errorTypes.push('missingFields');
        } else {
            speed = parseFloat(speedValue);
            if (isNaN(speed)) {
                errors.push(`Invalid speed value: ${speedValue}`);
                errorTypes.push('invalidFormat');
            } else if (speed < 0 || speed > this.options.maxSpeed) {
                errors.push(`Speed abnormal: ${speed} (max allowed: ${this.options.maxSpeed})`);
                errorTypes.push('speedAbnormal');
            }
            data.speed = speed;
        }

        if (data.vehicleId && data.timestamp !== null) {
            if (!vehicleTimestamps[data.vehicleId]) {
                vehicleTimestamps[data.vehicleId] = [];
            }
            
            const timestamps = vehicleTimestamps[data.vehicleId];
            if (timestamps.length > 0) {
                const lastTimestamp = timestamps[timestamps.length - 1];
                if (data.timestamp < lastTimestamp) {
                    errors.push(`Timestamp out of order for vehicle ${data.vehicleId}: current ${data.timestamp} < previous ${lastTimestamp}`);
                    errorTypes.push('timeOutOfOrder');
                }
            }
            timestamps.push(data.timestamp);
        }

        if (errorTypes.length > 0) {
            const primaryErrorType = errorTypes[0];
            return {
                valid: false,
                error: {
                    rowNumber: lineNumber,
                    rowData: line,
                    errors: errors,
                    errorType: primaryErrorType
                }
            };
        }

        return {
            valid: true,
            data: data
        };
    }

    parseCoordinate(value, axisName) {
        if (value === undefined || value === null || value.trim() === '') {
            return { error: `${axisName} coordinate is missing or empty`, value: null };
        }

        const num = parseFloat(value);
        if (isNaN(num)) {
            return { error: `Invalid ${axisName} coordinate: ${value}`, value: null };
        }

        return { value: num, error: null };
    }

    mergeWithExistingData(newData, existingData) {
        const mergedTimestamps = new Set();
        
        existingData.forEach(item => {
            mergedTimestamps.add(`${item.vehicleId}_${item.timestamp}`);
        });

        const filteredNewData = newData.filter(item => {
            const key = `${item.vehicleId}_${item.timestamp}`;
            if (mergedTimestamps.has(key)) {
                return false;
            }
            mergedTimestamps.add(key);
            return true;
        });

        return [...existingData, ...filteredNewData].sort((a, b) => a.timestamp - b.timestamp);
    }
}

export default CSVParser;
