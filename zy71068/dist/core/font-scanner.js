import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { scanDirectory, getFileExtension } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';
const FONT_EXTENSIONS = ['woff2', 'woff', 'ttf', 'otf', 'eot', 'svg'];
export class FontScanner {
    projectDir;
    customExtensions;
    constructor(projectDir, customExtensions = []) {
        this.projectDir = projectDir;
        this.customExtensions = customExtensions;
    }
    async scan(verbose = false) {
        logger.debug(`开始扫描字体文件: ${this.projectDir}`, verbose);
        const extensions = [...FONT_EXTENSIONS, ...this.customExtensions];
        const patterns = extensions.map((ext) => `**/*.${ext}`);
        const files = await scanDirectory(this.projectDir, patterns);
        const fontFiles = [];
        for (const filePath of files) {
            const fontFile = await this.parseFontFile(filePath);
            if (fontFile) {
                fontFiles.push(fontFile);
                logger.debug(`发现字体: ${fontFile.familyName} (${fontFile.format})`, verbose);
            }
        }
        logger.success(`扫描完成，共发现 ${fontFiles.length} 个字体文件`);
        return fontFiles;
    }
    async parseFontFile(filePath) {
        try {
            const stats = await fs.stat(filePath);
            const fileName = path.basename(filePath);
            const ext = getFileExtension(fileName);
            if (!FONT_EXTENSIONS.includes(ext) && !this.customExtensions.includes(ext)) {
                return null;
            }
            const familyName = this.extractFamilyName(fileName);
            const { weight, style, version } = this.parseFontAttributes(fileName);
            const hash = crypto
                .createHash('md5')
                .update(`${filePath}-${stats.size}-${stats.mtime.getTime()}`)
                .digest('hex');
            return {
                id: hash,
                path: filePath,
                fileName,
                familyName,
                format: ext,
                size: stats.size,
                lastModified: stats.mtime,
                version,
                weight,
                style,
            };
        }
        catch (error) {
            logger.warn(`解析字体文件失败: ${filePath}`);
            return null;
        }
    }
    extractFamilyName(fileName) {
        const name = fileName.replace(/\.[^.]+$/, '');
        const cleaned = name
            .replace(/[-_](regular|bold|italic|light|medium|thin|black|heavy)/gi, '')
            .replace(/[-_]\d+(\.\d+)?.*$/, '')
            .replace(/[_-]/g, ' ')
            .trim();
        return cleaned || name;
    }
    parseFontAttributes(fileName) {
        const lowerName = fileName.toLowerCase();
        let weight;
        let style;
        let version;
        if (/thin|hairline/.test(lowerName))
            weight = '100';
        else if (/extra.?light|ultra.?light/.test(lowerName))
            weight = '200';
        else if (/light/.test(lowerName))
            weight = '300';
        else if (/regular|normal/.test(lowerName))
            weight = '400';
        else if (/medium/.test(lowerName))
            weight = '500';
        else if (/semi.?bold|demi.?bold/.test(lowerName))
            weight = '600';
        else if (/extra.?bold|ultra.?bold/.test(lowerName))
            weight = '800';
        else if (/bold/.test(lowerName))
            weight = '700';
        else if (/black|heavy/.test(lowerName))
            weight = '900';
        if (/italic|oblique/.test(lowerName)) {
            style = 'italic';
        }
        const versionMatch = fileName.match(/[-_]v?(\d+\.\d+(\.\d+)?)/i);
        if (versionMatch) {
            version = versionMatch[1];
        }
        return { weight, style, version };
    }
    getFontFilesByFamily(fontFiles) {
        const familyMap = new Map();
        for (const font of fontFiles) {
            const key = font.familyName.toLowerCase();
            if (!familyMap.has(key)) {
                familyMap.set(key, []);
            }
            familyMap.get(key).push(font);
        }
        return familyMap;
    }
    detectVersionConflicts(fontFiles) {
        const familyMap = this.getFontFilesByFamily(fontFiles);
        const conflicts = new Map();
        for (const [family, files] of familyMap) {
            const versions = new Set(files.map((f) => f.version).filter(Boolean));
            if (files.length > 1 && versions.size > 1) {
                conflicts.set(family, files);
            }
        }
        return conflicts;
    }
}
//# sourceMappingURL=font-scanner.js.map