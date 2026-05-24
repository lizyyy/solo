import { ExcavationSquare, ValidationError } from '../types';

export const validateExcavationData = (
  data: ExcavationSquare
): ValidationError[] => {
  const errors: ValidationError[] = [];

  const artifactIdMap = new Map<string, number>();
  data.artifacts.forEach((artifact) => {
    const count = artifactIdMap.get(artifact.artifactId) || 0;
    artifactIdMap.set(artifact.artifactId, count + 1);
  });

  artifactIdMap.forEach((count, artifactId) => {
    if (count > 1) {
      errors.push({
        type: 'duplicate_id',
        artifactId,
        message: `出土物编号 ${artifactId} 重复出现 ${count} 次`,
      });
    }
  });

  data.artifacts.forEach((artifact) => {
    const layer = data.layers.find((l) => l.id === artifact.layerId);
    if (layer) {
      if (
        artifact.position.z < layer.depthTop ||
        artifact.position.z > layer.depthBottom
      ) {
        errors.push({
          type: 'depth_conflict',
          artifactId: artifact.artifactId,
          layerId: layer.id,
          message: `出土物 ${artifact.artifactId} 深度 ${artifact.position.z} 不在所属层位 ${layer.name} 的深度范围 [${layer.depthTop}, ${layer.depthBottom}] 内`,
        });
      }
    }
  });

  data.artifacts.forEach((artifact) => {
    const { x, y, z } = artifact.position;
    if (
      x < 0 ||
      x > data.gridSize.x ||
      y < 0 ||
      y > data.gridSize.y ||
      z < 0 ||
      z > data.gridSize.z
    ) {
      errors.push({
        type: 'invalid_position',
        artifactId: artifact.artifactId,
        message: `出土物 ${artifact.artifactId} 位置 (${x}, ${y}, ${z}) 超出探方边界`,
      });
    }
  });

  data.artifacts.forEach((artifact) => {
    const layer = data.layers.find((l) => l.id === artifact.layerId);
    if (!layer) {
      errors.push({
        type: 'layer_mismatch',
        artifactId: artifact.artifactId,
        layerId: artifact.layerId,
        message: `出土物 ${artifact.artifactId} 所属层位 ${artifact.layerId} 不存在`,
      });
    }
  });

  return errors;
};

export const getConflictingArtifactIds = (
  errors: ValidationError[]
): string[] => {
  return errors
    .filter((e) => e.artifactId)
    .map((e) => e.artifactId!)
    .filter((v, i, a) => a.indexOf(v) === i);
};
