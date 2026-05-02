import * as vscode from 'vscode';
import { ReviewPanelProvider } from './panelProvider';
import { apiClient } from './apiClient';
import { Severity, CardStatus } from './types';

let currentPRId: string | null = null;

export function activate(context: vscode.ExtensionContext) {
  const panelProvider = new ReviewPanelProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ReviewPanelProvider.viewType, panelProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('prReviewEvidenceFolder.showPanel', async () => {
      await vscode.commands.executeCommand('workbench.view.extension.prReviewEvidenceFolder');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('prReviewEvidenceFolder.createCard', async () => {
      try {
        await apiClient.healthCheck();
      } catch (error) {
        vscode.window.showErrorMessage('无法连接到本地服务，请确保服务已启动 (npm run dev in server/)');
        return;
      }

      const prs = await apiClient.getPRs();
      if (prs.length === 0) {
        const prTitle = await vscode.window.showInputBox({
          prompt: '请输入 PR 标题',
          placeHolder: '例如: Feature: 添加新功能'
        });
        if (!prTitle) {
          return;
        }
        currentPRId = await apiClient.createPR(prTitle);
      } else {
        const items = prs.map(pr => ({
          label: pr.title,
          description: pr.id,
          id: pr.id
        }));
        items.unshift({ label: '➕ 创建新 PR', description: '', id: 'new' });

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: '选择要添加卡片的 PR'
        });

        if (!selected) {
          return;
        }

        if (selected.id === 'new') {
          const prTitle = await vscode.window.showInputBox({
            prompt: '请输入 PR 标题'
          });
          if (!prTitle) {
            return;
          }
          currentPRId = await apiClient.createPR(prTitle);
        } else {
          currentPRId = selected.id;
        }
      }

      const editor = vscode.window.activeTextEditor;
      let codeLocation: any = undefined;

      if (editor && !editor.selection.isEmpty) {
        const selection = editor.selection;
        const document = editor.document;
        
        const startLine = selection.start.line + 1;
        const endLine = selection.end.line + 1;
        const filePath = document.uri.fsPath;
        
        let lineContent = '';
        const contextBefore: string[] = [];
        const contextAfter: string[] = [];

        for (let i = Math.max(0, selection.start.line - 2); i < selection.start.line; i++) {
          if (i < document.lineCount) {
            contextBefore.push(document.lineAt(i).text);
          }
        }

        if (startLine === endLine) {
          lineContent = document.lineAt(selection.start.line).text;
        } else {
          for (let i = selection.start.line; i <= selection.end.line; i++) {
            if (i < document.lineCount) {
              lineContent += document.lineAt(i).text + '\n';
            }
          }
          lineContent = lineContent.trim();
        }

        for (let i = selection.end.line + 1; i <= Math.min(document.lineCount - 1, selection.end.line + 2); i++) {
          contextAfter.push(document.lineAt(i).text);
        }

        codeLocation = {
          filePath,
          startLine,
          endLine,
          startColumn: selection.start.character + 1,
          endColumn: selection.end.character + 1,
          lineContent,
          contextBefore,
          contextAfter
        };
      }

      const severityOptions = [
        { label: '🔴 Critical', value: Severity.CRITICAL },
        { label: '🟠 High', value: Severity.HIGH },
        { label: '🟡 Medium', value: Severity.MEDIUM },
        { label: '🟢 Low', value: Severity.LOW }
      ];

      const selectedSeverity = await vscode.window.showQuickPick(severityOptions, {
        placeHolder: '选择严重级别'
      });

      if (!selectedSeverity) {
        return;
      }

      const title = await vscode.window.showInputBox({
        prompt: '输入卡片标题',
        placeHolder: '简要描述问题'
      });

      if (!title) {
        return;
      }

      const description = await vscode.window.showInputBox({
        prompt: '输入详细描述 (可选)',
        placeHolder: '详细说明问题...'
      });

      try {
        const cardId = await apiClient.createCard({
          prId: currentPRId!,
          title,
          description: description || '',
          severity: selectedSeverity.value,
          codeLocation
        });

        vscode.window.showInformationMessage(`卡片已创建: ${title}`);
        await vscode.commands.executeCommand('workbench.view.extension.prReviewEvidenceFolder');
      } catch (error: any) {
        if (error.response && error.response.status === 409) {
          const duplicate = error.response.data.duplicate;
          const choice = await vscode.window.showWarningMessage(
            `发现重复位置 (卡片: ${duplicate.cardTitle})`,
            '仍然创建',
            '取消'
          );
          if (choice === '仍然创建') {
            try {
              const cardId = await apiClient.createCard({
                prId: currentPRId!,
                title,
                description: description || '',
                severity: selectedSeverity.value
              });
              if (codeLocation) {
                await apiClient.addLocation(cardId, codeLocation);
              }
              vscode.window.showInformationMessage(`卡片已创建: ${title}`);
            } catch (e) {
              vscode.window.showErrorMessage('创建卡片失败');
            }
          }
        } else {
          vscode.window.showErrorMessage('创建卡片失败: ' + (error.message || '未知错误'));
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('prReviewEvidenceFolder.importDiff', async () => {
      try {
        await apiClient.healthCheck();
      } catch (error) {
        vscode.window.showErrorMessage('无法连接到本地服务');
        return;
      }

      const editor = vscode.window.activeTextEditor;
      let defaultDiff = '';

      if (editor) {
        defaultDiff = editor.document.getText();
      }

      const prTitle = await vscode.window.showInputBox({
        prompt: '输入 PR 标题',
        placeHolder: '例如: PR #123 - 新功能'
      });

      if (!prTitle) {
        return;
      }

      const diffContent = await vscode.window.showInputBox({
        prompt: '粘贴 Git diff 内容',
        value: defaultDiff,
        placeHolder: 'diff --git a/...'
      });

      if (!diffContent) {
        return;
      }

      try {
        const result = await apiClient.importDiff(prTitle, diffContent);
        vscode.window.showInformationMessage(
          `PR 已导入: ${result.stats.filesChanged} 个文件, ${result.stats.linesAdded} 行新增`
        );
        currentPRId = result.prId;
        await vscode.commands.executeCommand('workbench.view.extension.prReviewEvidenceFolder');
      } catch (error) {
        vscode.window.showErrorMessage('导入 diff 失败');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('prReviewEvidenceFolder.exportMarkdown', async () => {
      try {
        await apiClient.healthCheck();
      } catch (error) {
        vscode.window.showErrorMessage('无法连接到本地服务');
        return;
      }

      const prs = await apiClient.getPRs();
      if (prs.length === 0) {
        vscode.window.showWarningMessage('没有可用的 PR');
        return;
      }

      const selected = await vscode.window.showQuickPick(
        prs.map(pr => ({ label: pr.title, id: pr.id })),
        { placeHolder: '选择要导出的 PR' }
      );

      if (!selected) {
        return;
      }

      try {
        const markdown = await apiClient.exportMarkdown(selected.id);
        const uri = await vscode.window.showSaveDialog({
          saveLabel: '保存',
          filters: { 'Markdown': ['md'] },
          defaultName: `review-${selected.id}.md`
        });

        if (uri) {
          await vscode.workspace.fs.writeFile(uri, Buffer.from(markdown, 'utf-8'));
          vscode.window.showInformationMessage('Markdown 已导出');
        }
      } catch (error) {
        vscode.window.showErrorMessage('导出失败');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('prReviewEvidenceFolder.exportJson', async () => {
      try {
        await apiClient.healthCheck();
      } catch (error) {
        vscode.window.showErrorMessage('无法连接到本地服务');
        return;
      }

      const prs = await apiClient.getPRs();
      if (prs.length === 0) {
        vscode.window.showWarningMessage('没有可用的 PR');
        return;
      }

      const selected = await vscode.window.showQuickPick(
        prs.map(pr => ({ label: pr.title, id: pr.id })),
        { placeHolder: '选择要导出的 PR' }
      );

      if (!selected) {
        return;
      }

      try {
        const json = await apiClient.exportJson(selected.id);
        const uri = await vscode.window.showSaveDialog({
          saveLabel: '保存',
          filters: { 'JSON': ['json'] },
          defaultName: `review-audit-${selected.id}.json`
        });

        if (uri) {
          await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf-8'));
          vscode.window.showInformationMessage('JSON 审计包已导出');
        }
      } catch (error) {
        vscode.window.showErrorMessage('导出失败');
      }
    })
  );
}

export function deactivate() {}
