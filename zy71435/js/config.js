const GAME_CONFIG = {
    G: 6.674e-11,
    EARTH_MASS: 5.972e24,
    SUN_MASS: 1.989e30,
    TON_TO_KG: 1000,
    M_TO_KM: 0.001,
    KM_TO_M: 1000,
    
    UNITS: {
        mass: {
            'kg': { factor: 1, name: '千克' },
            '千克': { factor: 1, name: '千克' },
            't': { factor: 1000, name: '吨' },
            'ton': { factor: 1000, name: '吨' },
            '吨': { factor: 1000, name: '吨' },
            'm⊕': { factor: 5.972e24, name: '地球质量' },
            'M⊕': { factor: 5.972e24, name: '地球质量' },
            '地球质量': { factor: 5.972e24, name: '地球质量' },
            'm☉': { factor: 1.989e30, name: '太阳质量' },
            'M☉': { factor: 1.989e30, name: '太阳质量' },
            '太阳质量': { factor: 1.989e30, name: '太阳质量' },
            'ms': { factor: 1.989e30, name: '太阳质量' }
        },
        radius: {
            'm': { factor: 1, name: '米' },
            '米': { factor: 1, name: '米' },
            'km': { factor: 1000, name: '千米' },
            '千米': { factor: 1000, name: '千米' },
            'km/s': { factor: 1000, name: '千米/秒' },
            'm/s': { factor: 1, name: '米/秒' }
        },
        velocity: {
            'm/s': { factor: 1, name: '米/秒' },
            'km/s': { factor: 1000, name: '千米/秒' },
            '千米/秒': { factor: 1000, name: '千米/秒' }
        }
    },
    
    BODY_TYPES: {
        'black-hole': { name: '黑洞', icon: '🕳️' },
        'planet': { name: '行星', icon: '🌍' },
        'star': { name: '恒星', icon: '⭐' },
        'moon': { name: '卫星', icon: '🌙' },
        'asteroid': { name: '小行星', icon: '☄️' }
    },
    
    FUEL_TYPES: {
        'chemical': { name: '化学燃料', color: '#f59e0b' },
        'nuclear': { name: '核燃料', color: '#8b5cf6' },
        'ion': { name: '离子推进', color: '#3b82f6' },
        'solar': { name: '太阳帆', color: '#10b981' },
        'antimatter': { name: '反物质', color: '#ef4444' }
    },
    
    DIRECTIONS: {
        'away': { name: '远离天体', modifier: 1.0 },
        'towards': { name: '朝向天体', modifier: -1.0 }
    },
    
    SCORE: {
        baseEscape: 100,
        massMultiplier: 0.001,
        fuelEfficiencyBonus: 50,
        perfectEscapeBonus: 200
    },
    
    STORAGE_KEYS: {
        gameData: 'black_hole_escape_data',
        history: 'black_hole_escape_history'
    }
};

function generateBatchId() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `BATCH-${dateStr}-${random}`;
}

function formatTimestamp(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function formatDisplayTime(date = new Date()) {
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function formatNumber(num, decimals = 2) {
    if (Math.abs(num) >= 1e9) {
        return (num / 1e9).toFixed(decimals) + '×10⁹';
    } else if (Math.abs(num) >= 1e6) {
        return (num / 1e6).toFixed(decimals) + '×10⁶';
    } else if (Math.abs(num) >= 1e3) {
        return (num / 1e3).toFixed(decimals) + '×10³';
    }
    return num.toFixed(decimals);
}

function formatScientific(num, decimals = 2) {
    if (num === 0) return '0';
    const exp = Math.floor(Math.log10(Math.abs(num)));
    const mantissa = num / Math.pow(10, exp);
    return `${mantissa.toFixed(decimals)} × 10^${exp}`;
}
