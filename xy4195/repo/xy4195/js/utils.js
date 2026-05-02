// 通用工具函数
const Utils = {
    // 角度转弧度
    degToRad: function(degrees) {
        return degrees * Math.PI / 180;
    },
    
    // 弧度转角度
    radToDeg: function(radians) {
        return radians * 180 / Math.PI;
    },
    
    // 计算两点之间的距离
    distance: function(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    },
    
    // 计算两点之间的角度（弧度）
    angle: function(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    },
    
    // 限制数值范围
    clamp: function(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },
    
    // 线性插值
    lerp: function(a, b, t) {
        return a + (b - a) * t;
    },
    
    // 生成唯一ID
    generateId: function() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    // 深拷贝对象
    deepClone: function(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.deepClone(item));
        }
        
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }
        return cloned;
    },
    
    // 格式化日期
    formatDate: function(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    },
    
    // 计算两条线段的交点
    lineIntersection: function(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denominator) < 0.0001) {
            return null; // 线段平行或共线
        }
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;
        
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            const x = x1 + t * (x2 - x1);
            const y = y1 + t * (y2 - y1);
            return { x, y };
        }
        
        return null;
    },
    
    // 检查点是否在矩形内
    pointInRect: function(px, py, x, y, width, height) {
        return px >= x && px <= x + width && py >= y && py <= y + height;
    },
    
    // 检查点是否在多边形内（射线法）
    pointInPolygon: function(px, py, polygon) {
        let inside = false;
        const n = polygon.length;
        
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            
            if (((yi > py) !== (yj > py)) &&
                (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        
        return inside;
    },
    
    // 计算点到线段的最短距离
    pointToLineDistance: function(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        return {
            distance: this.distance(px, py, xx, yy),
            closestPoint: { x: xx, y: yy }
        };
    },
    
    // 字符串处理：转义CSV特殊字符
    escapeCsv: function(str) {
        if (typeof str !== 'string') {
            str = String(str);
        }
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    },
    
    // 下载文件
    downloadFile: function(content, filename, type) {
        const blob = new Blob([content], { type: type || 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    // 显示通知消息
    showNotification: function(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type || 'info'}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
};

// 添加通知样式
const style = document.createElement('style');
style.textContent = `
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 4px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
}

.notification.show {
    opacity: 1;
    transform: translateX(0);
}

.notification-info {
    background-color: #3498db;
}

.notification-success {
    background-color: #27ae60;
}

.notification-warning {
    background-color: #f39c12;
}

.notification-error {
    background-color: #e74c3c;
}
`;
document.head.appendChild(style);
