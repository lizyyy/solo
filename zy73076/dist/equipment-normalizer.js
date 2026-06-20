"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EquipmentNormalizer = void 0;
// ============================================================
// 设备编号规范化引擎
// 负责把巡检表中五花八门的写法统一到规范编号体系
// ============================================================
class EquipmentNormalizer {
    mappings = [];
    aliasIndex = new Map(); // alias(小写) -> canonicalId
    canonicalIndex = new Map(); // canonicalId -> 完整映射
    constructor(initialMappings = []) {
        this.loadMappings(initialMappings);
    }
    loadMappings(mappings) {
        this.mappings = mappings;
        this.aliasIndex.clear();
        this.canonicalIndex.clear();
        for (const m of mappings) {
            this.canonicalIndex.set(m.canonicalId, m);
            const key = this.normalizeForLookup(m.canonicalId);
            if (!this.aliasIndex.has(key)) {
                this.aliasIndex.set(key, m.canonicalId);
            }
            for (const alias of m.aliases) {
                const aKey = this.normalizeForLookup(alias);
                if (this.aliasIndex.has(aKey) && this.aliasIndex.get(aKey) !== m.canonicalId) {
                    // 冲突：同一别名映射到多个规范编号 → 后续规范化时会标记为 ambiguous
                }
                else {
                    this.aliasIndex.set(aKey, m.canonicalId);
                }
            }
        }
    }
    addMapping(mapping) {
        this.loadMappings([...this.mappings, mapping]);
    }
    getAllMappings() {
        return [...this.mappings];
    }
    // ---------- projectId 相关查询 ----------
    getProjectOfCanonical(canonicalId) {
        return this.canonicalIndex.get(canonicalId)?.projectId ?? null;
    }
    // 判断某原始写法属于哪个/哪些项目（ambiguous 时可能多个）
    getProjectsOfRaw(rawId) {
        const norm = this.normalize(rawId);
        if (norm.canonical) {
            const p = this.getProjectOfCanonical(norm.canonical);
            return p ? [p] : [];
        }
        // ambiguous：每个候选都查
        const projects = new Set();
        for (const c of norm.candidates) {
            const p = this.getProjectOfCanonical(c);
            if (p)
                projects.add(p);
        }
        return Array.from(projects);
    }
    // 某设备是否属于指定项目
    // - 有明确 canonical 且项目匹配 → true
    // - ambiguous 且任意候选匹配 → true（保守：宁可多放，后面再由人确认）
    // - unknown → false
    isRawBelongsToProject(rawId, projectId) {
        const projects = this.getProjectsOfRaw(rawId);
        return projects.includes(projectId);
    }
    // 列出所有项目
    listAllProjects() {
        return Array.from(new Set(this.mappings.map(m => m.projectId)));
    }
    // 核心：把原始写法规范化
    normalize(rawId) {
        const trimmed = rawId.trim();
        if (!trimmed) {
            return {
                raw: rawId,
                canonical: null,
                status: 'unknown',
                candidates: [],
                confidence: 0,
            };
        }
        // -------- 精确匹配：canonical 本身（保留分隔符，只做大小写/全半角归一）--------
        const softKey = this.softNormalize(trimmed); // 保留分隔符的轻度归一
        const directCanonical = this.mappings.find(m => this.softNormalize(m.canonicalId) === softKey);
        if (directCanonical) {
            return {
                raw: trimmed,
                canonical: directCanonical.canonicalId,
                status: 'canonical',
                candidates: [directCanonical.canonicalId],
                confidence: 1.0,
            };
        }
        // -------- 精确匹配：别名（去掉分隔符/特殊字符的强归一）--------
        const lookupKey = this.normalizeForLookup(trimmed);
        const exactCanonical = this.aliasIndex.get(lookupKey);
        if (exactCanonical) {
            return {
                raw: trimmed,
                canonical: exactCanonical,
                status: 'normalized',
                candidates: [exactCanonical],
                confidence: 1.0,
            };
        }
        // -------- 模糊匹配：提高阈值 + 前缀体系惩罚 --------
        const scored = this.mappings.map(m => {
            const baseScore = Math.max(this.similarity(lookupKey, this.normalizeForLookup(m.canonicalId)), ...m.aliases.map(a => this.similarity(lookupKey, this.normalizeForLookup(a))));
            // 前缀体系不一致惩罚（如 "盾构-X..." 对比 "SD-..." 前缀完全不同 → 降分 0.25）
            const prefixPenalty = this.prefixMismatchPenalty(trimmed, [m.canonicalId, ...m.aliases]);
            return {
                canonical: m.canonicalId,
                score: Math.max(0, baseScore - prefixPenalty),
            };
        });
        const top = scored
            .filter(s => s.score > 0.75)
            .sort((a, b) => b.score - a.score);
        if (top.length === 0) {
            return {
                raw: trimmed,
                canonical: null,
                status: 'unknown',
                candidates: [],
                confidence: 0,
            };
        }
        // 若前两名得分非常接近（< 0.1 差距）→ 判定为歧义
        if (top.length >= 2 && top[0].score - top[1].score < 0.1) {
            return {
                raw: trimmed,
                canonical: null,
                status: 'ambiguous',
                candidates: top.slice(0, 3).map(t => t.canonical),
                confidence: top[0].score,
            };
        }
        return {
            raw: trimmed,
            canonical: top[0].canonical,
            status: 'normalized',
            candidates: top.slice(0, 3).map(t => t.canonical),
            confidence: top[0].score,
        };
    }
    // 批量规范化 + 检测"设备编号重复"
    // 即：同一物理设备被多种写法填写，但通过规范化能归集到同一 canonical
    // 返回值中 duplicateGroups 为需要项目经理确认的组
    bulkNormalize(rawIds) {
        const results = new Map();
        const byCanonical = new Map(); // canonical -> set of raw variants
        for (const raw of rawIds) {
            const norm = this.normalize(raw);
            results.set(raw, norm);
            if (norm.canonical) {
                if (!byCanonical.has(norm.canonical)) {
                    byCanonical.set(norm.canonical, new Set());
                }
                byCanonical.get(norm.canonical).add(norm.raw);
            }
        }
        // 判定重复：同一 canonical 下出现 2+ 种原始写法 → 标记组
        const duplicateGroups = Array.from(byCanonical.entries())
            .filter(([, raws]) => raws.size > 1)
            .map(([canonicalId, raws]) => ({
            canonicalId,
            rawVariants: Array.from(raws),
            pendingConfirmation: true, // 一律挂起让项目经理确认（宁可挂起也不给假稳定）
        }));
        // 对属于 duplicateGroups 的所有 raw，在结果里升级为 duplicate 状态
        for (const group of duplicateGroups) {
            for (const variant of group.rawVariants) {
                const r = results.get(variant);
                if (r.canonical === group.canonicalId) {
                    results.set(variant, {
                        ...r,
                        status: 'duplicate',
                    });
                }
            }
        }
        return { results, duplicateGroups };
    }
    // ---------- 工具方法 ----------
    // 轻度归一（保留分隔符，用于判断是否与 canonicalId 本身相等）
    softNormalize(s) {
        return s
            .trim()
            .toLowerCase()
            .replace(/[o０]/g, '0')
            .replace(/[i|l１]/g, '1')
            .replace(/[z２]/g, '2')
            .replace(/[－—]/g, '-')
            .replace(/[＿]/g, '_');
    }
    // 强归一（去掉所有分隔符/特殊字符，用于别名精确匹配和相似度）
    normalizeForLookup(s) {
        return s
            .toLowerCase()
            .replace(/[\s\-_－—＿·.。（）()【】\[\]'"`]/g, '')
            .replace(/[o０]/g, '0')
            .replace(/[i|l１]/g, '1')
            .replace(/[z２]/g, '2');
    }
    // 前缀体系不匹配惩罚：提取编号的"前缀部分"对比，体系完全不一致 → 降分
    prefixMismatchPenalty(raw, candidates) {
        const rawPrefix = this.extractPrefix(raw);
        if (!rawPrefix)
            return 0;
        const candPrefixes = candidates
            .map(c => this.extractPrefix(c))
            .filter(Boolean);
        if (candPrefixes.length === 0)
            return 0;
        const match = candPrefixes.some(p => p === rawPrefix);
        return match ? 0 : 0.3;
    }
    // 提取前缀：字母前缀（如 "SD"）或中文前缀（如 "盾构"）
    extractPrefix(s) {
        const letter = s.match(/^[a-zA-Z]+/);
        if (letter)
            return letter[0].toLowerCase();
        const chinese = s.match(/^[\u4e00-\u9fa5]+/);
        if (chinese)
            return chinese[0];
        return null;
    }
    // Jaro-Winkler 相似度实现
    similarity(s1, s2) {
        if (s1 === s2)
            return 1.0;
        if (s1.length === 0 || s2.length === 0)
            return 0.0;
        const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
        const s1Matches = new Array(s1.length).fill(false);
        const s2Matches = new Array(s2.length).fill(false);
        let matches = 0;
        for (let i = 0; i < s1.length; i++) {
            const start = Math.max(0, i - matchWindow);
            const end = Math.min(s2.length - 1, i + matchWindow);
            for (let j = start; j <= end; j++) {
                if (!s2Matches[j] && s1[i] === s2[j]) {
                    s1Matches[i] = true;
                    s2Matches[j] = true;
                    matches++;
                    break;
                }
            }
        }
        if (matches === 0)
            return 0.0;
        let transpositions = 0;
        let k = 0;
        for (let i = 0; i < s1.length; i++) {
            if (s1Matches[i]) {
                while (!s2Matches[k])
                    k++;
                if (s1[i] !== s2[k])
                    transpositions++;
                k++;
            }
        }
        transpositions = Math.floor(transpositions / 2);
        const jaro = (matches / s1.length +
            matches / s2.length +
            (matches - transpositions) / matches) /
            3;
        let prefix = 0;
        const minLen = Math.min(s1.length, s2.length, 4);
        for (let i = 0; i < minLen; i++) {
            if (s1[i] === s2[i])
                prefix++;
            else
                break;
        }
        return jaro + prefix * 0.1 * (1 - jaro);
    }
}
exports.EquipmentNormalizer = EquipmentNormalizer;
//# sourceMappingURL=equipment-normalizer.js.map