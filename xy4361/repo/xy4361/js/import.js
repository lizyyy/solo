// CSV导入模块
// 负责解析排练片段和目标音高表的CSV文件

const Import = (function() {
    // 解析CSV内容
    function parseCSV(content) {
        const lines = content.trim().split('\n');
        if (lines.length === 0) return [];

        // 解析表头
        const headers = parseCSVLine(lines[0]);
        const data = [];

        // 解析数据行
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header.trim()] = values[index].trim();
                });
                data.push(row);
            }
        }

        return data;
    }

    // 解析单行CSV（处理引号内的逗号）
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }

    // 读取文件内容
    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const content = event.target.result;
                    const data = parseCSV(content);
                    resolve(data);
                } catch (error) {
                    reject(new Error('CSV解析失败: ' + error.message));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('文件读取失败'));
            };
            
            reader.readAsText(file);
        });
    }

    // 验证排练数据格式
    function validateRehearsalData(data) {
        if (!data || data.length === 0) {
            return { valid: false, error: '排练数据为空' };
        }

        const requiredFields = ['时间', '声部', '基频', '响度', '歌词小节'];
        const firstRow = data[0];

        for (const field of requiredFields) {
            if (!(field in firstRow)) {
                return { 
                    valid: false, 
                    error: `缺少必需字段: ${field}。请确保CSV包含以下列: ${requiredFields.join(', ')}` 
                };
            }
        }

        return { valid: true };
    }

    // 验证目标音高表格式
    function validateTargetData(data) {
        if (!data || data.length === 0) {
            return { valid: false, error: '目标音高表数据为空' };
        }

        const requiredFields = ['声部', '小节', '目标音高', '时长'];
        const firstRow = data[0];

        for (const field of requiredFields) {
            if (!(field in firstRow)) {
                return { 
                    valid: false, 
                    error: `缺少必需字段: ${field}。请确保CSV包含以下列: ${requiredFields.join(', ')}` 
                };
            }
        }

        return { valid: true };
    }

    // 转换排练数据类型
    function convertRehearsalDataTypes(data) {
        return data.map(row => ({
            time: parseFloat(row['时间']) || 0,
            voice: row['声部'],
            frequency: parseFloat(row['基频']) || 0,
            loudness: parseFloat(row['响度']) || 0,
            measure: row['歌词小节'],
            original: row
        }));
    }

    // 转换目标音高表数据类型
    function convertTargetDataTypes(data) {
        return data.map(row => ({
            voice: row['声部'],
            measure: row['小节'],
            targetPitch: row['目标音高'],
            targetFrequency: noteToFrequency(row['目标音高']),
            duration: parseFloat(row['时长']) || 0,
            original: row
        }));
    }

    // 音符名转换为频率
    function noteToFrequency(note) {
        // 简单的音符到频率转换（基于A4=440Hz）
        const noteMap = {
            'C0': 16.35, 'C#0': 17.32, 'Db0': 17.32, 'D0': 18.35, 'D#0': 19.45, 'Eb0': 19.45,
            'E0': 20.60, 'F0': 21.83, 'F#0': 23.12, 'Gb0': 23.12, 'G0': 24.50, 'G#0': 25.96, 'Ab0': 25.96,
            'A0': 27.50, 'A#0': 29.14, 'Bb0': 29.14, 'B0': 30.87,
            'C1': 32.70, 'C#1': 34.65, 'Db1': 34.65, 'D1': 36.71, 'D#1': 38.89, 'Eb1': 38.89,
            'E1': 41.20, 'F1': 43.65, 'F#1': 46.25, 'Gb1': 46.25, 'G1': 49.00, 'G#1': 51.91, 'Ab1': 51.91,
            'A1': 55.00, 'A#1': 58.27, 'Bb1': 58.27, 'B1': 61.74,
            'C2': 65.41, 'C#2': 69.30, 'Db2': 69.30, 'D2': 73.42, 'D#2': 77.78, 'Eb2': 77.78,
            'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'Gb2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'Ab2': 103.83,
            'A2': 110.00, 'A#2': 116.54, 'Bb2': 116.54, 'B2': 123.47,
            'C3': 130.81, 'C#3': 138.59, 'Db3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'Eb3': 155.56,
            'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'Gb3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'Ab3': 207.65,
            'A3': 220.00, 'A#3': 233.08, 'Bb3': 233.08, 'B3': 246.94,
            'C4': 261.63, 'C#4': 277.18, 'Db4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'Eb4': 311.13,
            'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'Gb4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'Ab4': 415.30,
            'A4': 440.00, 'A#4': 466.16, 'Bb4': 466.16, 'B4': 493.88,
            'C5': 523.25, 'C#5': 554.37, 'Db5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'Eb5': 622.25,
            'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'Gb5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'Ab5': 830.61,
            'A5': 880.00, 'A#5': 932.33, 'Bb5': 932.33, 'B5': 987.77,
            'C6': 1046.50, 'C#6': 1108.73, 'Db6': 1108.73, 'D6': 1174.66, 'D#6': 1244.51, 'Eb6': 1244.51,
            'E6': 1318.51, 'F6': 1396.91, 'F#6': 1479.98, 'Gb6': 1479.98, 'G6': 1567.98, 'G#6': 1661.22, 'Ab6': 1661.22,
            'A6': 1760.00, 'A#6': 1864.66, 'Bb6': 1864.66, 'B6': 1975.53,
            'C7': 2093.00, 'C#7': 2217.46, 'Db7': 2217.46, 'D7': 2349.32, 'D#7': 2489.02, 'Eb7': 2489.02,
            'E7': 2637.02, 'F7': 2793.83, 'F#7': 2959.96, 'Gb7': 2959.96, 'G7': 3135.96, 'G#7': 3322.44, 'Ab7': 3322.44,
            'A7': 3520.00, 'A#7': 3729.31, 'Bb7': 3729.31, 'B7': 3951.07,
            'C8': 4186.01
        };

        // 标准化音符名（处理大小写和空格）
        const standardNote = note.trim().toUpperCase();
        
        // 尝试直接查找
        if (noteMap[standardNote]) {
            return noteMap[standardNote];
        }

        // 尝试不同的写法（如C4和C4都应该匹配）
        const noteMatch = note.match(/^([A-Ga-g])(#|b|)?(\d+)$/);
        if (noteMatch) {
            const noteName = noteMatch[1].toUpperCase();
            const accidental = noteMatch[2] || '';
            const octave = parseInt(noteMatch[3]);
            
            let lookupName = noteName;
            if (accidental === '#') {
                lookupName += '#';
            } else if (accidental === 'b') {
                lookupName += 'b';
            }
            lookupName += octave;
            
            if (noteMap[lookupName]) {
                return noteMap[lookupName];
            }
        }

        // 如果无法识别，返回0表示未知
        console.warn(`无法识别的音符: ${note}`);
        return 0;
    }

    // 导入排练数据
    async function importRehearsalFile(file) {
        try {
            const rawData = await readFile(file);
            const validation = validateRehearsalData(rawData);
            
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            const convertedData = convertRehearsalDataTypes(rawData);
            Storage.saveRehearsalData(convertedData);
            
            return { 
                success: true, 
                data: convertedData,
                count: convertedData.length
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 导入目标音高表
    async function importTargetFile(file) {
        try {
            const rawData = await readFile(file);
            const validation = validateTargetData(rawData);
            
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            const convertedData = convertTargetDataTypes(rawData);
            Storage.saveTargetData(convertedData);
            
            return { 
                success: true, 
                data: convertedData,
                count: convertedData.length
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    return {
        // 核心方法
        readFile,
        parseCSV,
        
        // 导入方法
        importRehearsalFile,
        importTargetFile,
        
        // 验证方法
        validateRehearsalData,
        validateTargetData,
        
        // 工具方法
        noteToFrequency,
        convertRehearsalDataTypes,
        convertTargetDataTypes
    };
})();

// 导出Import对象（在浏览器环境中直接可用）
if (typeof window !== 'undefined') {
    window.Import = Import;
}
