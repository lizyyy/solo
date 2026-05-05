/**
 * 数据解析模块
 * 用于解析各种击剑比赛数据格式
 */

const DataParser = {
    // 解析CSV格式
    parseCSV: function(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length === 0) return [];
        
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index];
                });
                data.push(row);
            }
        }
        
        return data;
    },
    
    // 解析JSON格式
    parseJSON: function(jsonText) {
        try {
            return JSON.parse(jsonText);
        } catch (e) {
            console.error('JSON解析错误:', e);
            return null;
        }
    },
    
    // 自动检测数据格式并解析
    parseAuto: function(text) {
        // 尝试JSON
        if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
            const json = this.parseJSON(text);
            if (json !== null) return { format: 'json', data: json };
        }
        
        // 尝试CSV
        const csv = this.parseCSV(text);
        if (csv.length > 0) return { format: 'csv', data: csv };
        
        return { format: 'unknown', data: null };
    },
    
    // 解析得分日志
    parseScoreLog: function(text) {
        const parsed = this.parseAuto(text);
        if (parsed.data === null) return null;
        
        // 标准化数据格式
        return parsed.data.map(item => ({
            boutId: item.boutId || item.id || item['剑次ID'] || Math.random().toString(36).substr(2, 9),
            timestamp: item.timestamp || item.time || item['时间'] || null,
            piste: item.piste || item['场地'] || item.pisteNumber || null,
            fencer1: item.fencer1 || item['选手1'] || item.leftFencer || null,
            fencer2: item.fencer2 || item['选手2'] || item.rightFencer || null,
            score1: parseInt(item.score1 || item['比分1'] || item.leftScore || 0),
            score2: parseInt(item.score2 || item['比分2'] || item.rightScore || 0),
            winner: item.winner || item['获胜者'] || null,
            lightStatus: item.lightStatus || item['灯状态'] || item.lights || null,
            isDoubleLight: item.isDoubleLight === 'true' || item.isDoubleLight === true || 
                           (item['双灯'] === '是' || item['双灯'] === true),
            pauseBefore: item.pauseBefore === 'true' || item.pauseBefore === true || 
                        (item['暂停前'] === '是' || item['暂停前'] === true),
            notes: item.notes || item['备注'] || null
        }));
    },
    
    // 解析场地轮次表
    parseRoundSchedule: function(text) {
        const parsed = this.parseAuto(text);
        if (parsed.data === null) return null;
        
        // 标准化数据格式
        return parsed.data.map(item => ({
            roundId: item.roundId || item.id || item['轮次ID'] || Math.random().toString(36).substr(2, 9),
            roundNumber: parseInt(item.roundNumber || item['轮次号'] || item.round || 0),
            piste: item.piste || item['场地'] || item.pisteNumber || null,
            fencer1: item.fencer1 || item['选手1'] || item.leftFencer || null,
            fencer2: item.fencer2 || item['选手2'] || item.rightFencer || null,
            startTime: item.startTime || item['开始时间'] || null,
            endTime: item.endTime || item['结束时间'] || null,
            isBye: item.isBye === 'true' || item.isBye === true || 
                  (item['轮空'] === '是' || item['轮空'] === true),
            byeFencer: item.byeFencer || item['轮空选手'] || null,
            status: item.status || item['状态'] || null
        }));
    },
    
    // 解析视频时间码
    parseVideoTimestamps: function(text) {
        const parsed = this.parseAuto(text);
        if (parsed.data === null) return null;
        
        // 标准化数据格式
        return parsed.data.map(item => ({
            timestampId: item.timestampId || item.id || item['时间码ID'] || Math.random().toString(36).substr(2, 9),
            boutId: item.boutId || item['剑次ID'] || null,
            videoTime: item.videoTime || item['视频时间'] || item.timecode || null,
            realTime: item.realTime || item['实际时间'] || null,
            description: item.description || item['描述'] || item.notes || null,
            isKeyMoment: item.isKeyMoment === 'true' || item.isKeyMoment === true || 
                         (item['关键时刻'] === '是' || item['关键时刻'] === true)
        }));
    },
    
    // 解析裁判备注
    parseRefereeNotes: function(text) {
        const parsed = this.parseAuto(text);
        if (parsed.data === null) return null;
        
        // 标准化数据格式
        return parsed.data.map(item => ({
            noteId: item.noteId || item.id || item['备注ID'] || Math.random().toString(36).substr(2, 9),
            boutId: item.boutId || item['剑次ID'] || null,
            timestamp: item.timestamp || item['时间'] || null,
            referee: item.referee || item['裁判'] || null,
            noteType: item.noteType || item['备注类型'] || item.type || null,
            content: item.content || item['内容'] || item.notes || null,
            isReversal: item.isReversal === 'true' || item.isReversal === true || 
                       (item['改判'] === '是' || item['改判'] === true),
            reversalReason: item.reversalReason || item['改判理由'] || null
        }));
    },
    
    // 生成示例数据
    generateSampleData: function() {
        const fencers = ['张三', '李四', '王五', '赵六', '钱七', '孙八'];
        const pistes = ['1号场地', '2号场地', '3号场地'];
        
        // 生成得分日志
        const scoreLogs = [];
        let boutIndex = 1;
        
        // 场地1比赛
        for (let i = 0; i < 15; i++) {
            const isDoubleLight = i === 5 || i === 10;
            const isMissed = i === 7;
            const isPauseBefore = i === 12;
            
            scoreLogs.push({
                boutId: `B00${boutIndex++}`,
                timestamp: `10:${30 + i}:00`,
                piste: '1号场地',
                fencer1: '张三',
                fencer2: '李四',
                score1: Math.floor(i / 2),
                score2: Math.floor((i + 1) / 2),
                winner: i % 2 === 0 ? '张三' : '李四',
                lightStatus: isDoubleLight ? '双灯' : (i % 2 === 0 ? '红灯' : '绿灯'),
                isDoubleLight: isDoubleLight,
                pauseBefore: isPauseBefore,
                notes: isMissed ? '疑似漏记一剑' : null
            });
        }
        
        // 场地2比赛
        for (let i = 0; i < 12; i++) {
            const isDoubleLight = i === 3 || i === 8;
            const isScoreMismatch = i === 6;
            
            scoreLogs.push({
                boutId: `B00${boutIndex++}`,
                timestamp: `10:${45 + i}:00`,
                piste: '2号场地',
                fencer1: '王五',
                fencer2: '赵六',
                score1: Math.floor(i / 2) + (isScoreMismatch ? 2 : 0),
                score2: Math.floor((i + 1) / 2),
                winner: i % 2 === 0 ? '王五' : '赵六',
                lightStatus: isDoubleLight ? '双灯' : (i % 2 === 0 ? '红灯' : '绿灯'),
                isDoubleLight: isDoubleLight,
                pauseBefore: isScoreMismatch,
                notes: isScoreMismatch ? '暂停后比分疑似错位' : null
            });
        }
        
        // 生成场地轮次表
        const roundSchedule = [
            {
                roundId: 'R001',
                roundNumber: 1,
                piste: '1号场地',
                fencer1: '张三',
                fencer2: '李四',
                startTime: '10:30:00',
                endTime: '10:50:00',
                isBye: false,
                byeFencer: null,
                status: '已完成'
            },
            {
                roundId: 'R002',
                roundNumber: 1,
                piste: '2号场地',
                fencer1: '王五',
                fencer2: '赵六',
                startTime: '10:45:00',
                endTime: '11:05:00',
                isBye: false,
                byeFencer: null,
                status: '已完成'
            },
            {
                roundId: 'R003',
                roundNumber: 1,
                piste: '3号场地',
                fencer1: '钱七',
                fencer2: '孙八',
                startTime: '10:30:00',
                endTime: '10:55:00',
                isBye: false,
                byeFencer: null,
                status: '已完成'
            },
            {
                roundId: 'R004',
                roundNumber: 2,
                piste: '1号场地',
                fencer1: '张三',
                fencer2: '王五',
                startTime: '11:00:00',
                endTime: '11:20:00',
                isBye: false,
                byeFencer: null,
                status: '进行中'
            },
            {
                roundId: 'R005',
                roundNumber: 2,
                piste: '2号场地',
                fencer1: '李四',
                fencer2: '钱七',
                startTime: '11:05:00',
                endTime: '11:25:00',
                isBye: false,
                byeFencer: null,
                status: '未开始'
            },
            {
                roundId: 'R006',
                roundNumber: 2,
                piste: '3号场地',
                fencer1: '赵六',
                fencer2: null,
                startTime: '11:00:00',
                endTime: '11:05:00',
                isBye: true,
                byeFencer: '赵六',
                status: '轮空'
            }
        ];
        
        // 生成视频时间码
        const videoTimestamps = [
            {
                timestampId: 'T001',
                boutId: 'B006',
                videoTime: '00:05:30',
                realTime: '10:35:00',
                description: '双灯争议时刻',
                isKeyMoment: true
            },
            {
                timestampId: 'T002',
                boutId: 'B008',
                videoTime: '00:07:45',
                realTime: '10:37:00',
                description: '疑似漏记一剑',
                isKeyMoment: true
            },
            {
                timestampId: 'T003',
                boutId: 'B011',
                videoTime: '00:10:15',
                realTime: '10:40:00',
                description: '双灯争议时刻',
                isKeyMoment: true
            },
            {
                timestampId: 'T004',
                boutId: 'B013',
                videoTime: '00:12:30',
                realTime: '10:42:00',
                description: '暂停后恢复比赛',
                isKeyMoment: true
            },
            {
                timestampId: 'T005',
                boutId: 'B017',
                videoTime: '00:18:00',
                realTime: '10:48:00',
                description: '暂停后比分疑似错位',
                isKeyMoment: true
            }
        ];
        
        // 生成裁判备注
        const refereeNotes = [
            {
                noteId: 'N001',
                boutId: 'B006',
                timestamp: '10:35:00',
                referee: '王裁判',
                noteType: '双灯争议',
                content: '双方同时击中，需要查看慢动作回放',
                isReversal: false,
                reversalReason: null
            },
            {
                noteId: 'N002',
                boutId: 'B008',
                timestamp: '10:37:00',
                referee: '王裁判',
                noteType: '疑似漏记',
                content: '张三疑似击中但未亮灯，需要确认',
                isReversal: false,
                reversalReason: null
            },
            {
                noteId: 'N003',
                boutId: 'B017',
                timestamp: '10:48:00',
                referee: '李裁判',
                noteType: '比分异议',
                content: '暂停后王五的比分疑似多算了2分',
                isReversal: false,
                reversalReason: null
            }
        ];
        
        return {
            scoreLogs: scoreLogs,
            roundSchedule: roundSchedule,
            videoTimestamps: videoTimestamps,
            refereeNotes: refereeNotes
        };
    }
};

// 导出模块（用于Node.js环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataParser;
}
