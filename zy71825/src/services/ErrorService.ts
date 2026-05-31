import { RecoveryInfo, DataSource } from '../types';

export class ErrorService {
  private static errorMessages: { [key: string]: string } = {
    'STORAGE_FULL': '哎呀，存储空间满了！请导出一些旧数据后清理一下空间吧',
    'NETWORK_ERROR': '网络连接好像断了，别急，你的操作已经存在本地了',
    'INVALID_DATA': '这个数据格式不对哦，请检查一下格式是否正确',
    'RECORD_NOT_FOUND': '找不到这条记录了，可能被别人删掉了',
    'PERMISSION_DENIED': '你没有权限做这个操作，请找管理员开通',
    'DUPLICATE_RECORD': '这条记录已经存在啦，不用重复添加',
    'IMPORT_FAILED': '导入失败了，请看看是不是文件有问题',
    'EXPORT_FAILED': '导出失败了，请重试一下',
    'UNKNOWN_ERROR': '出了点小问题，别慌，先记下来找技术同学看看'
  };

  static getFriendlyMessage(errorCode: string, details?: string): string {
    const baseMessage = this.errorMessages[errorCode] || this.errorMessages['UNKNOWN_ERROR'];
    return details ? `${baseMessage}（${details}）` : baseMessage;
  }

  static analyzeRecoveryInfo(
    recordSource: string,
    hasLevelData: boolean,
    hasPlayerFeedback: boolean,
    timestamp?: number
  ): RecoveryInfo {
    const isFromLevelTable = recordSource === 'game_data' || hasLevelData;
    const isFromFeedback = recordSource === 'player_feedback' || hasPlayerFeedback;
    
    let source: DataSource = 'unknown';
    let message = '';
    let nextStep = '';
    let contactPerson = '';

    if (isFromLevelTable && isFromFeedback) {
      source = 'level_table';
      message = '这条记录来自关卡草表，同时收到了玩家反馈';
      nextStep = '请先核对关卡草表中的通关记录，确认后补发';
      contactPerson = '活动运营组';
    } else if (isFromLevelTable) {
      source = 'level_table';
      message = '这条记录来自关卡草表，没有玩家反馈';
      nextStep = '请检查关卡数据是否正确，确认后正常发放';
      contactPerson = '数据组';
    } else if (isFromFeedback) {
      source = 'player_feedback';
      message = '这条记录来自玩家反馈，在关卡草表中找不到';
      nextStep = '请联系玩家核实通关情况，必要时走补发流程';
      contactPerson = '客服组';
    } else {
      source = 'unknown';
      message = '这条记录来源不明确，两边都找不到';
      nextStep = '请人工核查，联系数据组和客服组两边确认';
      contactPerson = '活动负责人';
    }

    const timeGap = timestamp ? Date.now() - timestamp : 0;
    if (timeGap > 7 * 24 * 60 * 60 * 1000) {
      message += '，这条记录已经超过7天了，处理时请注意时效性';
    }

    return {
      recoverable: source !== 'unknown',
      source,
      message,
      nextStep,
      contactPerson
    };
  }

  static getSourceText(source: DataSource): string {
    const sourceMap: { [key in DataSource]: string } = {
      'level_table': '关卡草表',
      'player_feedback': '玩家反馈',
      'unknown': '来源不明'
    };
    return sourceMap[source];
  }

  static getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': '⏳ 待处理',
      'confirmed': '✅ 已确认',
      'corrected': '🔧 已修正',
      'topped_up': '💎 已补发'
    };
    return statusMap[status] || status;
  }

  static showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const existing = document.querySelector('.gh-toast');
    if (existing) existing.remove();

    const colors = {
      info: '#3b82f6',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444'
    };

    const toast = document.createElement('div');
    toast.className = 'gh-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 24px;
      background: ${colors[type]};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-size: 14px;
      animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  static showRecoveryDialog(info: RecoveryInfo, onClose?: () => void): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    const sourceColor = info.source === 'level_table' ? '#3b82f6' :
                       info.source === 'player_feedback' ? '#f59e0b' : '#ef4444';

    overlay.innerHTML = `
      <div style="
        background: white;
        border-radius: 16px;
        padding: 24px;
        max-width: 400px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      ">
        <h3 style="margin:0 0 16px 0; font-size:18px;">📋 记录来源分析</h3>
        <div style="margin-bottom:16px;">
          <div style="display:inline-block;padding:4px 12px;border-radius:20px;background:${sourceColor};color:white;font-size:12px;">
            ${this.getSourceText(info.source)}
          </div>
        </div>
        <p style="color:#374151;line-height:1.6;">${info.message}</p>
        <div style="margin-top:16px;padding:12px;background:#fef3c7;border-radius:8px;">
          <div style="font-weight: bold; color: #92400e;">下一步</div>
          <div style="color: #b45309; font-size: 14px;">${info.nextStep}</div>
        </div>
        <div style="margin-top:8px;color:#6b7280;font-size:13px;">
          👤 联系人：<strong>${info.contactPerson}</strong>
        </div>
        <button style="
          margin-top:20px;
          width:100%;
          padding:10px;
          background:#3b82f6;
          color:white;
          border:none;
          border-radius:8px;
          cursor:pointer;
          font-size:14px;
        ">我知道了</button>
      </div>
    `;

    const button = overlay.querySelector('button');
    button?.addEventListener('click', () => {
      overlay.remove();
      onClose?.();
    });

    document.body.appendChild(overlay);
  }

  static injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}
