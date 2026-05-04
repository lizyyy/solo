package schema

import (
	"path/filepath"
	"strings"

	"github.com/yourname/pcheck/pkg/types"
)

func ParseSchemaFile(filePath string) (*types.Schema, error) {
	ext := strings.ToLower(filepath.Ext(filePath))
	
	switch ext {
	case ".yaml", ".yml":
		yamlSchema, err := ParseYAMLFile(filePath)
		if err != nil {
			return nil, err
		}
		return convertYAMLToSchema(yamlSchema), nil
	case ".proto":
		protoSchema, err := ParseProtoFile(filePath)
		if err != nil {
			return nil, err
		}
		return convertProtoToSchema(protoSchema), nil
	default:
		yamlSchema, err := ParseYAMLFile(filePath)
		if err == nil {
			return convertYAMLToSchema(yamlSchema), nil
		}
		protoSchema, err := ParseProtoFile(filePath)
		if err == nil {
			return convertProtoToSchema(protoSchema), nil
		}
		return nil, err
	}
}

func convertYAMLToSchema(yamlSchema *YAMLSchema) *types.Schema {
	schema := &types.Schema{
		Name:     yamlSchema.Name,
		Type:     types.SchemaTypeYAML,
		Messages: make([]types.MessageDefinition, 0, len(yamlSchema.Messages)),
		Enums:    make([]types.EnumDefinition, 0, len(yamlSchema.Enums)),
	}

	for _, msg := range yamlSchema.Messages {
		message := types.MessageDefinition{
			Name:        msg.Name,
			Description: msg.Description,
			Fields:      make([]types.FieldDefinition, 0, len(msg.Fields)),
		}
		for _, field := range msg.Fields {
			message.Fields = append(message.Fields, types.FieldDefinition{
				Name:         field.Name,
				Number:       field.Number,
				Type:         convertFieldType(field.Type),
				IsRequired:   field.Required,
				IsRepeated:   field.Repeated,
				IsDeprecated: field.Deprecated,
				DefaultValue: field.Default,
				EnumRef:      field.EnumRef,
				MessageRef:   field.MessageRef,
				Description:  field.Description,
			})
		}
		schema.Messages = append(schema.Messages, message)
	}

	for _, enum := range yamlSchema.Enums {
		enumDef := types.EnumDefinition{
			Name:        enum.Name,
			Description: enum.Description,
			Values:      make([]types.EnumValue, 0, len(enum.Values)),
		}
		for _, val := range enum.Values {
			enumDef.Values = append(enumDef.Values, types.EnumValue{
				Name:   val.Name,
				Number: val.Number,
			})
		}
		schema.Enums = append(schema.Enums, enumDef)
	}

	return schema
}

func convertProtoToSchema(protoSchema *ProtoSchema) *types.Schema {
	schema := &types.Schema{
		Name:     protoSchema.Package,
		Type:     types.SchemaTypeProto,
		Messages: make([]types.MessageDefinition, 0, len(protoSchema.Messages)),
		Enums:    make([]types.EnumDefinition, 0, len(protoSchema.Enums)),
	}

	for _, msg := range protoSchema.Messages {
		message := types.MessageDefinition{
			Name:   msg.Name,
			Fields: make([]types.FieldDefinition, 0, len(msg.Fields)),
		}
		for _, field := range msg.Fields {
			fieldType := convertProtoFieldType(field.Type)
			message.Fields = append(message.Fields, types.FieldDefinition{
				Name:       field.Name,
				Number:     field.Number,
				Type:       fieldType,
				IsRequired: field.Label == "required",
				IsRepeated: field.IsRepeated,
				EnumRef:    "",
				MessageRef: "",
			})
		}
		schema.Messages = append(schema.Messages, message)
	}

	for _, enum := range protoSchema.Enums {
		enumDef := types.EnumDefinition{
			Name:   enum.Name,
			Values: make([]types.EnumValue, 0, len(enum.Values)),
		}
		for _, val := range enum.Values {
			enumDef.Values = append(enumDef.Values, types.EnumValue{
				Name:   val.Name,
				Number: val.Number,
			})
		}
		schema.Enums = append(schema.Enums, enumDef)
	}

	return schema
}

func convertFieldType(t string) types.FieldType {
	switch strings.ToLower(t) {
	case "string":
		return types.FieldTypeString
	case "int32", "int":
		return types.FieldTypeInt32
	case "int64":
		return types.FieldTypeInt64
	case "float32", "float":
		return types.FieldTypeFloat32
	case "float64", "double":
		return types.FieldTypeFloat64
	case "bool", "boolean":
		return types.FieldTypeBool
	case "bytes":
		return types.FieldTypeBytes
	case "enum":
		return types.FieldTypeEnum
	case "message", "object":
		return types.FieldTypeMessage
	case "timestamp", "time":
		return types.FieldTypeTimestamp
	case "array", "list":
		return types.FieldTypeArray
	default:
		return types.FieldTypeAny
	}
}

func convertProtoFieldType(t string) types.FieldType {
	switch t {
	case "string":
		return types.FieldTypeString
	case "int32", "sint32", "sfixed32":
		return types.FieldTypeInt32
	case "int64", "sint64", "sfixed64":
		return types.FieldTypeInt64
	case "uint32", "fixed32":
		return types.FieldTypeInt32
	case "uint64", "fixed64":
		return types.FieldTypeInt64
	case "float":
		return types.FieldTypeFloat32
	case "double":
		return types.FieldTypeFloat64
	case "bool":
		return types.FieldTypeBool
	case "bytes":
		return types.FieldTypeBytes
	default:
		return types.FieldTypeAny
	}
}

func FindMessage(schema *types.Schema, messageName string) *types.MessageDefinition {
	for i := range schema.Messages {
		if schema.Messages[i].Name == messageName {
			return &schema.Messages[i]
		}
	}
	return nil
}

func FindEnum(schema *types.Schema, enumName string) *types.EnumDefinition {
	for i := range schema.Enums {
		if schema.Enums[i].Name == enumName {
			return &schema.Enums[i]
		}
	}
	return nil
}

func FindField(msg *types.MessageDefinition, fieldName string) *types.FieldDefinition {
	for i := range msg.Fields {
		if msg.Fields[i].Name == fieldName {
			return &msg.Fields[i]
		}
	}
	return nil
}
