import { ExperimentState, STATUS_TEXT, FORCE_INFO, PHYSICAL_CONSTANTS } from '../types';
import { formatTime } from './validation';

export function generateReport(state: ExperimentState): string {
  const { params, forces, threshold, errorTraces, conflictTraces } = state;
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN');
  const timeStr = now.toLocaleTimeString('zh-CN');

  let report = `══════════════════════════════════════════════════
            摩擦斜面实验报告
══════════════════════════════════════════════════

生成时间：${dateStr} ${timeStr}

─── 实验参数 ────────────────────────────────────
  斜面角度：${params.angle}°
  物块质量：${params.mass} kg
  摩擦系数：${params.frictionCoefficient}
  重力加速度：${PHYSICAL_CONSTANTS.GRAVITY} m/s²

─── 受力分析 ────────────────────────────────────
  ${FORCE_INFO.gravity.symbol} (${FORCE_INFO.gravity.name})：${forces.gravity.toFixed(2)} ${FORCE_INFO.gravity.unit}
  ${FORCE_INFO.normalForce.symbol} (${FORCE_INFO.normalForce.name})：${forces.normalForce.toFixed(2)} ${FORCE_INFO.normalForce.unit}
  ${FORCE_INFO.parallelForce.symbol} (${FORCE_INFO.parallelForce.name})：${forces.parallelForce.toFixed(2)} ${FORCE_INFO.parallelForce.unit}
  ${FORCE_INFO.perpendicularForce.symbol} (${FORCE_INFO.perpendicularForce.name})：${forces.perpendicularForce.toFixed(2)} ${FORCE_INFO.perpendicularForce.unit}
  ${FORCE_INFO.frictionForce.symbol} (${FORCE_INFO.frictionForce.name})：${forces.frictionForce.toFixed(2)} ${FORCE_INFO.frictionForce.unit}
  ${FORCE_INFO.maxStaticFriction.symbol} (${FORCE_INFO.maxStaticFriction.name})：${forces.maxStaticFriction.toFixed(2)} ${FORCE_INFO.maxStaticFriction.unit}

─── 阈值判定 ────────────────────────────────────
  当前状态：${STATUS_TEXT[threshold.status]}
  临界角度：${threshold.criticalAngle}°
  判定理由：
    ${threshold.reason}

─── 计算公式 ────────────────────────────────────
  重力：G = mg
  沿斜面分力：G₁ = mg·sin(θ)
  垂直分力：G₂ = mg·cos(θ)
  最大静摩擦力：f_max = μ·mg·cos(θ)
  临界角度：θ_critical = arctan(μ)
  滑动条件：θ > θ_critical 或 G₁ > f_max

`;

  if (errorTraces.length > 0) {
    report += `═══ 异常记录 ════════════════════════════════════

共有 ${errorTraces.length} 条异常记录：

`;
    errorTraces.forEach((error, index) => {
      report += `  [${index + 1}] ${formatTime(error.timestamp)} - ${error.message}
      参数：角度=${error.params.angle}°, 质量=${error.params.mass}kg, 摩擦=${error.params.frictionCoefficient}
      状态：${error.resolved ? '已处理' : '未处理'}

`;
    });
  }

  if (conflictTraces.length > 0) {
    report += `═══ 冲突留痕 ════════════════════════════════════

共有 ${conflictTraces.length} 条冲突记录：

`;
    conflictTraces.forEach((conflict, index) => {
      report += `  [${index + 1}] ${formatTime(conflict.timestamp)}
      角度证据(优先级1)：${conflict.angleEvidence.evidence}
      摩擦证据(优先级2)：${conflict.frictionEvidence.evidence}
      质量说明(优先级3)：${conflict.massEvidence.evidence}
      处理结果：${conflict.resolution}
      最终判定：${STATUS_TEXT[conflict.finalJudgment]}

`;
    });
  }

  report += `══════════════════════════════════════════════════
              报告结束
══════════════════════════════════════════════════
`;

  return report;
}

export function downloadReport(report: string): void {
  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const now = new Date();
  const filename = `摩擦斜面实验报告_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.txt`;

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function takeScreenshot(canvas: HTMLCanvasElement): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('截图失败'));
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const now = new Date();
        const filename = `摩擦斜面截图_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.png`;

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        resolve();
      }, 'image/png');
    } catch (error) {
      reject(error);
    }
  });
}

export function copyToClipboard(text: string): Promise<boolean> {
  return navigator.clipboard.writeText(text)
    .then(() => true)
    .catch(() => false);
}
