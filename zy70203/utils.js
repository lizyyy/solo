window.Utils = {
    showToast: function(message, type) {
        if (type === undefined) type = 'info';
        var container = document.getElementById('toast-container');
        var toast = document.createElement('div');
        toast.className = 'toast ' + type;
        
        var icons = {
            success: '✓',
            error: '✕',
            warning: '!',
            info: 'ℹ'
        };
        
        toast.innerHTML = '<span class="toast-icon">' + icons[type] + '</span><span class="toast-message">' + message + '</span>';
        
        container.appendChild(toast);
        
        setTimeout(function() {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            setTimeout(function() { toast.remove(); }, 300);
        }, 3000);
    },

    openModal: function(content, options) {
        if (options === undefined) options = {};
        var container = document.getElementById('modal-container');
        var modal = document.createElement('div');
        modal.className = 'modal' + (options.large ? ' large' : '');
        
        var footerHtml = options.footer ? '<div class="modal-footer">' + options.footer + '</div>' : '';
        
        modal.innerHTML = '<div class="modal-header"><h3 class="modal-title">' + (options.title || '') + '</h3><button class="modal-close" onclick="Utils.closeModal()">&times;</button></div><div class="modal-body">' + content + '</div>' + footerHtml;
        
        container.innerHTML = '';
        container.appendChild(modal);
        container.classList.remove('hidden');
        
        container.onclick = function(e) {
            if (e.target === container) {
                Utils.closeModal();
            }
        };
        
        document.addEventListener('keydown', this._handleEscape);
    },

    _handleEscape: function(e) {
        if (e.key === 'Escape') {
            Utils.closeModal();
        }
    },

    closeModal: function() {
        var container = document.getElementById('modal-container');
        container.classList.add('hidden');
        container.innerHTML = '';
        document.removeEventListener('keydown', this._handleEscape);
    },

    getFormData: function(form) {
        var formData = new FormData(form);
        var data = {};
        var entries = formData.entries();
        var next;
        while (!(next = entries.next()).done) {
            data[next.value[0]] = next.value[1];
        }
        return data;
    },

    validateForm: function(form) {
        var isValid = true;
        var requiredFields = form.querySelectorAll('[required]');
        
        for (var i = 0; i < requiredFields.length; i++) {
            var field = requiredFields[i];
            if (!field.value.trim()) {
                isValid = false;
                field.classList.add('error');
                this.showError(field, '此字段为必填项');
            } else {
                field.classList.remove('error');
                this.clearError(field);
            }
        }
        
        return isValid;
    },

    showError: function(field, message) {
        var parent = field.closest('.form-group');
        if (parent) {
            var errorEl = parent.querySelector('.form-error');
            if (!errorEl) {
                errorEl = document.createElement('div');
                errorEl.className = 'form-error';
                parent.appendChild(errorEl);
            }
            errorEl.textContent = message;
        }
    },

    clearError: function(field) {
        var parent = field.closest('.form-group');
        if (parent) {
            var errorEl = parent.querySelector('.form-error');
            if (errorEl) {
                errorEl.remove();
            }
        }
    },

    escapeHtml: function(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    formatFileSize: function(bytes) {
        if (bytes === 0) return '0 Bytes';
        var k = 1024;
        var sizes = ['Bytes', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    parseCSV: function(file, callback) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var text = e.target.result;
            var result = window.Utils._parseCSVText(text);
            callback(result);
        };
        reader.readAsText(file);
    },

    _parseCSVText: function(text) {
        var lines = text.split(/\r?\n/).filter(function(line) { return line.trim(); });
        if (lines.length < 2) return [];
        
        var headers = this._parseCSVLine(lines[0]);
        var data = [];
        
        for (var i = 1; i < lines.length; i++) {
            var values = this._parseCSVLine(lines[i]);
            if (values.length === headers.length) {
                var row = {};
                for (var j = 0; j < headers.length; j++) {
                    row[headers[j].trim()] = values[j] || '';
                }
                data.push(row);
            }
        }
        
        return data;
    },

    _parseCSVLine: function(line) {
        var result = [];
        var current = '';
        var inQuotes = false;
        
        for (var i = 0; i < line.length; i++) {
            var char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        
        return result;
    },

    getRiskBadgeClass: function(riskLevel) {
        var classes = {
            high: 'badge-danger',
            medium: 'badge-warning',
            low: 'badge-info',
            normal: 'badge-success'
        };
        return classes[riskLevel] || 'badge-secondary';
    },

    getStatusBadgeClass: function(status, type) {
        if (type === undefined) type = 'screening';
        
        if (type === 'screening') {
            var sClasses = {
                pending_review: 'badge-warning',
                reviewed: 'badge-info',
                need_retest: 'badge-purple',
                resolved: 'badge-success'
            };
            return sClasses[status] || 'badge-secondary';
        } else if (type === 'retest') {
            var rClasses = {
                pending: 'badge-warning',
                completed: 'badge-info',
                normal: 'badge-success',
                still_abnormal: 'badge-danger'
            };
            return rClasses[status] || 'badge-secondary';
        } else if (type === 'followup') {
            var fClasses = {
                assigned: 'badge-info',
                in_progress: 'badge-warning',
                completed: 'badge-success',
                escalated: 'badge-danger'
            };
            return fClasses[status] || 'badge-secondary';
        }
        return 'badge-secondary';
    },

    getTodayString: function() {
        var today = new Date();
        return today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    },

    getTimeString: function() {
        var now = new Date();
        return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    },

    addDays: function(dateString, days) {
        var date = new Date(dateString);
        date.setDate(date.getDate() + days);
        return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    },

    debounce: function(func, wait) {
        var timeout;
        return function() {
            var args = arguments;
            var later = function() {
                clearTimeout(timeout);
                func.apply(null, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    showConfirm: function(message, callback) {
        var content = '<div style="text-align: center; padding: 1rem;"><div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div><p style="font-size: 1.1rem; color: #333; margin-bottom: 0;">' + message + '</p></div>';
        var footer = '<button class="btn btn-secondary" onclick="window._handleConfirm(false)">取消</button><button class="btn btn-primary" onclick="window._handleConfirm(true)">确认</button>';

        this.openModal(content, { title: '确认操作', footer: footer });

        window._handleConfirm = function(confirmed) {
            Utils.closeModal();
            delete window._handleConfirm;
            if (callback) {
                callback(confirmed);
            }
        };
    }
};
