import type {
  Batch,
  ChecklistItem,
  IssueFlag,
  MaterialSubmission,
  ModelComponent,
  VisaForm,
} from '@/shared/types';
import { validateCoordinate } from './coordinateValidator';

function genItemId(batchId: string, componentId: string) {
  return `${batchId}__${componentId}`;
}

function normalizeStandard(s: string | undefined): string {
  if (!s) return '';
  return s.replace(/\s+/g, '').replace(/[，,]/g, ',').toLowerCase();
}

export function compareConstructionStandard(
  visaStandard: string | undefined,
  materialStandard: string | undefined,
): 'matched' | 'mismatched' {
  const v = normalizeStandard(visaStandard);
  const m = normalizeStandard(materialStandard);
  if (!v || !m) return 'mismatched';
  if (v === m) return 'matched';
  if (v.includes(m) || m.includes(v)) return 'matched';
  return 'mismatched';
}

export interface MatchInput {
  batchId: string;
  components: Record<string, ModelComponent>;
  visaForms: Record<string, VisaForm>;
  materialSubmissions: Record<string, MaterialSubmission>;
}

export function runBatchMatching(input: MatchInput): {
  items: ChecklistItem[];
  issues: IssueFlag[];
} {
  const { batchId, components, visaForms, materialSubmissions } = input;
  const items: ChecklistItem[] = [];
  const issues: IssueFlag[] = [];

  const visaByComponent: Record<string, VisaForm> = {};
  Object.values(visaForms).forEach((v) => {
    visaByComponent[v.componentId] = v;
  });
  const materialByComponent: Record<string, MaterialSubmission> = {};
  Object.values(materialSubmissions).forEach((m) => {
    materialByComponent[m.componentId] = m;
  });

  Object.values(components).forEach((comp) => {
    const itemId = genItemId(batchId, comp.id);
    const visa = visaByComponent[comp.id] || null;
    const material = materialByComponent[comp.id] || null;

    let matchStatus: ChecklistItem['matchStatus'] = 'pending';
    const constructionStandardParts: string[] = [];
    if (visa?.constructionStandard) constructionStandardParts.push(visa.constructionStandard);
    if (material?.constructionStandard) constructionStandardParts.push(material.constructionStandard);
    const constructionStandard = constructionStandardParts.length
      ? constructionStandardParts.join(' | ')
      : '（无口径信息）';

    if (visa && material) {
      const r = compareConstructionStandard(visa.constructionStandard, material.constructionStandard);
      matchStatus = r;
      if (r === 'mismatched') {
        issues.push({
          issueId: `issue-mat-${itemId}`,
          itemId,
          issueType: 'material_mismatch',
          description: `施工口径对不上：签证单写「${visa.constructionStandard || '空'}」，材料送审写「${material.constructionStandard || '空'}」`,
          sourceEvidence: `[签证单 ${visa.visaNo}] ${visa.constructionStandard}  VS  [材料送审 ${material.batchNo}] ${material.constructionStandard}`,
          holdReason: '需与监理确认实际施工层数/规格后再进入最终报告',
          blocksFinalReport: false,
        });
      }
      const coordIssue = validateCoordinate(itemId, visa.rawCoordinates, comp.position);
      if (coordIssue) issues.push(coordIssue);
    }

    items.push({
      itemId,
      batchId,
      componentId: comp.id,
      visaFormId: visa?.visaFormId ?? null,
      materialId: material?.materialId ?? null,
      constructionStandard,
      matchStatus,
      remarks: '',
    });
  });

  return { items, issues };
}

export function resolveBatchStatus(batch: Batch): Batch['status'] {
  const hasBlocking = batch.issues.some((i) => i.blocksFinalReport);
  const hasAnyIssue = batch.issues.length > 0;
  if (hasBlocking) return 'hold';
  if (hasAnyIssue) return 'issue';
  if (batch.items.length === 0) return 'draft';
  return 'normal';
}
