import { useState, useCallback } from 'react';
import { parseBaysJson } from '@/parsers/baysParser';
import { parseCargoCsv } from '@/parsers/cargoParser';
import { parseRulesYaml } from '@/parsers/rulesParser';
import type { StowageState, ParsingError } from '@/types';

interface FileImportProps {
  onLoad: (state: StowageState) => void;
}

export function FileImport({ onLoad }: FileImportProps) {
  const [errors, setErrors] = useState<ParsingError[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFiles = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setErrors([]);

    let baysContent = '';
    let cargoContent = '';
    let rulesContent = '';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const content = await file.text();
      
      if (file.name.endsWith('.json')) {
        baysContent = content;
      } else if (file.name.endsWith('.csv')) {
        cargoContent = content;
      } else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
        rulesContent = content;
      }
    }

    const [baysResult, cargoResult, rulesResult] = await Promise.all([
      parseBaysJson(baysContent),
      parseCargoCsv(cargoContent),
      parseRulesYaml(rulesContent),
    ]);

    const allErrors = [...baysResult.errors, ...cargoResult.errors, ...rulesResult.errors];
    setErrors(allErrors);

    if (allErrors.length === 0) {
      onLoad({
        bays: baysResult.bays,
        cargoItems: cargoResult.cargoItems,
        placements: [],
        rules: rulesResult.rules,
      });
    }

    setLoading(false);
  }, [onLoad]);

  const triggerFileInput = () => {
    const input = document.querySelector('.file-input') as HTMLInputElement;
    if (input) {
      input.click();
    }
  };

  return (
    <div className="file-import">
      <input
        type="file"
        multiple
        accept=".json,.csv,.yaml,.yml"
        onChange={handleFiles}
        disabled={loading}
        className="file-input"
      />
      <button 
        onClick={triggerFileInput}
        disabled={loading}
        className="btn btn-primary"
      >
        {loading ? '加载中...' : '导入文件'}
      </button>
      
      {errors.length > 0 && (
        <div className="error-list">
          <h4>导入错误</h4>
          <ul>
            {errors.map((error, index) => (
              <li key={index}>
                <strong>{error.field}</strong>: {error.message}
                {error.rowIndex !== undefined && ` (行 ${error.rowIndex + 1})`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}