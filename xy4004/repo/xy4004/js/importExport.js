(function(global) {
    'use strict';

    const ImportExport = {
        onImportSuccess: null,
        onImportError: null,
        onImportWarning: null,

        setCallbacks: function(success, error, warning) {
            this.onImportSuccess = success;
            this.onImportError = error;
            this.onImportWarning = warning;
        },

        exportData: function(state) {
            if (!state || !state.cues) {
                this.triggerError('没有可导出的数据');
                return false;
            }

            try {
                const exportData = {
                    version: '1.0.0',
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

                const jsonString = JSON.stringify(exportData, null, 2);
                this.downloadFile(jsonString, this.generateFilename());
                
                if (this.onImportSuccess) {
                    this.onImportSuccess(`成功导出 ${exportData.cues.length} 个 Cue`);
                }
                return true;
            } catch (e) {
                console.error('导出失败:', e);
                this.triggerError('导出数据失败: ' + e.message);
                return false;
            }
        },

        generateFilename: function() {
            const now = new Date();
            const dateStr = now.getFullYear() +
                String(now.getMonth() + 1).padStart(2, '0') +
                String(now.getDate()).padStart(2, '0');
            const timeStr = String(now.getHours()).padStart(2, '0') +
                String(now.getMinutes()).padStart(2, '0');
            return `换景节拍板_${dateStr}_${timeStr}.json`;
        },

        downloadFile: function(content, filename) {
            const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        importFromFile: function(file, callback) {
            if (!file) {
                this.triggerError('请选择要导入的文件');
                return;
            }

            if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
                this.triggerError('请选择 JSON 格式的文件');
                return;
            }

            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const content = e.target.result;
                    this.importFromJSON(content, callback);
                } catch (e) {
                    console.error('读取文件失败:', e);
                    this.triggerError('读取文件失败: ' + e.message);
                }
            };

            reader.onerror = () => {
                this.triggerError('文件读取错误');
            };

            reader.readAsText(file);
        },

        importFromJSON: function(jsonString, callback) {
            let parsedData;
            
            try {
                parsedData = JSON.parse(jsonString);
            } catch (e) {
                console.error('JSON 解析失败:', e);
                this.triggerError('JSON 格式错误，无法解析');
                return;
            }

            const validation = Validation.validateImportAndRepair(parsedData);

            if (!validation.valid) {
                const errorMessages = validation.issues.join('\n');
                this.triggerError('导入数据校验失败:\n' + errorMessages);
                return;
            }

            if (validation.warnings && validation.warnings.length > 0) {
                const warningMessages = validation.warnings.join('\n');
                this.triggerWarning('导入警告:\n' + warningMessages);
            }

            const cuesToImport = validation.repairedCues || parsedData.cues || [];

            if (cuesToImport.length === 0) {
                this.triggerWarning('导入的数据中没有 Cue');
                return;
            }

            const result = {
                cues: cuesToImport,
                version: parsedData.version || '1.0.0',
                warnings: validation.warnings || [],
                cueCount: cuesToImport.length
            };

            if (callback) {
                callback(result);
            }

            if (this.onImportSuccess) {
                this.onImportSuccess(`准备导入 ${cuesToImport.length} 个 Cue`);
            }
        },

        confirmAndImport: function(importResult, currentCueCount) {
            if (!importResult || !importResult.cues) {
                this.triggerError('没有可导入的数据');
                return false;
            }

            const cues = importResult.cues;
            
            if (currentCueCount > 0) {
                const confirmed = confirm(
                    `当前已有 ${currentCueCount} 个 Cue。\n` +
                    `导入将替换所有现有数据。\n` +
                    `确定要导入 ${cues.length} 个 Cue 吗？`
                );
                if (!confirmed) {
                    return false;
                }
            }

            return true;
        },

        selectFile: function(callback) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.style.display = 'none';
            
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file && callback) {
                    callback(file);
                }
                document.body.removeChild(input);
            };

            document.body.appendChild(input);
            input.click();
        },

        createFileInput: function(containerId, onFileSelect) {
            const container = document.getElementById(containerId);
            if (!container) return null;

            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.id = 'import-file-input';
            input.style.display = 'none';

            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file && onFileSelect) {
                    onFileSelect(file);
                }
                input.value = '';
            };

            container.appendChild(input);
            return input;
        },

        triggerError: function(message) {
            console.error('Import/Export Error:', message);
            if (this.onImportError) {
                this.onImportError(message);
            } else {
                alert('错误: ' + message);
            }
        },

        triggerWarning: function(message) {
            console.warn('Import/Export Warning:', message);
            if (this.onImportWarning) {
                this.onImportWarning(message);
            }
        },

        triggerSuccess: function(message) {
            console.log('Import/Export Success:', message);
            if (this.onImportSuccess) {
                this.onImportSuccess(message);
            }
        },

        createExampleData: function() {
            const now = Date.now();
            return {
                version: '1.0.0',
                exportedAt: now,
                exportedAtFormatted: new Date(now).toISOString(),
                cues: [
                    {
                        id: 'example_1',
                        number: 'Q1',
                        startTime: 0,
                        duration: 15,
                        description: '开场灯光渐亮，舞台中央聚光灯打开',
                        group: '灯光',
                        dependsOn: null,
                        riskLevel: 'low',
                        notes: '注意与音乐配合',
                        order: 0
                    },
                    {
                        id: 'example_2',
                        number: 'Q2',
                        startTime: 15,
                        duration: 20,
                        description: '主幕布升起，背景画面切换',
                        group: '舞台',
                        dependsOn: 'example_1',
                        riskLevel: 'medium',
                        notes: '检查幕布机械是否正常',
                        order: 1
                    },
                    {
                        id: 'example_3',
                        number: 'Q3',
                        startTime: 35,
                        duration: 10,
                        description: '背景音乐响起，音量渐增',
                        group: '音响',
                        dependsOn: null,
                        riskLevel: 'low',
                        notes: '与灯光同步',
                        order: 2
                    }
                ]
            };
        },

        validateImportDataDetailed: function(data) {
            const results = {
                valid: true,
                errors: [],
                warnings: [],
                info: []
            };

            if (!data) {
                results.valid = false;
                results.errors.push('数据为空');
                return results;
            }

            if (typeof data !== 'object') {
                results.valid = false;
                results.errors.push('数据不是有效的 JSON 对象');
                return results;
            }

            if (!data.version) {
                results.warnings.push('缺少版本号字段，可能不是本工具导出的数据');
            } else if (data.version !== '1.0.0') {
                results.warnings.push(`版本号 ${data.version} 与当前工具版本 1.0.0 不匹配`);
            }

            if (!data.cues) {
                results.valid = false;
                results.errors.push('缺少 cues 字段');
                return results;
            }

            if (!Array.isArray(data.cues)) {
                results.valid = false;
                results.errors.push('cues 字段不是数组');
                return results;
            }

            if (data.cues.length === 0) {
                results.warnings.push('cues 数组为空');
            }

            const cueIds = new Set();
            data.cues.forEach((cue, index) => {
                const prefix = `Cue[${index}]:`;

                if (!cue.id) {
                    results.errors.push(`${prefix} 缺少 id 字段`);
                    results.valid = false;
                } else {
                    if (cueIds.has(cue.id)) {
                        results.errors.push(`${prefix} id '${cue.id}' 重复`);
                        results.valid = false;
                    }
                    cueIds.add(cue.id);
                }

                if (cue.duration !== undefined && cue.duration !== null) {
                    if (typeof cue.duration !== 'number' || cue.duration < 0) {
                        results.errors.push(`${prefix} duration 必须是非负数字`);
                        results.valid = false;
                    }
                }

                if (cue.dependsOn && !cueIds.has(cue.dependsOn)) {
                    results.warnings.push(`${prefix} 依赖的 Cue '${cue.dependsOn}' 不存在`);
                }

                if (cue.group && !['灯光', '音响', '道具', '服装', '舞台', '其他'].includes(cue.group)) {
                    results.warnings.push(`${prefix} group '${cue.group}' 不是预定义值`);
                }

                if (cue.riskLevel && !['low', 'medium', 'high'].includes(cue.riskLevel)) {
                    results.warnings.push(`${prefix} riskLevel '${cue.riskLevel}' 不是预定义值`);
                }
            });

            results.info.push(`共 ${data.cues.length} 个 Cue`);

            return results;
        }
    };

    global.ImportExport = ImportExport;

})(window);
