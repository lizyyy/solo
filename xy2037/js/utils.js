const Utils = {
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) {
            return '刚刚';
        } else if (diff < 3600000) {
            return `${Math.floor(diff / 60000)}分钟前`;
        } else if (diff < 86400000) {
            return `${Math.floor(diff / 3600000)}小时前`;
        } else if (diff < 604800000) {
            return `${Math.floor(diff / 86400000)}天前`;
        } else {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        }
    },

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    },

    formatDateForInput(timestamp) {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    },

    getCategoryName(category) {
        const categories = {
            electronics: '电子产品',
            wallet: '钱包/证件',
            bag: '箱包',
            clothing: '衣物',
            jewelry: '首饰',
            keys: '钥匙',
            documents: '文件资料',
            other: '其他'
        };
        return categories[category] || '其他';
    },

    getStatusName(status) {
        const statuses = {
            pending: '待匹配',
            matched: '已匹配',
            claimed: '认领中',
            completed: '已完成'
        };
        return statuses[status] || '未知';
    },

    getStatusClass(status) {
        const classes = {
            pending: 'status-pending',
            matched: 'status-matched',
            claimed: 'status-claimed',
            completed: 'status-completed'
        };
        return classes[status] || 'status-pending';
    },

    getPostTypeName(type) {
        const types = {
            lost_story: '失物故事',
            found_story: '拾物故事',
            thanks: '感谢拾主',
            tip: '防丢提示'
        };
        return types[type] || '其他';
    },

    getPostTypeIcon(type) {
        const icons = {
            lost_story: '😢',
            found_story: '😊',
            thanks: '🙏',
            tip: '💡'
        };
        return icons[type] || '📝';
    },

    truncate(str, maxLength) {
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength) + '...';
    },

    showToast(message, type = 'info') {
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    },

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    toRad(value) {
        return value * Math.PI / 180;
    },

    extractKeywords(text) {
        if (!text) return [];
        const stopWords = ['的', '了', '是', '在', '有', '和', '与', '或', '我', '你', '他', '她', '它', '们', '这', '那', '个', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '上', '下', '左', '右', '前', '后', '中', '里', '外', '内', '到', '从', '去', '来', '把', '被', '让', '给', '为', '以', '于', '对', '跟', '和', '及', '与', '或', '等', '等等', '啊', '吧', '呢', '吗', '呀', '哦', '嗯', '哈'];
        
        const keywords = [];
        const words = text.split(/[\s，。！？、；：""''（）【】\n\r\t,.;:\'\"()\[\]]+/);
        
        words.forEach(word => {
            if (word.length >= 2 && !stopWords.includes(word)) {
                if (!keywords.includes(word)) {
                    keywords.push(word);
                }
            }
        });

        return keywords;
    },

    calculateTextSimilarity(text1, text2) {
        const keywords1 = this.extractKeywords(text1);
        const keywords2 = this.extractKeywords(text2);
        
        if (keywords1.length === 0 && keywords2.length === 0) return 0;
        if (keywords1.length === 0 || keywords2.length === 0) return 0;

        let matches = 0;
        keywords1.forEach(kw1 => {
            keywords2.forEach(kw2 => {
                if (kw1 === kw2 || kw1.includes(kw2) || kw2.includes(kw1)) {
                    matches++;
                }
            });
        });

        const totalKeywords = new Set([...keywords1, ...keywords2]).size;
        return matches / Math.max(totalKeywords, 1);
    },

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    async processImageFiles(files) {
        const images = [];
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const base64 = await this.fileToBase64(file);
                images.push({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: base64
                });
            }
        }
        return images;
    },

    renderImagePreview(containerId, images, onRemove) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        images.forEach((img, index) => {
            const div = document.createElement('div');
            div.className = 'image-preview-item';
            div.innerHTML = `
                <img src="${img.data || img}" alt="预览">
                <button class="remove" onclick="(${onRemove})(${index})">×</button>
            `;
            container.appendChild(div);
        });
    },

    getMockLocation(location) {
        return DB.getLocationCoords(location);
    }
};

function showToast(message, type) {
    Utils.showToast(message, type);
}

function openModal(modalId) {
    Utils.openModal(modalId);
}

function closeModal(modalId) {
    Utils.closeModal(modalId);
}
