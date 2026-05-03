import React from 'react';
import { useApp } from '../contexts/AppContext';
import { 
  loadProjectViaIPC, 
  saveProjectViaIPC,
  deserializeProject
} from '../../shared/services/storage';
import { 
  generateMarkdownReport,
  exportMarkdownViaIPC,
  createDefaultExportOptions
} from '../../shared/services/exporter';
import { parseCSV } from '../../shared/services/csvParser';
import { parseFixtureJson, parsePatchJson } from '../../shared/services/jsonParser';
import { createCue, createPatchEntry } from '../../shared/models';
import { v4 as uuidv4 } from 'uuid';

interface MenuBarProps {
  className?: string;
}

export const MenuBar: React.FC<MenuBarProps> = ({ className }) => {
  const { state, setProject, addCue, addFixture, addPatch, dispatch } = useApp();

  const handleNewProject = () => {
    if (state.isDirty) {
      const confirmed = window.confirm(
        '当前项目有未保存的更改，确定要新建项目吗？'
      );
      if (!confirmed) return;
    }
    dispatch({ type: 'RESET' });
  };

  const handleOpenProject = async () => {
    if (state.isDirty) {
      const confirmed = window.confirm(
        '当前项目有未保存的更改，确定要打开其他项目吗？'
      );
      if (!confirmed) return;
    }

    const result = await loadProjectViaIPC();
    if (result.success && result.project) {
      setProject(result.project);
      dispatch({ 
        type: 'SET_SAVED_PATH', 
        payload: { path: result.filePath || null, fileName: result.fileName || null }
      });
    } else if (result.error && result.error !== '用户取消了加载') {
      alert(`加载项目失败: ${result.error}`);
    }
  };

  const handleSaveProject = async () => {
    const result = await saveProjectViaIPC(state.project, state.lastSavedPath || undefined);
    if (result.success) {
      dispatch({ type: 'SET_DIRTY', payload: false });
      dispatch({ 
        type: 'SET_SAVED_PATH', 
        payload: { path: result.filePath || null, fileName: result.fileName || null }
      });
      alert('项目已保存');
    } else if (result.error && result.error !== '用户取消了保存') {
      alert(`保存项目失败: ${result.error}`);
    }
  };

  const handleImportFixtures = async () => {
    try {
      const result = await window.electronAPI.openFile('json');
      if (result.canceled || !result.content) return;

      const fixtures = parseFixtureJson(result.content);
      for (const fixture of fixtures) {
        addFixture(fixture);
      }
      alert(`成功导入 ${fixtures.length} 个灯具`);
    } catch (error) {
      alert(`导入灯具失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleImportPatches = async () => {
    try {
      const result = await window.electronAPI.openFile('json');
      if (result.canceled || !result.content) return;

      const patchData = parsePatchJson(result.content);
      for (const patch of patchData.patches) {
        const fixture = state.project.fixtures.find(f => f.id === patch.fixtureId);
        if (fixture) {
          const patchEntry = createPatchEntry(
            patch.fixtureId,
            patch.universe,
            patch.startChannel,
            fixture.channelCount,
            {
              patchName: patch.patchName,
              notes: patch.notes
            }
          );
          addPatch(patchEntry);
        }
      }
      alert(`成功导入 ${patchData.patches.length} 个 Patch 条目`);
    } catch (error) {
      alert(`导入 Patch 失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleImportCues = async () => {
    try {
      const result = await window.electronAPI.openFile('csv');
      if (result.canceled || !result.content) return;

      const { rows } = parseCSV(result.content);
      
      for (const row of rows) {
        const activeFixtures = row.active_fixtures 
          ? row.active_fixtures.split(',').map(s => s.trim()).filter(Boolean)
          : [];

        const cue = createCue(
          row.cue_number || uuidv4(),
          parseFloat(row.time) || 0,
          {
            name: row.cue_name,
            fadeIn: parseFloat(row.fade_in) || 0,
            fadeOut: parseFloat(row.fade_out) || 0,
            delay: parseFloat(row.delay) || 0,
            isLocked: row.is_locked === 'true' || row.is_locked === 'TRUE',
            isBlackout: row.is_blackout === 'true' || row.is_blackout === 'TRUE',
            activeFixtures,
            notes: row.notes
          }
        );
        addCue(cue);
      }

      alert(`成功导入 ${rows.length} 个 Cue`);
    } catch (error) {
      alert(`导入 Cue 失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleExportReport = async () => {
    if (!state.ruleResult) {
      alert('请先运行验证检查');
      return;
    }

    try {
      const options = {
        ...createDefaultExportOptions(),
        title: `Cue 安全预演台 - ${state.project.name} 技术复核单`
      };
      
      const markdown = generateMarkdownReport(
        state.project,
        state.ruleResult,
        options
      );

      const result = await exportMarkdownViaIPC(
        markdown, 
        `${state.project.name}-复核单.md`
      );

      if (result.success) {
        alert('报告已导出');
      } else if (result.error && result.error !== '用户取消了导出') {
        alert(`导出失败: ${result.error}`);
      }
    } catch (error) {
      alert(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  return (
    <div className={`menu-bar ${className || ''}`}>
      <div className="menu-bar-left">
        <span className="app-title">🎭 Cue 安全预演台</span>
        {state.lastSavedFileName && (
          <span className="project-name">
            {state.isDirty && '• '}
            {state.lastSavedFileName}
          </span>
        )}
      </div>
      <div className="menu-bar-right">
        <div className="menu-section">
          <span className="menu-label">文件</span>
          <div className="menu-dropdown">
            <button onClick={handleNewProject}>新建项目</button>
            <button onClick={handleOpenProject}>打开项目...</button>
            <div className="menu-divider"></div>
            <button onClick={handleSaveProject}>保存项目</button>
            <div className="menu-divider"></div>
            <button onClick={handleImportFixtures}>导入灯具 JSON...</button>
            <button onClick={handleImportPatches}>导入 Patch JSON...</button>
            <button onClick={handleImportCues}>导入 Cue CSV...</button>
            <div className="menu-divider"></div>
            <button onClick={handleExportReport}>导出技术复核单...</button>
          </div>
        </div>

        <div className="project-stats">
          <span className="stat">
            灯具: {state.project.fixtures.length}
          </span>
          <span className="stat">
            Cue: {state.project.cues.length}
          </span>
          {state.ruleResult && (
            <>
              <span className="stat stat-error">
                错误: {state.ruleResult.errors.length}
              </span>
              <span className="stat stat-warning">
                警告: {state.ruleResult.warnings.length}
              </span>
            </>
          )}
        </div>
      </div>

      <style>{`
        .menu-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          background-color: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          min-height: 48px;
        }

        .menu-bar-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .app-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--accent-primary);
        }

        .project-name {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .menu-bar-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .menu-section {
          position: relative;
        }

        .menu-label {
          padding: 8px 12px;
          font-size: 14px;
          cursor: pointer;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .menu-label:hover {
          background-color: var(--bg-tertiary);
        }

        .menu-section:hover .menu-dropdown {
          display: block;
        }

        .menu-dropdown {
          display: none;
          position: absolute;
          top: 100%;
          left: 0;
          min-width: 200px;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 4px 0;
          z-index: 1000;
          box-shadow: var(--shadow);
        }

        .menu-dropdown button {
          display: block;
          width: 100%;
          padding: 8px 16px;
          text-align: left;
          font-size: 14px;
          transition: background-color 0.2s;
        }

        .menu-dropdown button:hover {
          background-color: var(--bg-tertiary);
        }

        .menu-divider {
          height: 1px;
          background-color: var(--border-color);
          margin: 4px 0;
        }

        .project-stats {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 13px;
        }

        .stat {
          padding: 4px 8px;
          border-radius: 4px;
          background-color: var(--bg-tertiary);
          color: var(--text-secondary);
        }

        .stat-error {
          background-color: rgba(248, 113, 113, 0.2);
          color: var(--error);
        }

        .stat-warning {
          background-color: rgba(251, 191, 36, 0.2);
          color: var(--warning);
        }
      `}</style>
    </div>
  );
};
