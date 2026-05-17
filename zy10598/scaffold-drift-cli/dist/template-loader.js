"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateLoader = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
class TemplateLoader {
    async load(templatePath) {
        const manifestPath = path_1.default.join(templatePath, 'scaffold-manifest.json');
        const manifestPathYaml = path_1.default.join(templatePath, 'scaffold-manifest.yaml');
        let manifest;
        if (await fs_extra_1.default.pathExists(manifestPath)) {
            const content = await fs_extra_1.default.readFile(manifestPath, 'utf-8');
            manifest = JSON.parse(content);
        }
        else if (await fs_extra_1.default.pathExists(manifestPathYaml)) {
            const content = await fs_extra_1.default.readFile(manifestPathYaml, 'utf-8');
            manifest = js_yaml_1.default.load(content);
        }
        else {
            throw new Error(`Template manifest not found in ${templatePath}`);
        }
        if (!manifest.files)
            manifest.files = [];
        if (!manifest.configs)
            manifest.configs = [];
        return manifest;
    }
    async getTemplateFileContent(templatePath, filePath) {
        const fullPath = path_1.default.join(templatePath, filePath);
        if (await fs_extra_1.default.pathExists(fullPath)) {
            return await fs_extra_1.default.readFile(fullPath, 'utf-8');
        }
        return null;
    }
}
exports.TemplateLoader = TemplateLoader;
