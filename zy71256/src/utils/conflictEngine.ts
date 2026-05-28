import type { Pin, VoltageDomain, Conflict } from "@/data/types";
import { CONFLICT_RULES } from "@/data/conflictRules";

export function detectConflicts(
  pins: Pin[],
  voltageDomains: VoltageDomain[]
): Conflict[] {
  const conflicts: Conflict[] = [];
  let counter = 0;

  const domainMap = new Map<string, VoltageDomain>();
  for (const vd of voltageDomains) {
    domainMap.set(vd.id, vd);
  }

  const pinsBySide = new Map<string, Pin[]>();
  for (const pin of pins) {
    const list = pinsBySide.get(pin.side) ?? [];
    list.push(pin);
    pinsBySide.set(pin.side, list);
  }

  for (const [, sidePins] of pinsBySide) {
    sidePins.sort((a, b) => a.position - b.position);

    for (let i = 0; i < sidePins.length - 1; i++) {
      const pinA = sidePins[i];
      const pinB = sidePins[i + 1];

      if (pinA.voltageDomainId !== pinB.voltageDomainId) {
        const domainA = domainMap.get(pinA.voltageDomainId);
        const domainB = domainMap.get(pinB.voltageDomainId);

        if (domainA && domainB) {
          const diff = Math.abs(domainA.nominalVoltage - domainB.nominalVoltage);
          if (diff > CONFLICT_RULES.voltageMixed.voltageDiffThreshold) {
            counter++;
            conflicts.push({
              id: `conflict_${counter}`,
              type: "voltage_mixed",
              pinIds: [pinA.id, pinB.id],
              message: `引脚 ${pinA.name} (${domainA.name}) 与 ${pinB.name} (${domainB.name}) 电压域混接，电压差 ${diff}V`,
              severity: "error",
            });
          }
        }
      }
    }
  }

  for (const pin of pins) {
    const count = pin.functions.length;
    if (count >= CONFLICT_RULES.pinMux.minFunctionCount) {
      counter++;
      const functionNames = pin.functions.map((f) => f.functionName).join("、");
      conflicts.push({
        id: `conflict_${counter}`,
        type: "pin_mux",
        pinIds: [pin.id],
        message: `引脚 ${pin.name} 存在 ${count} 路复用功能：${functionNames}`,
        severity: "warning",
      });
    }
  }

  for (const [, sidePins] of pinsBySide) {
    for (let i = 0; i < sidePins.length; i++) {
      for (let j = i + 1; j < sidePins.length; j++) {
        const pinA = sidePins[i];
        const pinB = sidePins[j];
        const dx = pinA.x - pinB.x;
        const dy = pinA.y - pinB.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONFLICT_RULES.labelOcclusion.distanceThreshold) {
          counter++;
          conflicts.push({
            id: `conflict_${counter}`,
            type: "label_occlusion",
            pinIds: [pinA.id, pinB.id],
            message: `引脚 ${pinA.name} 与 ${pinB.name} 标签空间重叠`,
            severity: "warning",
          });
        }
      }
    }
  }

  return conflicts;
}
