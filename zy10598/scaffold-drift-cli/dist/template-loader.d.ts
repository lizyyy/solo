import { TemplateManifest } from './types';
export declare class TemplateLoader {
    load(templatePath: string): Promise<TemplateManifest>;
    getTemplateFileContent(templatePath: string, filePath: string): Promise<string | null>;
}
