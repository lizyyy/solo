import type { CounterExample, ConflictEvidence, CounterExampleStatus, QuestionnaireRow } from "../types"

export function compareWithQuestionnaire(
  counterExample: CounterExample,
  questionnaireRow: QuestionnaireRow
): ConflictEvidence | null {
  const conflictingFields: string[] = []

  const qOriginal = questionnaireRow.fields["originalValue"]
  const qThreshold = questionnaireRow.fields["threshold"]

  if (qOriginal !== undefined && Number(qOriginal) !== counterExample.originalValue) {
    conflictingFields.push("originalValue")
  }

  if (qThreshold !== undefined && Number(qThreshold) !== counterExample.threshold) {
    conflictingFields.push("threshold")
  }

  if (conflictingFields.length === 0) {
    return null
  }

  return {
    counterExampleId: counterExample.id,
    counterExampleValue: counterExample.originalValue,
    questionnaireValue: typeof qOriginal === "number" ? qOriginal : Number(qOriginal),
    conflictingFields,
  }
}

export function determineStatus(originalValue: number, threshold: number): CounterExampleStatus {
  const deviation = originalValue - threshold
  if (deviation === 0) return "boundary"
  if (deviation < 0) return "normal"
  return "conflict"
}

export function generateConflictEvidences(
  counterExamples: CounterExample[],
  questionnaireRows: QuestionnaireRow[]
): ConflictEvidence[] {
  const evidences: ConflictEvidence[] = []

  for (const ce of counterExamples) {
    if (!ce.questionnaireRowId) continue
    const row = questionnaireRows.find(r => r.id === ce.questionnaireRowId)
    if (!row) continue
    const evidence = compareWithQuestionnaire(ce, row)
    if (evidence) {
      evidences.push(evidence)
    }
  }

  return evidences
}
