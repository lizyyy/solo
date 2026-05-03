
class ImportExportManager {
    constructor(storageManager) {
        this.storage = storageManager;
    }

    parseCSV(csvString) {
        const lines = csvString.trim().split('\n');
        if (lines.length < 2) {
            return { success: false, error: 'CSV文件至少需要标题行和一行数据' };
        }

        const headers = this.parseCSVLine(lines[0]);
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;

            const values = this.parseCSVLine(lines[i]);
            if (values.length !== headers.length) {
                return { 
                    success: false, 
                    error: `第${i + 1}行数据列数与标题行不匹配` 
                };
            }

            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index];
            });
            data.push(row);
        }

        return { success: true, data, headers };
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"' && inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else if (char === '"') {
                inQuotes = !inQuotes;
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

    toCSV(data, headers) {
        if (!data || data.length === 0) {
            return '';
        }

        const actualHeaders = headers || Object.keys(data[0]);
        const lines = [];

        lines.push(actualHeaders.map(h => this.escapeCSVField(h)).join(','));

        data.forEach(row => {
            const values = actualHeaders.map(header => {
                const value = row[header] !== undefined ? row[header] : '';
                return this.escapeCSVField(String(value));
            });
            lines.push(values.join(','));
        });

        return lines.join('\n');
    }

    escapeCSVField(field) {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            return '"' + field.replace(/"/g, '""') + '"';
        }
        return field;
    }

    parseAthletesFromCSV(csvString, groupId) {
        const result = this.parseCSV(csvString);
        if (!result.success) {
            return result;
        }

        const { data, headers } = result;
        const athletes = [];
        const errors = [];

        const numberFields = ['number', '号码', '运动员号', 'id'];
        const nameFields = ['name', '姓名', '名字'];
        const teamFields = ['team', '队伍', '班级', '学校', '单位'];

        const numberHeader = headers.find(h => numberFields.includes(h.toLowerCase()));
        const nameHeader = headers.find(h => nameFields.includes(h.toLowerCase()));
        const teamHeader = headers.find(h => teamFields.includes(h.toLowerCase()));

        if (!numberHeader) {
            return { success: false, error: 'CSV中未找到号码列，支持的列名: number, 号码, 运动员号' };
        }

        if (!nameHeader) {
            return { success: false, error: 'CSV中未找到姓名列，支持的列名: name, 姓名' };
        }

        data.forEach((row, index) => {
            const number = String(row[numberHeader] || '').trim();
            const name = String(row[nameHeader] || '').trim();
            const team = teamHeader ? String(row[teamHeader] || '').trim() : '';

            if (!number) {
                errors.push(`第${index + 2}行: 号码不能为空`);
                return;
            }

            if (!name) {
                errors.push(`第${index + 2}行: 姓名不能为空`);
                return;
            }

            athletes.push({
                number,
                name,
                team,
                groupId,
                status: 'checked_in'
            });
        });

        if (errors.length > 0) {
            return { success: false, errors };
        }

        return { success: true, athletes, count: athletes.length };
    }

    athletesToCSV(athletes) {
        if (!athletes || athletes.length === 0) {
            return '';
        }

        const data = athletes.map(athlete => ({
            号码: athlete.number || '',
            姓名: athlete.name || '',
            队伍: athlete.team || '',
            分组ID: athlete.groupId || '',
            状态: athlete.status || 'checked_in'
        }));

        return this.toCSV(data);
    }

    resultsToCSV(results, rulesEngine) {
        if (!results || results.length === 0) {
            return '';
        }

        const data = results.map(result => {
            const scored = rulesEngine.calculateEffectiveScore(result, result.eventType);
            return {
                号码: result.athleteNumber || '',
                姓名: result.athleteName || '',
                队伍: result.team || '',
                项目: rulesEngine.getEventName(result.eventType),
                有效次数: result.rawCount || 0,
                失误: result.errorCount || 0,
                犯规: result.foulCount || 0,
                成绩: scored.score || 0,
                状态: result.confirmed ? '已确认' : '待确认',
                备注: result.exceptionNotes || ''
            };
        });

        return this.toCSV(data);
    }

    exportToJSON(data, filename) {
        const jsonString = JSON.stringify(data, null, 2);
        this.downloadFile(jsonString, filename, 'application/json');
    }

    exportToCSV(csvString, filename) {
        this.downloadFile(csvString, filename, 'text/csv;charset=utf-8');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    async importFromFile(file) {
        const text = await this.readFileAsText(file);
        const filename = file.name.toLowerCase();

        if (filename.endsWith('.json')) {
            try {
                const data = JSON.parse(text);
                return { type: 'json', data };
            } catch (e) {
                return { type: 'json', error: 'JSON格式解析错误: ' + e.message };
            }
        } else if (filename.endsWith('.csv')) {
            return { type: 'csv', content: text };
        } else {
            return { error: '不支持的文件格式' };
        }
    }

    exportAthletes(athletes, format = 'csv') {
        const timestamp = this.getTimestamp();
        
        if (format === 'json') {
            this.exportToJSON(athletes, `athletes_${timestamp}.json`);
        } else {
            const csv = this.athletesToCSV(athletes);
            this.exportToCSV(csv, `athletes_${timestamp}.csv`);
        }
    }

    exportResults(results, rulesEngine, format = 'csv') {
        const timestamp = this.getTimestamp();
        
        if (format === 'json') {
            this.exportToJSON(results, `results_${timestamp}.json`);
        } else {
            const csv = this.resultsToCSV(results, rulesEngine);
            this.exportToCSV(csv, `results_${timestamp}.csv`);
        }
    }

    exportAllData(storageManager, format = 'json') {
        const data = storageManager.exportAllData();
        const timestamp = this.getTimestamp();
        
        if (format === 'json') {
            this.exportToJSON(data, `all_data_${timestamp}.json`);
        } else {
            const athletes = data.athletes || [];
            const results = data.results || [];
            
            this.exportAthletes(athletes, 'csv');
            if (results.length > 0) {
                this.exportResults(results, new (require('./rulesEngine').default)(), 'csv');
            }
        }
    }

    getTimestamp() {
        const now = new Date();
        return now.toISOString().slice(0, 10) + '_' + 
               now.toTimeString().slice(0, 8).replace(/:/g, '-');
    }
}

export default ImportExportManager;
