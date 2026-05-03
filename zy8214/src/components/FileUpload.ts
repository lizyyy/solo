import { parseFixtures } from '../parsers/jsonParser';
import { parseCues } from '../parsers/csvParser';
import { parseRules } from '../parsers/yamlParser';
import { store } from '../store';

export function renderFileUpload(): string {
  return `
    <div class="upload-area" id="upload-area">
      <input type="file" id="file-input" class="file-input" accept=".json,.csv,.yaml,.yml" multiple />
      <div class="upload-icon">📁</div>
      <div class="upload-text">点击或拖拽文件到此处</div>
      <div class="upload-hint">支持：灯具配置 (JSON)、Cue 表 (CSV)、场景规则 (YAML)</div>
    </div>
  `;
}

export function setupDragDrop(
  element: HTMLElement,
  onFilesSelected?: (files: FileList) => void
): void {
  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    element.classList.add('dragging');
  });

  element.addEventListener('dragleave', (e) => {
    e.preventDefault();
    element.classList.remove('dragging');
  });

  element.addEventListener('drop', (e) => {
    e.preventDefault();
    element.classList.remove('dragging');
    
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      if (onFilesSelected) {
        onFilesSelected(e.dataTransfer.files);
      } else {
        handleFileSelect(e.dataTransfer.files);
      }
    }
  });

  element.addEventListener('click', () => {
    const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
    if (fileInput) {
      fileInput.click();
    }
  });
}

export async function handleFileSelect(files: FileList): Promise<void> {
  const allErrors: { type: string; message: string }[] = [];
  let fixturesLoaded = false;
  let cuesLoaded = false;
  let rulesLoaded = false;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    try {
      const content = await readFileAsText(file);

      switch (ext) {
        case 'json':
          const fixturesResult = parseFixtures(content);
          if (fixturesResult.fixtures.length > 0) {
            store.setFixtures(fixturesResult.fixtures);
            fixturesLoaded = true;
          }
          if (fixturesResult.errors.length > 0) {
            allErrors.push(...fixturesResult.errors.map((e) => ({
              type: 'JSON',
              message: e.message
            })));
          }
          break;

        case 'csv':
          const cuesResult = parseCues(content);
          if (cuesResult.cues.length > 0) {
            store.setCues(cuesResult.cues);
            cuesLoaded = true;
          }
          if (cuesResult.errors.length > 0) {
            allErrors.push(...cuesResult.errors.map((e) => ({
              type: 'CSV',
              message: e.message
            })));
          }
          break;

        case 'yaml':
        case 'yml':
          const rulesResult = parseRules(content);
          store.setRules(rulesResult.rules);
          rulesLoaded = true;
          if (rulesResult.errors.length > 0) {
            allErrors.push(...rulesResult.errors.map((e) => ({
              type: 'YAML',
              message: e.message
            })));
          }
          break;

        default:
          allErrors.push({
            type: '未知',
            message: `不支持的文件格式: ${file.name}`
          });
      }
    } catch (e) {
      allErrors.push({
        type: '错误',
        message: `读取文件 ${file.name} 失败: ${e instanceof Error ? e.message : '未知错误'}`
      });
    }
  }

  if (allErrors.length > 0) {
    console.warn('解析警告:', allErrors);
  }

  const loadedFiles: string[] = [];
  if (fixturesLoaded) loadedFiles.push('灯具配置');
  if (cuesLoaded) loadedFiles.push('Cue 表');
  if (rulesLoaded) loadedFiles.push('场景规则');

  if (loadedFiles.length > 0) {
    console.log('已加载:', loadedFiles.join(', '));
  }
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
