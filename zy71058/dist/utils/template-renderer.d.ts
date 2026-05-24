export interface RenderedTemplate {
    filePath: string;
    originalContent: string;
    renderedContent: string;
}
export declare function renderTemplate(content: string, values: Record<string, unknown>): string;
export declare function renderTemplateFile(filePath: string, values: Record<string, unknown>): RenderedTemplate;
export declare function renderTemplateDir(templateDir: string, values: Record<string, unknown>): RenderedTemplate[];
export declare function resolveTemplateReferences(content: string, values: Record<string, unknown>): string;
