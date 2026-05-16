package utils

import (
	"contract-drift-api/models"
	"encoding/json"
	"fmt"
	"reflect"
)

type DriftDetector struct {
}

func NewDriftDetector() *DriftDetector {
	return &DriftDetector{}
}

func (d *DriftDetector) AnalyzeSample(sample *models.Sample, contract *models.Contract) (*models.DriftAnalysisResult, error) {
	result := &models.DriftAnalysisResult{
		HasDrift:   false,
		DriftCount: 0,
	}

	var schema map[string]interface{}
	if err := json.Unmarshal(contract.Schema, &schema); err != nil {
		return nil, fmt.Errorf("invalid schema: %v", err)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(sample.Payload, &payload); err != nil {
		return nil, fmt.Errorf("invalid payload: %v", err)
	}

	drifts, err := d.compareObject("", schema, payload, sample.ID, contract.ID)
	if err != nil {
		return nil, err
	}

	result.DriftRecords = drifts
	result.DriftCount = len(drifts)
	result.HasDrift = result.DriftCount > 0

	return result, nil
}

func (d *DriftDetector) compareObject(path string, schema, payload map[string]interface{}, sampleID, contractID int64) ([]models.DriftRecord, error) {
	var drifts []models.DriftRecord

	schemaProps, ok := schema["properties"].(map[string]interface{})
	if !ok {
		schemaProps = schema
	}

	requiredFields, _ := schema["required"].([]interface{})
	requiredMap := make(map[string]bool)
	for _, f := range requiredFields {
		requiredMap[f.(string)] = true
	}

	for fieldName, schemaProp := range schemaProps {
		schemaMap, ok := schemaProp.(map[string]interface{})
		if !ok {
			continue
		}

		fullPath := fieldName
		if path != "" {
			fullPath = path + "." + fieldName
		}

		actualValue, exists := payload[fieldName]

		if requiredMap[fieldName] && !exists {
			drifts = append(drifts, models.DriftRecord{
				SampleID:      sampleID,
				ContractID:    contractID,
				FieldPath:     fullPath,
				DriftType:     "missing_required_field",
				ExpectedValue: json.RawMessage(`"present"`),
				ActualValue:   json.RawMessage(`"missing"`),
				Severity:      "high",
			})
			continue
		}

		if !exists {
			continue
		}

		expectedType, _ := schemaMap["type"].(string)
		actualType := getJSONType(actualValue)

		if expectedType != "" && expectedType != actualType {
			expectedJSON, _ := json.Marshal(expectedType)
			actualJSON, _ := json.Marshal(actualType)
			drifts = append(drifts, models.DriftRecord{
				SampleID:      sampleID,
				ContractID:    contractID,
				FieldPath:     fullPath,
				DriftType:     "type_mismatch",
				ExpectedValue: expectedJSON,
				ActualValue:   actualJSON,
				Severity:      "high",
			})
			continue
		}

		if expectedType == "object" {
			nestedSchema, _ := schemaMap["properties"].(map[string]interface{})
			nestedPayload, ok := actualValue.(map[string]interface{})
			if ok {
				wrapperSchema := map[string]interface{}{
					"properties": nestedSchema,
					"required":   schemaMap["required"],
				}
				nestedDrifts, err := d.compareObject(fullPath, wrapperSchema, nestedPayload, sampleID, contractID)
				if err != nil {
					return nil, err
				}
				drifts = append(drifts, nestedDrifts...)
			}
		}

		if expectedType == "array" {
			itemsSchema, hasItems := schemaMap["items"].(map[string]interface{})
			actualArray, ok := actualValue.([]interface{})
			if hasItems && ok {
				for idx, item := range actualArray {
					itemPath := fmt.Sprintf("%s[%d]", fullPath, idx)
					itemType := getJSONType(item)
					itemsType, _ := itemsSchema["type"].(string)
					if itemsType != "" && itemType != itemsType {
						expectedJSON, _ := json.Marshal(itemsType)
						actualJSON, _ := json.Marshal(itemType)
						drifts = append(drifts, models.DriftRecord{
							SampleID:      sampleID,
							ContractID:    contractID,
							FieldPath:     itemPath,
							DriftType:     "array_item_type_mismatch",
							ExpectedValue: expectedJSON,
							ActualValue:   actualJSON,
							Severity:      "medium",
						})
					}
				}
			}
		}

		if enumValues, ok := schemaMap["enum"].([]interface{}); ok {
			found := false
			for _, enumVal := range enumValues {
				if reflect.DeepEqual(actualValue, enumVal) {
					found = true
					break
				}
			}
			if !found {
				expectedJSON, _ := json.Marshal(enumValues)
				actualJSON, _ := json.Marshal(actualValue)
				drifts = append(drifts, models.DriftRecord{
					SampleID:      sampleID,
					ContractID:    contractID,
					FieldPath:     fullPath,
					DriftType:     "enum_value_violation",
					ExpectedValue: expectedJSON,
					ActualValue:   actualJSON,
					Severity:      "high",
				})
			}
		}
	}

	for fieldName := range payload {
		if _, existsInSchema := schemaProps[fieldName]; !existsInSchema {
			fullPath := fieldName
			if path != "" {
				fullPath = path + "." + fieldName
			}
			actualJSON, _ := json.Marshal(payload[fieldName])
			drifts = append(drifts, models.DriftRecord{
				SampleID:      sampleID,
				ContractID:    contractID,
				FieldPath:     fullPath,
				DriftType:     "extra_field",
				ExpectedValue: json.RawMessage(`"not_expected"`),
				ActualValue:   actualJSON,
				Severity:      "medium",
			})
		}
	}

	return drifts, nil
}

func getJSONType(v interface{}) string {
	switch v.(type) {
	case string:
		return "string"
	case float64:
		return "number"
	case bool:
		return "boolean"
	case nil:
		return "null"
	case map[string]interface{}:
		return "object"
	case []interface{}:
		return "array"
	default:
		return "unknown"
	}
}

func GenerateDriftReport(contract *models.Contract, samples []models.Sample, drifts []models.DriftRecord) *models.DriftReport {
	report := &models.DriftReport{
		ContractID:      contract.ID,
		ContractName:    contract.Name,
		ContractVersion: contract.Version,
		TotalSamples:    len(samples),
	}

	driftedSampleMap := make(map[int64]bool)
	fieldDriftMap := make(map[string]*models.FieldDrift)

	for _, drift := range drifts {
		driftedSampleMap[drift.SampleID] = true
		if fd, ok := fieldDriftMap[drift.FieldPath]; ok {
			fd.DriftCount++
		} else {
			fieldDriftMap[drift.FieldPath] = &models.FieldDrift{
				FieldPath:   drift.FieldPath,
				DriftCount:  1,
				LastDriftAt: drift.DetectedAt.Format("2006-01-02 15:04:05"),
			}
		}
	}

	report.DriftedSamples = len(driftedSampleMap)
	for _, fd := range fieldDriftMap {
		report.FieldDrifts = append(report.FieldDrifts, *fd)
	}

	return report
}
