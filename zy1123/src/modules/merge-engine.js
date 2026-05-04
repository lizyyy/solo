const _ = require('lodash');
const { diffChars, diffLines } = require('diff');

const MERGE_STATUS = {
    CLEAN: 'clean',
    AUTO_MERGED: 'auto_merged',
    CONFLICT: 'conflict'
};

class MergeEngine {
    constructor() {
        this.mergeStrategies = {
            markdown: this._mergeMarkdown.bind(this),
            json: this._mergeJson.bind(this),
            default: this._mergeDefault.bind(this)
        };
    }

    detectFileType(filePath) {
        if (filePath.endsWith('.md') || filePath.endsWith('.markdown')) {
            return 'markdown';
        }
        if (filePath.endsWith('.json')) {
            return 'json';
        }
        return 'default';
    }

    threeWayMerge(base, theirs, ours, filePath) {
        const fileType = this.detectFileType(filePath);
        const strategy = this.mergeStrategies[fileType] || this.mergeStrategies.default;

        if (base === theirs) {
            return {
                status: MERGE_STATUS.CLEAN,
                result: ours,
                message: 'No changes in theirs, accepting ours'
            };
        }

        if (base === ours) {
            return {
                status: MERGE_STATUS.CLEAN,
                result: theirs,
                message: 'No changes in ours, accepting theirs'
            };
        }

        return strategy(base, theirs, ours, filePath);
    }

    _mergeDefault(base, theirs, ours, filePath) {
        if (theirs === ours) {
            return {
                status: MERGE_STATUS.CLEAN,
                result: theirs,
                message: 'Both sides made identical changes'
            };
        }

        const baseLines = base.split('\n');
        const theirsLines = theirs.split('\n');
        const oursLines = ours.split('\n');

        const conflicts = this._findLineConflicts(baseLines, theirsLines, oursLines);

        if (conflicts.length === 0) {
            const merged = this._trySimpleMerge(baseLines, theirsLines, oursLines);
            return {
                status: MERGE_STATUS.AUTO_MERGED,
                result: merged,
                message: 'Successfully merged line changes',
                changes: this._describeChanges(base, theirs, ours)
            };
        }

        const conflictDetails = conflicts.map(c => ({
            type: 'line_conflict',
            baseRange: c.baseRange,
            theirsRange: c.theirsRange,
            oursRange: c.oursRange,
            baseContent: c.baseContent,
            theirsContent: c.theirsContent,
            oursContent: c.oursContent
        }));

        return {
            status: MERGE_STATUS.CONFLICT,
            result: this._generateConflictMarker(base, theirs, ours),
            message: 'Cannot auto-merge: conflicts detected',
            conflicts: conflictDetails,
            requiresManualResolution: true
        };
    }

    _mergeMarkdown(base, theirs, ours, filePath) {
        const baseBlocks = this._parseMarkdownBlocks(base);
        const theirsBlocks = this._parseMarkdownBlocks(theirs);
        const oursBlocks = this._parseMarkdownBlocks(ours);

        const baseBlocksMap = this._blocksToMap(baseBlocks);
        const theirsBlocksMap = this._blocksToMap(theirsBlocks);
        const oursBlocksMap = this._blocksToMap(oursBlocks);

        const mergedBlocks = [];
        const conflicts = [];
        const allBlockIds = new Set([
            ...baseBlocksMap.keys(),
            ...theirsBlocksMap.keys(),
            ...oursBlocksMap.keys()
        ]);

        const orderedBlockIds = this._getBlockOrder(baseBlocks, theirsBlocks, oursBlocks);

        for (const blockId of orderedBlockIds) {
            const baseBlock = baseBlocksMap.get(blockId);
            const theirsBlock = theirsBlocksMap.get(blockId);
            const oursBlock = oursBlocksMap.get(blockId);

            if (!baseBlock) {
                if (theirsBlock && oursBlock) {
                    if (theirsBlock.content === oursBlock.content) {
                        mergedBlocks.push(theirsBlock);
                    } else {
                        conflicts.push({
                            type: 'new_block_conflict',
                            blockId,
                            blockTitle: theirsBlock.title || oursBlock.title || blockId,
                            theirs: theirsBlock,
                            ours: oursBlock
                        });
                        mergedBlocks.push({
                            type: 'conflict_placeholder',
                            blockId,
                            title: theirsBlock.title || oursBlock.title
                        });
                    }
                } else if (theirsBlock) {
                    mergedBlocks.push(theirsBlock);
                } else if (oursBlock) {
                    mergedBlocks.push(oursBlock);
                }
                continue;
            }

            if (!theirsBlock && !oursBlock) {
                continue;
            }

            if (!theirsBlock) {
                if (baseBlock.content === oursBlock.content) {
                    continue;
                }
                mergedBlocks.push(oursBlock);
                continue;
            }

            if (!oursBlock) {
                if (baseBlock.content === theirsBlock.content) {
                    continue;
                }
                mergedBlocks.push(theirsBlock);
                continue;
            }

            if (baseBlock.content === theirsBlock.content) {
                mergedBlocks.push(oursBlock);
                continue;
            }

            if (baseBlock.content === oursBlock.content) {
                mergedBlocks.push(theirsBlock);
                continue;
            }

            if (theirsBlock.content === oursBlock.content) {
                mergedBlocks.push(theirsBlock);
                continue;
            }

            const innerMerge = this._mergeDefault(
                baseBlock.content,
                theirsBlock.content,
                oursBlock.content,
                filePath
            );

            if (innerMerge.status === MERGE_STATUS.CONFLICT) {
                conflicts.push({
                    type: 'block_conflict',
                    blockId,
                    blockTitle: baseBlock.title || blockId,
                    base: baseBlock,
                    theirs: theirsBlock,
                    ours: oursBlock,
                    innerConflicts: innerMerge.conflicts
                });
                mergedBlocks.push({
                    type: 'conflict_placeholder',
                    blockId,
                    title: baseBlock.title,
                    baseContent: baseBlock.content,
                    theirsContent: theirsBlock.content,
                    oursContent: oursBlock.content
                });
            } else {
                mergedBlocks.push({
                    type: 'section',
                    title: baseBlock.title,
                    level: baseBlock.level,
                    content: innerMerge.result,
                    autoMerged: true
                });
            }
        }

        if (conflicts.length === 0) {
            return {
                status: MERGE_STATUS.AUTO_MERGED,
                result: this._blocksToMarkdown(mergedBlocks),
                message: 'Successfully merged by Markdown sections',
                blocksMerged: mergedBlocks.length
            };
        }

        return {
            status: MERGE_STATUS.CONFLICT,
            result: this._blocksToMarkdownWithConflicts(mergedBlocks),
            message: `Found ${conflicts.length} conflicting sections requiring manual resolution`,
            conflicts: conflicts,
            requiresManualResolution: true
        };
    }

    _parseMarkdownBlocks(content) {
        const blocks = [];
        const lines = content.split('\n');
        let currentBlock = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

            if (headerMatch) {
                if (currentBlock) {
                    currentBlock.content = currentBlock.lines.join('\n');
                    delete currentBlock.lines;
                    blocks.push(currentBlock);
                }

                const level = headerMatch[1].length;
                const title = headerMatch[2];
                currentBlock = {
                    type: 'section',
                    title,
                    level,
                    lines: [line],
                    id: this._generateBlockId(title, level, blocks.length)
                };
            } else if (currentBlock) {
                currentBlock.lines.push(line);
            } else {
                currentBlock = {
                    type: 'preamble',
                    lines: [line],
                    id: '__preamble__'
                };
            }
        }

        if (currentBlock) {
            currentBlock.content = currentBlock.lines.join('\n');
            delete currentBlock.lines;
            blocks.push(currentBlock);
        }

        return blocks;
    }

    _generateBlockId(title, level, index) {
        const normalizedTitle = title.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-');
        return `h${level}-${normalizedTitle}`;
    }

    _blocksToMap(blocks) {
        const map = new Map();
        blocks.forEach((block, index) => {
            let id = block.id;
            let counter = 1;
            while (map.has(id)) {
                id = `${block.id}_${counter}`;
                counter++;
            }
            map.set(id, block);
        });
        return map;
    }

    _getBlockOrder(baseBlocks, theirsBlocks, oursBlocks) {
        const baseMap = this._blocksToMap(baseBlocks);
        const theirsMap = this._blocksToMap(theirsBlocks);
        const oursMap = this._blocksToMap(oursBlocks);

        const order = [];
        const added = new Set();

        const addBlock = (block) => {
            const id = block.id;
            if (!added.has(id)) {
                order.push(id);
                added.add(id);
            }
        };

        baseBlocks.forEach(addBlock);
        theirsBlocks.forEach(addBlock);
        oursBlocks.forEach(addBlock);

        return order;
    }

    _blocksToMarkdown(blocks) {
        return blocks
            .filter(b => b.type !== 'conflict_placeholder')
            .map(b => b.content)
            .join('\n');
    }

    _blocksToMarkdownWithConflicts(blocks) {
        const parts = [];
        blocks.forEach(block => {
            if (block.type === 'conflict_placeholder') {
                parts.push(`\n<<<<<<< BASE (Original: ${block.title || block.blockId})\n${block.baseContent || ''}\n======= (THEIRS)\n${block.theirsContent || ''}\n======= (OURS)\n${block.oursContent || ''}\n>>>>>>> END_CONFLICT\n`);
            } else {
                parts.push(block.content);
            }
        });
        return parts.join('\n');
    }

    _mergeJson(base, theirs, ours, filePath) {
        try {
            const baseObj = JSON.parse(base);
            const theirsObj = JSON.parse(theirs);
            const oursObj = JSON.parse(ours);

            const { merged, conflicts } = this._mergeJsonObjects(baseObj, theirsObj, oursObj, '');

            if (conflicts.length === 0) {
                return {
                    status: MERGE_STATUS.AUTO_MERGED,
                    result: JSON.stringify(merged, null, 2),
                    message: 'Successfully merged JSON objects',
                    pathsChanged: this._collectChangedPaths(baseObj, theirsObj, oursObj)
                };
            }

            return {
                status: MERGE_STATUS.CONFLICT,
                result: JSON.stringify({
                    _merged: merged,
                    _conflicts: conflicts.map(c => ({
                        path: c.path,
                        base: c.base,
                        theirs: c.theirs,
                        ours: c.ours
                    }))
                }, null, 2),
                message: `Found ${conflicts.length} conflicting JSON paths requiring manual resolution`,
                conflicts: conflicts,
                requiresManualResolution: true
            };
        } catch (e) {
            return this._mergeDefault(base, theirs, ours, filePath);
        }
    }

    _mergeJsonObjects(base, theirs, ours, parentPath) {
        const merged = {};
        const conflicts = [];

        const allKeys = new Set([
            ...Object.keys(base || {}),
            ...Object.keys(theirs || {}),
            ...Object.keys(ours || {})
        ]);

        for (const key of allKeys) {
            const path = parentPath ? `${parentPath}.${key}` : key;
            const baseValue = base ? base[key] : undefined;
            const theirsValue = theirs ? theirs[key] : undefined;
            const oursValue = ours ? ours[key] : undefined;

            if (_.isEqual(baseValue, theirsValue)) {
                if (_.isEqual(baseValue, oursValue)) {
                    if (baseValue !== undefined) {
                        merged[key] = baseValue;
                    }
                    continue;
                }

                if (_.isPlainObject(oursValue) && _.isPlainObject(baseValue)) {
                    const nested = this._mergeJsonObjects(baseValue, baseValue, oursValue, path);
                    if (nested.conflicts.length > 0) {
                        conflicts.push(...nested.conflicts);
                    }
                    merged[key] = nested.merged;
                } else {
                    merged[key] = oursValue;
                }
                continue;
            }

            if (_.isEqual(baseValue, oursValue)) {
                if (_.isPlainObject(theirsValue) && _.isPlainObject(baseValue)) {
                    const nested = this._mergeJsonObjects(baseValue, theirsValue, baseValue, path);
                    if (nested.conflicts.length > 0) {
                        conflicts.push(...nested.conflicts);
                    }
                    merged[key] = nested.merged;
                } else {
                    merged[key] = theirsValue;
                }
                continue;
            }

            if (_.isEqual(theirsValue, oursValue)) {
                merged[key] = theirsValue;
                continue;
            }

            if (_.isPlainObject(baseValue) && _.isPlainObject(theirsValue) && _.isPlainObject(oursValue)) {
                const nested = this._mergeJsonObjects(baseValue, theirsValue, oursValue, path);
                if (nested.conflicts.length > 0) {
                    conflicts.push(...nested.conflicts);
                }
                merged[key] = nested.merged;
                continue;
            }

            conflicts.push({
                type: 'json_path_conflict',
                path,
                base: baseValue,
                theirs: theirsValue,
                ours: oursValue,
                dataType: typeof baseValue
            });

            merged[key] = {
                _conflict: true,
                _path: path,
                base: baseValue,
                theirs: theirsValue,
                ours: oursValue
            };
        }

        return { merged, conflicts };
    }

    _collectChangedPaths(base, theirs, ours) {
        const changes = [];
        const collect = (b, t, o, path) => {
            const allKeys = new Set([
                ...Object.keys(b || {}),
                ...Object.keys(t || {}),
                ...Object.keys(o || {})
            ]);

            for (const key of allKeys) {
                const p = path ? `${path}.${key}` : key;
                const bv = b ? b[key] : undefined;
                const tv = t ? t[key] : undefined;
                const ov = o ? o[key] : undefined;

                if (!_.isEqual(bv, tv) || !_.isEqual(bv, ov)) {
                    changes.push(p);
                }

                if (_.isPlainObject(bv) || _.isPlainObject(tv) || _.isPlainObject(ov)) {
                    collect(bv, tv, ov, p);
                }
            }
        };
        collect(base, theirs, ours, '');
        return changes;
    }

    _findLineConflicts(baseLines, theirsLines, oursLines) {
        const conflicts = [];
        const baseStr = baseLines.join('\n');
        const theirsStr = theirsLines.join('\n');
        const oursStr = oursLines.join('\n');

        if (theirsStr === oursStr) {
            return [];
        }

        const theirDiff = diffLines(baseStr, theirsStr);
        const ourDiff = diffLines(baseStr, oursStr);

        let theirChanges = this._extractChangedRegions(theirDiff);
        let ourChanges = this._extractChangedRegions(ourDiff);

        for (const theirChange of theirChanges) {
            for (const ourChange of ourChanges) {
                if (this._regionsOverlap(theirChange.baseRegion, ourChange.baseRegion)) {
                    conflicts.push({
                        baseRange: theirChange.baseRegion,
                        theirsRange: theirChange.newRegion,
                        oursRange: ourChange.newRegion,
                        baseContent: theirChange.baseContent,
                        theirsContent: theirChange.newContent,
                        oursContent: ourChange.newContent
                    });
                }
            }
        }

        return conflicts;
    }

    _extractChangedRegions(diffParts) {
        const regions = [];
        let baseOffset = 0;
        let theirOffset = 0;

        for (const part of diffParts) {
            if (part.added) {
                theirOffset += part.count;
            } else if (part.removed) {
                regions.push({
                    baseRegion: { start: baseOffset, end: baseOffset + part.count - 1 },
                    newRegion: { start: theirOffset, end: theirOffset },
                    baseContent: part.value,
                    newContent: ''
                });
                baseOffset += part.count;
            } else {
                baseOffset += part.count;
                theirOffset += part.count;
            }
        }

        return regions;
    }

    _regionsOverlap(r1, r2) {
        return !(r1.end < r2.start || r2.end < r1.start);
    }

    _trySimpleMerge(baseLines, theirsLines, oursLines) {
        const baseStr = baseLines.join('\n');
        const theirsStr = theirsLines.join('\n');
        const oursStr = oursLines.join('\n');

        if (theirsStr === oursStr) {
            return theirsStr;
        }

        const theirDiff = diffLines(baseStr, theirsStr);
        const ourDiff = diffLines(baseStr, oursStr);

        const theirChanges = this._analyzeDiff(theirDiff);
        const ourChanges = this._analyzeDiff(ourDiff);

        const canSafelyMerge = this._canMergeSafely(theirChanges, ourChanges);

        if (canSafelyMerge) {
            return this._doSmartMerge(baseLines, theirsLines, oursLines, theirChanges, ourChanges);
        }

        return oursStr;
    }

    _analyzeDiff(diffParts) {
        const changes = {
            modifications: [],
            additions: [],
            removals: [],
            onlyAppends: true,
            onlyPrepends: true,
            modifiesMiddle: false
        };

        let basePos = 0;

        for (const part of diffParts) {
            const lineCount = part.count || (part.value ? part.value.split('\n').filter(l => l || part.value.endsWith('\n')).length : 0);

            if (part.added) {
                changes.additions.push({ lines: part.value.split('\n'), pos: basePos });
            } else if (part.removed) {
                changes.removals.push({ lines: part.value.split('\n'), pos: basePos });
                changes.modifications.push({ pos: basePos, count: lineCount });
                if (basePos > 0) {
                    changes.onlyAppends = false;
                    changes.onlyPrepends = false;
                    changes.modifiesMiddle = true;
                }
                basePos += lineCount;
            } else {
                basePos += lineCount;
            }
        }

        return changes;
    }

    _canMergeSafely(theirChanges, ourChanges) {
        if (theirChanges.modifiesMiddle && ourChanges.modifiesMiddle) {
            return false;
        }

        if (theirChanges.removals.length > 0 && ourChanges.removals.length > 0) {
            return false;
        }

        return true;
    }

    _doSmartMerge(baseLines, theirsLines, oursLines, theirChanges, ourChanges) {
        const baseSet = new Set(baseLines);
        const theirOnlyLines = theirsLines.filter(l => l.trim() && !baseSet.has(l));
        const ourOnlyLines = oursLines.filter(l => l.trim() && !baseSet.has(l));

        if (theirOnlyLines.length > 0 || ourOnlyLines.length > 0) {
            const theirsIsOnlyAppending = this._isOnlyAppending(baseLines, theirsLines);
            const oursIsOnlyAppending = this._isOnlyAppending(baseLines, oursLines);

            if (theirsIsOnlyAppending && !oursIsOnlyAppending) {
                const result = [...oursLines];
                for (const line of theirOnlyLines) {
                    if (!result.includes(line)) {
                        result.push(line);
                    }
                }
                return result.join('\n');
            }

            if (oursIsOnlyAppending && !theirsIsOnlyAppending) {
                const result = [...theirsLines];
                for (const line of ourOnlyLines) {
                    if (!result.includes(line)) {
                        result.push(line);
                    }
                }
                return result.join('\n');
            }

            if (theirsIsOnlyAppending && oursIsOnlyAppending) {
                const result = [...baseLines];
                for (const line of [...theirOnlyLines, ...ourOnlyLines]) {
                    if (!result.includes(line)) {
                        result.push(line);
                    }
                }
                return result.join('\n');
            }
        }

        if (theirChanges.additions.length > 0) {
            return [...oursLines, ...theirsLines.slice(baseLines.length)].join('\n');
        }

        return oursLines.join('\n');
    }

    _isOnlyAppending(baseLines, modifiedLines) {
        const cleanBase = this._cleanLines(baseLines);
        const cleanModified = this._cleanLines(modifiedLines);

        if (cleanModified.length < cleanBase.length) {
            return false;
        }

        for (let i = 0; i < cleanBase.length; i++) {
            if (cleanBase[i] !== cleanModified[i]) {
                return false;
            }
        }

        return true;
    }

    _cleanLines(lines) {
        if (lines.length === 0) return [];

        const result = [...lines];

        while (result.length > 0 && result[result.length - 1] === '') {
            result.pop();
        }

        return result;
    }

    _describeChanges(base, theirs, ours) {
        const theirDiff = diffChars(base, theirs);
        const ourDiff = diffChars(base, ours);

        const countChanges = (diff) => {
            let added = 0, removed = 0;
            for (const part of diff) {
                if (part.added) added += part.count;
                if (part.removed) removed += part.count;
            }
            return { added, removed };
        };

        return {
            theirs: countChanges(theirDiff),
            ours: countChanges(ourDiff)
        };
    }

    _generateConflictMarker(base, theirs, ours) {
        return `<<<<<<< BASE (Original)
${base}
======= (THEIRS - Other person's changes)
${theirs}
======= (OURS - Your changes)
${ours}
>>>>>>> END_CONFLICT
`;
    }
}

MergeEngine.MERGE_STATUS = MERGE_STATUS;

module.exports = MergeEngine;
