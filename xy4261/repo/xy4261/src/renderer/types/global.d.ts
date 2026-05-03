export {};

declare global {
  interface Window {
    electronAPI: {
      openFile: (fileType: string) => Promise<{
        canceled: boolean;
        filePath?: string;
        content?: string;
        fileName?: string;
      }>;
      saveFile: (data: string, defaultPath?: string) => Promise<{
        canceled: boolean;
        filePath?: string;
        fileName?: string;
      }>;
      exportMarkdown: (content: string, defaultPath?: string) => Promise<{
        canceled: boolean;
        filePath?: string;
        fileName?: string;
      }>;
    };
  }
}
