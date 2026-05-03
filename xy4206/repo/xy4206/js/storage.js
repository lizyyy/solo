class Storage {
    constructor() {
        this.storageKey = 'piano_practice_archives';
        this.maxArchives = 20;
    }

    saveArchive(archiveData) {
        const archives = this.getArchives();
        
        const archive = {
            id: this.generateId(),
            createdAt: new Date().toISOString(),
            title: archiveData.title || '未命名练习',
            composer: archiveData.composer || '未知',
            scoreData: archiveData.scoreData,
            performanceData: archiveData.performanceData,
            alignment: archiveData.alignment,
            analysis: archiveData.analysis,
            totalScore: archiveData.analysis?.totalScore || 0,
            summary: {
                totalNotes: archiveData.analysis?.summary?.totalNotes || 0,
                missedNotes: archiveData.analysis?.summary?.missedNotes || 0,
                wrongNotes: archiveData.analysis?.summary?.wrongNotes || 0,
                timingIssues: archiveData.analysis?.summary?.timingIssues || 0,
                slurBreaks: archiveData.analysis?.summary?.slurBreaks || 0
            }
        };

        archives.unshift(archive);

        if (archives.length > this.maxArchives) {
            archives.splice(this.maxArchives);
        }

        try {
            localStorage.setItem(this.storageKey, JSON.stringify(archives));
            return { success: true, archive };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    getArchives() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('读取存档失败:', error);
            return [];
        }
    }

    getArchive(id) {
        const archives = this.getArchives();
        return archives.find(a => a.id === id) || null;
    }

    deleteArchive(id) {
        const archives = this.getArchives();
        const filtered = archives.filter(a => a.id !== id);
        
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(filtered));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    clearAll() {
        try {
            localStorage.removeItem(this.storageKey);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getStorageSize() {
        let totalSize = 0;
        try {
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    const value = localStorage.getItem(key);
                    if (value) {
                        totalSize += value.length * 2;
                    }
                }
            }
        } catch (e) {}
        
        return {
            bytes: totalSize,
            kilobytes: (totalSize / 1024).toFixed(2),
            megabytes: (totalSize / 1024 / 1024).toFixed(2)
        };
    }

    exportArchive(id) {
        const archive = this.getArchive(id);
        if (!archive) return null;

        return {
            id: archive.id,
            createdAt: archive.createdAt,
            title: archive.title,
            composer: archive.composer,
            totalScore: archive.totalScore,
            summary: archive.summary,
            scoreData: archive.scoreData,
            performanceData: archive.performanceData,
            alignment: archive.alignment,
            analysis: archive.analysis
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}
