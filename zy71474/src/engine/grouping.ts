import { Ball, CollisionType, SampleGroup, ImportItem, Experiment } from "@/types";

export function getMassRange(mass: number): string {
  if (mass < 2) return "0-2kg";
  if (mass < 5) return "2-5kg";
  if (mass < 10) return "5-10kg";
  return "10-20kg";
}

export function getVelocityRange(velocity: number): string {
  const absV = Math.abs(velocity);
  if (absV <= 5) return "低速";
  if (absV <= 10) return "中速";
  return "高速";
}

export function computeGroupId(balls: Ball[], collisionType: CollisionType): string {
  if (balls.length === 0) return `empty:empty:${collisionType}`;
  const maxMassBall = balls.reduce((prev, curr) => curr.mass > prev.mass ? curr : prev);
  const maxVelBall = balls.reduce((prev, curr) => Math.abs(curr.velocity) > Math.abs(prev.velocity) ? curr : prev);
  const massRange = getMassRange(maxMassBall.mass);
  const velRange = getVelocityRange(maxVelBall.velocity);
  return `${massRange}:${velRange}:${collisionType}`;
}

export function classifyImport(existing: Experiment[], incoming: Experiment[]): ImportItem[] {
  return incoming.map((exp) => {
    const candidates = existing.filter(e => e.groupId === exp.groupId && e.balls.length === exp.balls.length);

    if (candidates.length === 0) {
      return { experimentId: exp.id, status: "new" as const };
    }

    const exactMatch = candidates.find(e =>
      e.balls.every((b, i) =>
        Math.abs(b.mass - exp.balls[i].mass) < 0.01 &&
        Math.abs(b.velocity - exp.balls[i].velocity) < 0.01
      )
    );

    if (exactMatch) {
      return { experimentId: exp.id, status: "duplicate" as const };
    }

    const closestMatch = candidates[0];
    const changedFields: string[] = [];
    closestMatch.balls.forEach((b, i) => {
      if (Math.abs(b.mass - exp.balls[i].mass) >= 0.01) changedFields.push(`ball[${i}].mass`);
      if (Math.abs(b.velocity - exp.balls[i].velocity) >= 0.01) changedFields.push(`ball[${i}].velocity`);
    });
    if (closestMatch.collisionType !== exp.collisionType) changedFields.push("collisionType");

    return {
      experimentId: exp.id,
      status: "updated" as const,
      changedFields,
      previousVersionId: closestMatch.id
    };
  });
}

export function buildSampleGroups(experiments: Experiment[]): SampleGroup[] {
  const groupMap = new Map<string, SampleGroup>();

  experiments.forEach(exp => {
    if (!groupMap.has(exp.groupId)) {
      const parts = exp.groupId.split(":");
      groupMap.set(exp.groupId, {
        id: exp.groupId,
        massRange: parts[0] || "",
        velocityRange: parts[1] || "",
        collisionType: parts[2] || "",
        experimentIds: []
      });
    }
    groupMap.get(exp.groupId)!.experimentIds.push(exp.id);
  });

  return Array.from(groupMap.values());
}
