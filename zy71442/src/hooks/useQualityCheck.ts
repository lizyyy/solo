import { useCallback } from 'react';
import type { Point3D, Vector3D, DataMaterial } from '../types/surface';
import type { DiagnosisIssue, QualityThresholds } from '../types/diagnosis';
import { checkNormalConsistency, checkBoundaryClosure, computeSampleDensity } from '../utils/math/surface';
import { vec3 } from '../utils/math/geometry';
import { useDiagnosisStore } from '../stores/useDiagnosisStore';
import { useSurfaceStore } from '../stores/useSurfaceStore';
import { QUALITY_THRESHOLDS, generateId } from '../data/demoData';

export function useQualityCheck(thresholds: QualityThresholds = QUALITY_THRESHOLDS) {
  const { setIssues, setIsChecking, addIssue } = useDiagnosisStore();
  const { materials, vertices, normals, boundaryPoints, samplePoints } = useSurfaceStore();

  const findMaterialForVertices = (vertexIndices: number[]): DataMaterial | undefined => {
    return materials.find((m) => m.type === 'surface');
  };

  const findMaterialForBoundary = (): DataMaterial | undefined => {
    return materials.find((m) => m.type === 'boundary');
  };

  const findMaterialForSamples = (): DataMaterial | undefined => {
    return materials.find((m) => m.type === 'sample');
  };

  const checkNormals = useCallback(
    (normalsToCheck: Vector3D[], surfaceMaterial?: DataMaterial): DiagnosisIssue[] => {
      const issues: DiagnosisIssue[] = [];
      if (!surfaceMaterial || normalsToCheck.length === 0) return issues;

      const { reversedIndices, deviations } = checkNormalConsistency(
        normalsToCheck,
        thresholds.maxNormalAngleDeviation
      );

      if (reversedIndices.length > 0) {
        const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;
        const maxDeviation = Math.max(...deviations);

        reversedIndices.forEach((idx) => {
          const position = vertices[idx] || { x: 0, y: 0, z: 0 };
          issues.push({
            id: generateId('issue_normal'),
            type: 'normal_reversed',
            severity: 'error',
            message: `法向量方向不一致，偏差角度 ${(deviations[idx] * 180 / Math.PI).toFixed(1)}°`,
            location: {
              materialId: surfaceMaterial.id,
              position,
              vertexIndices: [idx],
            },
            suggestion: `检查曲面参数化方向，考虑对该区域法向量取反或重新参数化曲面。参考法向量偏差：平均${(avgDeviation * 180 / Math.PI).toFixed(1)}°，最大${(maxDeviation * 180 / Math.PI).toFixed(1)}°`,
            nextStep: `点击"修正法向量"按钮自动翻转该区域法向量，或手动调整参数化方程`,
            detectedAt: Date.now(),
            evidence: {
              parameters: {
                deviation: deviations[idx],
                threshold: thresholds.maxNormalAngleDeviation,
              },
              before: { normal: normalsToCheck[idx] },
            },
          });
        });
      }

      return issues;
    },
    [vertices, thresholds.maxNormalAngleDeviation]
  );

  const checkBoundary = useCallback(
    (points: Point3D[], boundaryMaterial?: DataMaterial): DiagnosisIssue[] => {
      const issues: DiagnosisIssue[] = [];
      if (!boundaryMaterial || points.length < 2) return issues;

      const { isClosed, gapStart, gapEnd, maxGap } = checkBoundaryClosure(points, thresholds.maxBoundaryGap);

      if (!isClosed && gapStart !== undefined && gapEnd !== undefined) {
        const gapPoints = points.slice(
          Math.min(gapStart, gapEnd),
          Math.max(gapStart, gapEnd) + 1
        );
        const midPoint = gapPoints.length > 0
          ? gapPoints[Math.floor(gapPoints.length / 2)]
          : { x: 0, y: 0, z: 0 };

        issues.push({
          id: generateId('issue_boundary'),
          type: 'boundary_gap',
          severity: 'warning',
          message: `边界曲线未闭合，最大缺口 ${maxGap.toFixed(4)}`,
          location: {
            materialId: boundaryMaterial.id,
            position: midPoint,
            parameterRange: [gapStart / points.length, gapEnd / points.length] as [number, number],
          },
          suggestion: `在参数t∈[${(gapStart / points.length).toFixed(3)}, ${(gapEnd / points.length).toFixed(3)}]区间内补充边界点，或检查曲线方程是否定义了闭合路径。当前缺口大于阈值 ${thresholds.maxBoundaryGap}`,
          nextStep: `点击"闭合边界"自动插值补全，或手动补充 ${Math.ceil(maxGap / 0.01)} 个采样点`,
          detectedAt: Date.now(),
          evidence: {
            parameters: {
              maxGap,
              threshold: thresholds.maxBoundaryGap,
              gapStart,
              gapEnd,
            },
          },
        });
      }

      return issues;
    },
    [thresholds.maxBoundaryGap]
  );

  const checkSamples = useCallback(
    (points: Point3D[], surfaceVertices: Point3D[], sampleMaterial?: DataMaterial): DiagnosisIssue[] => {
      const issues: DiagnosisIssue[] = [];
      if (!sampleMaterial || points.length === 0 || surfaceVertices.length === 0) return issues;

      const bbox = {
        min: { x: Infinity, y: Infinity, z: Infinity },
        max: { x: -Infinity, y: -Infinity, z: -Infinity },
      };
      surfaceVertices.forEach((p) => {
        bbox.min.x = Math.min(bbox.min.x, p.x);
        bbox.min.y = Math.min(bbox.min.y, p.y);
        bbox.min.z = Math.min(bbox.min.z, p.z);
        bbox.max.x = Math.max(bbox.max.x, p.x);
        bbox.max.y = Math.max(bbox.max.y, p.y);
        bbox.max.z = Math.max(bbox.max.z, p.z);
      });
      const surfaceArea = Math.abs((bbox.max.x - bbox.min.x) * (bbox.max.z - bbox.min.z));

      const { density, sparseIndices, averageSpacing } = computeSampleDensity(points, surfaceArea);

      if (density < thresholds.minSampleDensity) {
        sparseIndices.forEach((idx) => {
          const position = points[idx];
          issues.push({
            id: generateId('issue_sample'),
            type: 'sample_sparse',
            severity: 'warning',
            message: `采样点过稀，该区域间距 ${averageSpacing.toFixed(4)}，密度 ${density.toFixed(2)} 点/单位面积`,
            location: {
              materialId: sampleMaterial.id,
              position,
              region: `(${position.x.toFixed(2)}, ${position.z.toFixed(2)}) 邻域`,
            },
            suggestion: `当前密度 ${density.toFixed(2)} 低于最低要求 ${thresholds.minSampleDensity}。建议在该区域补充采样点，或使用更高密度的采样方案。`,
            nextStep: `点击"加密采样"在该区域自动生成补充点，或手动导入更多采样数据。建议至少补充 ${Math.ceil((thresholds.minSampleDensity - density) * surfaceArea)} 个点`,
            detectedAt: Date.now(),
            evidence: {
              parameters: {
                density,
                averageSpacing,
                threshold: thresholds.minSampleDensity,
                surfaceArea,
                totalSamples: points.length,
              },
            },
          });
        });

        if (sparseIndices.length === 0 && density < thresholds.minSampleDensity) {
          issues.push({
            id: generateId('issue_sample'),
            type: 'sample_sparse',
            severity: 'warning',
            message: `整体采样密度不足：${density.toFixed(2)} 点/单位面积`,
            location: {
              materialId: sampleMaterial.id,
              region: '整个曲面',
            },
            suggestion: `整体采样密度低于最低要求 ${thresholds.minSampleDensity}。建议增加采样点数或调整采样策略。`,
            nextStep: `点击"整体加密"均匀补充采样点，目标密度 ${thresholds.minSampleDensity}`,
            detectedAt: Date.now(),
            evidence: {
              parameters: {
                density,
                averageSpacing,
                threshold: thresholds.minSampleDensity,
                surfaceArea,
                totalSamples: points.length,
              },
            },
          });
        }
      }

      return issues;
    },
    [thresholds.minSampleDensity]
  );

  const runFullCheck = useCallback(async (): Promise<DiagnosisIssue[]> => {
    setIsChecking(true);

    await new Promise((resolve) => setTimeout(resolve, 300));

    const surfaceMaterial = findMaterialForVertices([]);
    const boundaryMaterial = findMaterialForBoundary();
    const sampleMaterial = findMaterialForSamples();

    const allIssues: DiagnosisIssue[] = [];

    allIssues.push(...checkNormals(normals, surfaceMaterial));
    allIssues.push(...checkBoundary(boundaryPoints, boundaryMaterial));
    allIssues.push(...checkSamples(samplePoints, vertices, sampleMaterial));

    setIssues(allIssues);
    setIsChecking(false);

    return allIssues;
  }, [
    normals,
    boundaryPoints,
    samplePoints,
    vertices,
    checkNormals,
    checkBoundary,
    checkSamples,
    setIssues,
    setIsChecking,
  ]);

  const addCustomIssue = useCallback(
    (issue: Omit<DiagnosisIssue, 'id' | 'detectedAt'>) => {
      addIssue({
        ...issue,
        id: generateId('issue_custom'),
        detectedAt: Date.now(),
      });
    },
    [addIssue]
  );

  return {
    runFullCheck,
    checkNormals,
    checkBoundary,
    checkSamples,
    addCustomIssue,
  };
}
