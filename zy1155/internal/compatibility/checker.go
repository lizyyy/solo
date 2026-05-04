package compatibility

import (
	"fmt"
	"math"
	"reflect"
	"strconv"
	"strings"

	"github.com/yourname/pcheck/internal/schema"
	"github.com/yourname/pcheck/pkg/types"
)

type Checker struct {
	OldSchema *types.Schema
	NewSchema *types.Schema
	Rules     *types.Rules
}

func NewChecker(oldSchema, newSchema *types.Schema, rules *types.Rules) *Checker {
	if rules == nil {
		rules = &types.Rules{}
		setDefaultRules(rules)
	}
	return &Checker{
		OldSchema: oldSchema,
		NewSchema: newSchema,
		Rules:     rules,
	}
}

func setDefaultRules(rules *types.Rules) {
	rules.CompatibilityChecks.FieldDeletion = true
	rules.CompatibilityChecks.FieldRenaming = true
	rules.CompatibilityChecks.TypeNarrowing = true
	rules.CompatibilityChecks.RequiredFields = true
	rules.CompatibilityChecks.UnknownFields = true
	rules.CompatibilityChecks.DefaultValueDrift = true
	rules.CompatibilityChecks.EnumExtension = true
	rules.CompatibilityChecks.TimestampPrecision = true
	rules.CompatibilityChecks.RepeatedChange = true
}

func (c *Checker) CheckSchemaCompatibility() *types.IssueCollection {
	collection := &types.IssueCollection{
		Issues:     []types.Issue{},
		ByType:     make(map[types.IssueType][]types.Issue),
		BySeverity: make(map[types.IssueSeverity][]types.Issue),
	}

	for i := range c.OldSchema.Messages {
		oldMsg := &c.OldSchema.Messages[i]
		newMsg := schema.FindMessage(c.NewSchema, oldMsg.Name)

		if newMsg == nil {
			issue := c.createIssue(types.IssueTypeFieldDeleted, types.SeverityCritical,
				fmt.Sprintf("Message '%s' has been removed from the new schema", oldMsg.Name),
				oldMsg.Name, "", "", nil)
			c.addIssue(collection, issue)
			continue
		}

		c.checkMessageFields(collection, oldMsg, newMsg)
	}

	for _, newMsg := range c.NewSchema.Messages {
		oldMsg := schema.FindMessage(c.OldSchema, newMsg.Name)
		if oldMsg == nil {
			issue := c.createIssue(types.IssueTypeUnknownField, types.SeverityInfo,
				fmt.Sprintf("New message '%s' added to schema", newMsg.Name),
				newMsg.Name, "", "", nil)
			c.addIssue(collection, issue)
		}
	}

	c.checkEnums(collection)
	c.calculateStats(collection)

	return collection
}

func (c *Checker) checkMessageFields(collection *types.IssueCollection, oldMsg, newMsg *types.MessageDefinition) {
	oldFields := make(map[string]*types.FieldDefinition)
	for i := range oldMsg.Fields {
		oldFields[oldMsg.Fields[i].Name] = &oldMsg.Fields[i]
	}

	newFields := make(map[string]*types.FieldDefinition)
	for i := range newMsg.Fields {
		newFields[newMsg.Fields[i].Name] = &newMsg.Fields[i]
	}

	for oldFieldName, oldField := range oldFields {
		if c.isFieldIgnored(oldFieldName) {
			continue
		}

		newField, exists := newFields[oldFieldName]

		if !exists {
			if c.Rules.CompatibilityChecks.FieldDeletion {
				issue := c.createIssue(types.IssueTypeFieldDeleted, types.SeverityHigh,
					fmt.Sprintf("Field '%s.%s' has been removed", oldMsg.Name, oldFieldName),
					oldMsg.Name, oldFieldName, "", nil)
				c.addIssue(collection, issue)
			}
			continue
		}

		c.checkFieldType(collection, oldMsg.Name, oldField, newField)
		c.checkRequiredStatus(collection, oldMsg.Name, oldField, newField)
		c.checkRepeatedStatus(collection, oldMsg.Name, oldField, newField)
		c.checkDefaultValues(collection, oldMsg.Name, oldField, newField)
	}

	for newFieldName := range newFields {
		if c.isFieldIgnored(newFieldName) {
			continue
		}

		if _, exists := oldFields[newFieldName]; !exists {
			newField := newFields[newFieldName]
			if newField.IsRequired {
				if c.Rules.CompatibilityChecks.RequiredFields {
					issue := c.createIssue(types.IssueTypeRequiredMissing, types.SeverityCritical,
						fmt.Sprintf("New required field '%s.%s' added - old clients will not provide this",
							oldMsg.Name, newFieldName),
						oldMsg.Name, newFieldName, "", nil)
					c.addIssue(collection, issue)
				}
			}
		}
	}
}

func (c *Checker) checkFieldType(collection *types.IssueCollection, msgName string,
	oldField, newField *types.FieldDefinition) {

	if c.Rules.CompatibilityChecks.TypeNarrowing {
		if c.isTypeNarrowing(oldField.Type, newField.Type) {
			issue := c.createIssue(types.IssueTypeTypeNarrowed, types.SeverityHigh,
				fmt.Sprintf("Field '%s.%s' type narrowed from '%s' to '%s' - may cause data loss",
					msgName, oldField.Name, oldField.Type, newField.Type),
				msgName, oldField.Name, "", map[string]interface{}{
					"old_type": oldField.Type,
					"new_type": newField.Type,
				})
			c.addIssue(collection, issue)
		}

		if oldField.Type != newField.Type && !c.isTypeNarrowing(oldField.Type, newField.Type) {
			if !c.isSafeTypeConversion(oldField.Type, newField.Type) {
				issue := c.createIssue(types.IssueTypeCompatibilityBreak, types.SeverityMedium,
					fmt.Sprintf("Field '%s.%s' type changed from '%s' to '%s' - compatibility risk",
						msgName, oldField.Name, oldField.Type, newField.Type),
					msgName, oldField.Name, "", map[string]interface{}{
						"old_type": oldField.Type,
						"new_type": newField.Type,
					})
				c.addIssue(collection, issue)
			}
		}
	}
}

func (c *Checker) checkRequiredStatus(collection *types.IssueCollection, msgName string,
	oldField, newField *types.FieldDefinition) {

	if c.Rules.CompatibilityChecks.RequiredFields {
		if !oldField.IsRequired && newField.IsRequired {
			issue := c.createIssue(types.IssueTypeRequiredMissing, types.SeverityCritical,
				fmt.Sprintf("Field '%s.%s' changed from optional to required - existing data may be invalid",
					msgName, oldField.Name),
				msgName, oldField.Name, "", nil)
			c.addIssue(collection, issue)
		}
	}
}

func (c *Checker) checkRepeatedStatus(collection *types.IssueCollection, msgName string,
	oldField, newField *types.FieldDefinition) {

	if c.Rules.CompatibilityChecks.RepeatedChange {
		if oldField.IsRepeated != newField.IsRepeated {
			change := "single to repeated"
			severity := types.SeverityMedium
			if oldField.IsRepeated && !newField.IsRepeated {
				change = "repeated to single"
				severity = types.SeverityHigh
			}

			issue := c.createIssue(types.IssueTypeRepeatedChanged, severity,
				fmt.Sprintf("Field '%s.%s' cardinality changed (%s)",
					msgName, oldField.Name, change),
				msgName, oldField.Name, "", map[string]interface{}{
					"old_repeated": oldField.IsRepeated,
					"new_repeated": newField.IsRepeated,
				})
			c.addIssue(collection, issue)
		}
	}
}

func (c *Checker) checkDefaultValues(collection *types.IssueCollection, msgName string,
	oldField, newField *types.FieldDefinition) {

	if c.Rules.CompatibilityChecks.DefaultValueDrift {
		if oldField.DefaultValue != nil && newField.DefaultValue != nil {
			if !reflect.DeepEqual(oldField.DefaultValue, newField.DefaultValue) {
				issue := c.createIssue(types.IssueTypeDefaultValueDrift, types.SeverityMedium,
					fmt.Sprintf("Field '%s.%s' default value changed from '%v' to '%v'",
						msgName, oldField.Name, oldField.DefaultValue, newField.DefaultValue),
					msgName, oldField.Name, "", map[string]interface{}{
						"old_default": oldField.DefaultValue,
						"new_default": newField.DefaultValue,
					})
				c.addIssue(collection, issue)
			}
		}
	}
}

func (c *Checker) checkEnums(collection *types.IssueCollection) {
	if !c.Rules.CompatibilityChecks.EnumExtension {
		return
	}

	for _, oldEnum := range c.OldSchema.Enums {
		newEnum := schema.FindEnum(c.NewSchema, oldEnum.Name)
		if newEnum == nil {
			continue
		}

		oldValues := make(map[int]string)
		for _, v := range oldEnum.Values {
			oldValues[v.Number] = v.Name
		}

		newValues := make(map[int]string)
		for _, v := range newEnum.Values {
			newValues[v.Number] = v.Name
		}

		for num, name := range oldValues {
			if _, exists := newValues[num]; !exists {
				issue := c.createIssue(types.IssueTypeEnumExtended, types.SeverityHigh,
					fmt.Sprintf("Enum '%s' value '%s' (number %d) has been removed",
						oldEnum.Name, name, num),
					"", "", "", map[string]interface{}{
						"enum":   oldEnum.Name,
						"value":  name,
						"number": num,
					})
				c.addIssue(collection, issue)
			}
		}

		for num, name := range newValues {
			if _, exists := oldValues[num]; !exists {
				issue := c.createIssue(types.IssueTypeEnumExtended, types.SeverityMedium,
					fmt.Sprintf("Enum '%s' has new value '%s' (number %d) - old clients may not recognize",
						oldEnum.Name, name, num),
					"", "", "", map[string]interface{}{
						"enum":   oldEnum.Name,
						"value":  name,
						"number": num,
					})
				c.addIssue(collection, issue)
			}
		}
	}
}

func (c *Checker) CheckPayloadAgainstSchema(payload *types.Payload, msg *types.MessageDefinition) *types.IssueCollection {
	collection := &types.IssueCollection{
		Issues:     []types.Issue{},
		ByType:     make(map[types.IssueType][]types.Issue),
		BySeverity: make(map[types.IssueSeverity][]types.Issue),
	}

	data := payload.ParsedData

	for i := range msg.Fields {
		field := &msg.Fields[i]
		if c.isFieldIgnored(field.Name) {
			continue
		}

		value, exists := data[field.Name]

		if !exists {
			if field.IsRequired && c.Rules.CompatibilityChecks.RequiredFields {
				issue := c.createIssue(types.IssueTypeRequiredMissing, types.SeverityHigh,
					fmt.Sprintf("Required field '%s' is missing in payload", field.Name),
					msg.Name, field.Name, payload.ID, nil)
				c.addIssue(collection, issue)
			}
			continue
		}

		c.checkPayloadFieldType(collection, payload, msg, field, value)
		c.checkPayloadEnumValue(collection, payload, msg, field, value)
		c.checkPayloadTimestampPrecision(collection, payload, msg, field, value)
	}

	if c.Rules.CompatibilityChecks.UnknownFields {
		for key := range data {
			if c.isFieldIgnored(key) {
				continue
			}

			found := false
			for _, field := range msg.Fields {
				if field.Name == key {
					found = true
					break
				}
			}
			if !found {
				issue := c.createIssue(types.IssueTypeUnknownField, types.SeverityInfo,
					fmt.Sprintf("Unknown field '%s' in payload - not defined in schema", key),
					msg.Name, key, payload.ID, nil)
				c.addIssue(collection, issue)
			}
		}
	}

	c.calculateStats(collection)
	return collection
}

func (c *Checker) checkPayloadFieldType(collection *types.IssueCollection,
	payload *types.Payload, msg *types.MessageDefinition,
	field *types.FieldDefinition, value interface{}) {

	actualType := c.inferValueType(value)
	expectedType := field.Type

	if !c.isTypeCompatible(expectedType, actualType, value) {
		if c.Rules.CompatibilityChecks.TypeNarrowing {
			issue := c.createIssue(types.IssueTypeTypeNarrowed, types.SeverityHigh,
				fmt.Sprintf("Field '%s' value type mismatch: expected %s, got %s (value: %v)",
					field.Name, expectedType, actualType, value),
				msg.Name, field.Name, payload.ID, map[string]interface{}{
					"expected": expectedType,
					"actual":   actualType,
					"value":    value,
				})
			c.addIssue(collection, issue)
		}
	}
}

func (c *Checker) checkPayloadEnumValue(collection *types.IssueCollection,
	payload *types.Payload, msg *types.MessageDefinition,
	field *types.FieldDefinition, value interface{}) {

	if field.EnumRef == "" || !c.Rules.CompatibilityChecks.EnumExtension {
		return
	}

	enumDef := schema.FindEnum(c.NewSchema, field.EnumRef)
	if enumDef == nil {
		return
	}

	validValues := make(map[interface{}]bool)
	for _, v := range enumDef.Values {
		validValues[v.Name] = true
		validValues[v.Number] = true
	}

	if !validValues[value] {
		issue := c.createIssue(types.IssueTypeEnumExtended, types.SeverityMedium,
			fmt.Sprintf("Field '%s' enum value '%v' is not valid for enum '%s'",
				field.Name, value, field.EnumRef),
			msg.Name, field.Name, payload.ID, map[string]interface{}{
				"enum":          field.EnumRef,
				"invalid_value": value,
			})
		c.addIssue(collection, issue)
	}
}

func (c *Checker) checkPayloadTimestampPrecision(collection *types.IssueCollection,
	payload *types.Payload, msg *types.MessageDefinition,
	field *types.FieldDefinition, value interface{}) {

	if field.Type != types.FieldTypeTimestamp || !c.Rules.CompatibilityChecks.TimestampPrecision {
		return
	}

	var ts int64
	switch v := value.(type) {
	case float64:
		ts = int64(v)
	case int:
		ts = int64(v)
	case int64:
		ts = v
	case string:
		parsed, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return
		}
		ts = parsed
	default:
		return
	}

	currentTs := int64(1746326400)
	if ts > currentTs*1000 {
		issue := c.createIssue(types.IssueTypeTimestampPrecision, types.SeverityMedium,
			fmt.Sprintf("Field '%s' appears to be in milliseconds (%d), but Protobuf uses seconds",
				field.Name, ts),
			msg.Name, field.Name, payload.ID, map[string]interface{}{
				"timestamp": ts,
				"precision": "ms",
			})
		c.addIssue(collection, issue)
	}
}

func (c *Checker) isTypeNarrowing(oldType, newType types.FieldType) bool {
	narrowings := map[types.FieldType][]types.FieldType{
		types.FieldTypeInt64:   {types.FieldTypeInt32},
		types.FieldTypeFloat64: {types.FieldTypeFloat32},
		types.FieldTypeString:  {},
		types.FieldTypeAny: {types.FieldTypeString, types.FieldTypeInt32, types.FieldTypeInt64,
			types.FieldTypeFloat32, types.FieldTypeFloat64, types.FieldTypeBool},
	}

	if narrowTo, exists := narrowings[oldType]; exists {
		for _, t := range narrowTo {
			if t == newType {
				return true
			}
		}
	}
	return false
}

func (c *Checker) isSafeTypeConversion(oldType, newType types.FieldType) bool {
	safeConversions := map[types.FieldType][]types.FieldType{
		types.FieldTypeInt32:   {types.FieldTypeInt64, types.FieldTypeFloat64},
		types.FieldTypeFloat32: {types.FieldTypeFloat64},
		types.FieldTypeInt64:   {types.FieldTypeFloat64},
	}

	if safeTo, exists := safeConversions[oldType]; exists {
		for _, t := range safeTo {
			if t == newType {
				return true
			}
		}
	}
	return oldType == newType
}

func (c *Checker) inferValueType(value interface{}) types.FieldType {
	switch v := value.(type) {
	case string:
		return types.FieldTypeString
	case int, int32, int64:
		return types.FieldTypeInt64
	case float32:
		if math.Trunc(float64(v)) == float64(v) {
			return types.FieldTypeInt64
		}
		return types.FieldTypeFloat32
	case float64:
		if math.Trunc(v) == v {
			return types.FieldTypeInt64
		}
		return types.FieldTypeFloat64
	case bool:
		return types.FieldTypeBool
	case []interface{}:
		return types.FieldTypeArray
	case map[string]interface{}:
		return types.FieldTypeObject
	default:
		return types.FieldTypeAny
	}
}

func (c *Checker) isTypeCompatible(expected types.FieldType, actual types.FieldType, value interface{}) bool {
	if expected == actual {
		return true
	}

	if expected == types.FieldTypeAny {
		return true
	}

	compatible := map[types.FieldType][]types.FieldType{
		types.FieldTypeInt64:   {types.FieldTypeInt32},
		types.FieldTypeFloat64: {types.FieldTypeInt32, types.FieldTypeInt64, types.FieldTypeFloat32},
		types.FieldTypeString:  {},
	}

	if actualTypes, exists := compatible[expected]; exists {
		for _, t := range actualTypes {
			if t == actual {
				return true
			}
		}
	}

	return false
}

func (c *Checker) isFieldIgnored(fieldName string) bool {
	for _, ignored := range c.Rules.IgnoredFields {
		if strings.EqualFold(ignored, fieldName) {
			return true
		}
	}
	return false
}

func (c *Checker) createIssue(issueType types.IssueType, severity types.IssueSeverity,
	message, msgType, fieldName, payloadID string, details map[string]interface{}) types.Issue {

	return types.Issue{
		Type:        issueType,
		Severity:    severity,
		Message:     message,
		MessageType: msgType,
		FieldName:   fieldName,
		PayloadID:   payloadID,
		Details:     details,
	}
}

func (c *Checker) addIssue(collection *types.IssueCollection, issue types.Issue) {
	collection.Issues = append(collection.Issues, issue)
	collection.ByType[issue.Type] = append(collection.ByType[issue.Type], issue)
	collection.BySeverity[issue.Severity] = append(collection.BySeverity[issue.Severity], issue)
}

func (c *Checker) calculateStats(collection *types.IssueCollection) {
	collection.TotalCount = len(collection.Issues)
	collection.CriticalCount = len(collection.BySeverity[types.SeverityCritical])
	collection.HighCount = len(collection.BySeverity[types.SeverityHigh])
	collection.MediumCount = len(collection.BySeverity[types.SeverityMedium])
	collection.LowCount = len(collection.BySeverity[types.SeverityLow])
	collection.InfoCount = len(collection.BySeverity[types.SeverityInfo])
}
