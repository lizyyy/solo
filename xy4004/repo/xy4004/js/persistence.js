(function(global) {
    'use strict';

    const Persistence = {
        STORAGE_KEY: 'cue_beat_board_data',
        META_KEY: 'cue_beat_board_meta',

        isAvailable: function() {
            try {
                const testKey = '__storage_test__';
                localStorage.setItem(testKey, testKey);
                localStorage.removeItem(testKey);
                return true;
            } catch (e) {
                return false;
            }
        },

        save: function(state) {
            if (!this.isAvailable()) {
                console.warn('localStorage 不可用，数据无法保存');
                return false;
            }

            try {
                const dataToSave = {
                    version: state.version,
                    timestamp: Date.now(),
                    cues: state.cues.map(cue => this.cleanCueForStorage(cue))
                };

                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToSave));
                this.updateMeta();
                return true;
            } catch (e) {
                console.error('保存数据失败:', e);
                return false;
            }
        },

        cleanCueForStorage: function(cue) {
            return {
                id: cue.id,
                number: cue.number,
                startTime: cue.startTime,
                duration: cue.duration,
                description: cue.description,
                group: cue.group,
                dependsOn: cue.dependsOn,
                riskLevel: cue.riskLevel,
                notes: cue.notes,
                order: cue.order,
                actualStartTime: cue.actualStartTime,
                actualEndTime: cue.actualEndTime,
                status: cue.status
            };
        },

        load: function() {
            if (!this.isAvailable()) {
                console.warn('localStorage 不可用，无法加载数据');
                return null;
            }

            try {
                const storedData = localStorage.getItem(this.STORAGE_KEY);
                if (!storedData) {
                    return null;
                }

                const parsedData = JSON.parse(storedData);
                
                if (!parsedData.cues || !Array.isArray(parsedData.cues)) {
                    console.error('存储的数据格式错误');
                    return null;
                }

                return {
                    version: parsedData.version || '1.0.0',
                    timestamp: parsedData.timestamp,
                    cues: parsedData.cues
                };
            } catch (e) {
                console.error('加载数据失败:', e);
                return null;
            }
        },

        updateMeta: function() {
            if (!this.isAvailable()) return;

            try {
                const meta = {
                    lastSaved: Date.now(),
                    lastSavedFormatted: new Date().toISOString()
                };
                localStorage.setItem(this.META_KEY, JSON.stringify(meta));
            } catch (e) {
                console.error('更新元数据失败:', e);
            }
        },

        getMeta: function() {
            if (!this.isAvailable()) return null;

            try {
                const metaData = localStorage.getItem(this.META_KEY);
                return metaData ? JSON.parse(metaData) : null;
            } catch (e) {
                console.error('读取元数据失败:', e);
                return null;
            }
        },

        clear: function() {
            if (!this.isAvailable()) return false;

            try {
                localStorage.removeItem(this.STORAGE_KEY);
                localStorage.removeItem(this.META_KEY);
                return true;
            } catch (e) {
                console.error('清除数据失败:', e);
                return false;
            }
        },

        migrateData: function(data) {
            if (!data) return null;

            const version = data.version || '0.0.0';
            const migratedCues = data.cues || [];

            migratedCues.forEach((cue, index) => {
                if (!cue.id) {
                    cue.id = 'migrated_cue_' + Date.now() + '_' + index;
                }
                if (cue.order === undefined || cue.order === null) {
                    cue.order = index;
                }
                if (!cue.group) {
                    cue.group = '灯光';
                }
                if (!cue.riskLevel) {
                    cue.riskLevel = 'low';
                }
                if (cue.status === undefined) {
                    cue.status = 'pending';
                }
            });

            return {
                version: '1.0.0',
                timestamp: data.timestamp || Date.now(),
                cues: migratedCues
            };
        },

        getStorageInfo: function() {
            if (!this.isAvailable()) {
                return {
                    available: false,
                    message: 'localStorage 不可用'
                };
            }

            const meta = this.getMeta();
            const data = this.load();
            
            let usedBytes = 0;
            let totalBytes = 5 * 1024 * 1024;

            try {
                const allData = JSON.stringify(localStorage);
                usedBytes = new Blob([allData]).size;
            } catch (e) {
                usedBytes = -1;
            }

            return {
                available: true,
                lastSaved: meta ? meta.lastSaved : null,
                lastSavedFormatted: meta ? meta.lastSavedFormatted : null,
                cueCount: data ? data.cues.length : 0,
                version: data ? data.version : null,
                usedBytes: usedBytes,
                totalBytes: totalBytes,
                usedPercent: usedBytes > 0 ? (usedBytes / totalBytes * 100).toFixed(1) : '0'
            };
        },

        exportToJSON: function(state) {
            const exportData = {
                version: state.version,
                exportedAt: Date.now(),
                exportedAtFormatted: new Date().toISOString(),
                cues: state.cues.map(cue => ({
                    id: cue.id,
                    number: cue.number,
                    startTime: cue.startTime,
                    duration: cue.duration,
                    description: cue.description,
                    group: cue.group,
                    dependsOn: cue.dependsOn,
                    riskLevel: cue.riskLevel,
                    notes: cue.notes,
                    order: cue.order
                }))
            };

            return JSON.stringify(exportData, null, 2);
        },

        downloadJSON: function(jsonString, filename) {
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || 'cue_beat_board_' + this.formatDateForFilename() + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        formatDateForFilename: function() {
            const now = new Date();
            return now.getFullYear() +
                String(now.getMonth() + 1).padStart(2, '0') +
                String(now.getDate()).padStart(2, '0') + '_' +
                String(now.getHours()).padStart(2, '0') +
                String(now.getMinutes()).padStart(2, '0');
        }
    };

    global.Persistence = Persistence;

})(window);
