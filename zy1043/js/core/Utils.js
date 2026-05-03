/**
 * 工具函数集合
 */

const Utils = {
    /**
     * 生成唯一ID
     */
    generateId(prefix = 'obj') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },
    
    /**
     * 角度转弧度
     */
    degToRad(degrees) {
        return degrees * Math.PI / 180;
    },
    
    /**
     * 弧度转角度
     */
    radToDeg(radians) {
        return radians * 180 / Math.PI;
    },
    
    /**
     * 归一化角度到 [0, 360)
     */
    normalizeAngle(angle) {
        angle = angle % 360;
        if (angle < 0) angle += 360;
        return angle;
    },
    
    /**
     * 计算两点之间的距离
     */
    distance(x1, z1, x2, z2) {
        const dx = x2 - x1;
        const dz = z2 - z1;
        return Math.sqrt(dx * dx + dz * dz);
    },
    
    /**
     * 计算曼哈顿距离
     */
    manhattanDistance(x1, z1, x2, z2) {
        return Math.abs(x2 - x1) + Math.abs(z2 - z1);
    },
    
    /**
     * 颜色转换: HEX 字符串转数字
     */
    hexToNumber(hex) {
        return parseInt(hex.replace('#', ''), 16);
    },
    
    hexToColor(hex) {
        return this.hexToNumber(hex);
    },
    
    /**
     * 颜色转换: 数字转 HEX 字符串
     */
    numberToHex(num) {
        return '#' + num.toString(16).padStart(6, '0');
    },
    
    colorToHex(color) {
        return this.numberToHex(color);
    },
    
    /**
     * 深拷贝对象
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (Array.isArray(obj)) return obj.map(item => Utils.deepClone(item));
        
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = Utils.deepClone(obj[key]);
            }
        }
        return cloned;
    },
    
    /**
     * 延迟执行
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    /**
     * 节流函数
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    /**
     * 防抖函数
     */
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },
    
    /**
     * 解析 CSV 字符串
     */
    parseCSV(csv) {
        const lines = csv.trim().split('\n');
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const result = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;
            
            const obj = {};
            headers.forEach((header, idx) => {
                obj[header] = values[idx] || '';
            });
            result.push(obj);
        }
        
        return result;
    },
    
    /**
     * 转换为 CSV 字符串
     */
    toCSV(data) {
        if (!data || data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const lines = [headers.join(',')];
        
        data.forEach(row => {
            const values = headers.map(h => {
                const value = row[h];
                if (typeof value === 'string' && (value.includes(',') || value.includes('\n'))) {
                    return `"${value}"`;
                }
                return value;
            });
            lines.push(values.join(','));
        });
        
        return lines.join('\n');
    },
    
    /**
     * 格式化距离显示
     */
    formatDistance(meters) {
        if (meters < 1000) {
            return `${meters.toFixed(2)} m`;
        }
        return `${(meters / 1000).toFixed(2)} km`;
    },
    
    /**
     * 计算矩形的边界框 (考虑旋转)
     */
    getBoundingBox(x, z, length, width, rotationDeg) {
        const rad = this.degToRad(rotationDeg);
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        
        const boundingLength = length * cos + width * sin;
        const boundingWidth = length * sin + width * cos;
        
        return {
            minX: x - boundingLength / 2,
            maxX: x + boundingLength / 2,
            minZ: z - boundingWidth / 2,
            maxZ: z + boundingWidth / 2,
            centerX: x,
            centerZ: z
        };
    },
    
    /**
     * 检查两个旋转矩形是否重叠 (简化版)
     * 使用分离轴定理
     */
    checkRotatedRectOverlap(rect1, rect2) {
        const rect1Corners = this.getRectCorners(
            rect1.x, rect1.z,
            rect1.length, rect1.width,
            rect1.rotation
        );
        const rect2Corners = this.getRectCorners(
            rect2.x, rect2.z,
            rect2.length, rect2.width,
            rect2.rotation
        );
        
        const axes = [
            this.getEdgeNormal(rect1Corners[0], rect1Corners[1]),
            this.getEdgeNormal(rect1Corners[1], rect1Corners[2]),
            this.getEdgeNormal(rect2Corners[0], rect2Corners[1]),
            this.getEdgeNormal(rect2Corners[1], rect2Corners[2])
        ];
        
        for (const axis of axes) {
            const proj1 = this.projectRect(rect1Corners, axis);
            const proj2 = this.projectRect(rect2Corners, axis);
            
            if (!this.overlap1D(proj1, proj2)) {
                return false;
            }
        }
        
        return true;
    },
    
    /**
     * 获取矩形的四个角点
     */
    getRectCorners(x, z, length, width, rotationDeg) {
        const rad = this.degToRad(rotationDeg);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        const halfLength = length / 2;
        const halfWidth = width / 2;
        
        const corners = [
            { x: -halfLength, z: -halfWidth },
            { x:  halfLength, z: -halfWidth },
            { x:  halfLength, z:  halfWidth },
            { x: -halfLength, z:  halfWidth }
        ];
        
        return corners.map(corner => ({
            x: x + corner.x * cos - corner.z * sin,
            z: z + corner.x * sin + corner.z * cos
        }));
    },
    
    /**
     * 获取边的法向量
     */
    getEdgeNormal(p1, p2) {
        const dx = p2.x - p1.x;
        const dz = p2.z - p1.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        return { x: -dz / len, z: dx / len };
    },
    
    /**
     * 将矩形投影到轴上
     */
    projectRect(corners, axis) {
        let min = Infinity;
        let max = -Infinity;
        
        for (const corner of corners) {
            const proj = corner.x * axis.x + corner.z * axis.z;
            min = Math.min(min, proj);
            max = Math.max(max, proj);
        }
        
        return { min, max };
    },
    
    /**
     * 检查两个1D区间是否重叠
     */
    overlap1D(interval1, interval2) {
        return !(interval1.max < interval2.min || interval2.max < interval1.min);
    },
    
    /**
     * 计算点到线段的距离
     */
    pointToLineDistance(px, pz, x1, z1, x2, z2) {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const lenSq = dx * dx + dz * dz;
        
        if (lenSq === 0) {
            return this.distance(px, pz, x1, z1);
        }
        
        let t = ((px - x1) * dx + (pz - z1) * dz) / lenSq;
        t = Math.max(0, Math.min(1, t));
        
        const projX = x1 + t * dx;
        const projZ = z1 + t * dz;
        
        return this.distance(px, pz, projX, projZ);
    },
    
    /**
     * 线性插值
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    }
};
