package types

type SchemaType string

const (
	SchemaTypeYAML  SchemaType = "yaml"
	SchemaTypeProto SchemaType = "proto"
)

type FieldType string

const (
	FieldTypeString    FieldType = "string"
	FieldTypeInt32     FieldType = "int32"
	FieldTypeInt64     FieldType = "int64"
	FieldTypeFloat32   FieldType = "float32"
	FieldTypeFloat64   FieldType = "float64"
	FieldTypeBool      FieldType = "bool"
	FieldTypeBytes     FieldType = "bytes"
	FieldTypeEnum      FieldType = "enum"
	FieldTypeMessage   FieldType = "message"
	FieldTypeTimestamp FieldType = "timestamp"
	FieldTypeArray     FieldType = "array"
	FieldTypeObject    FieldType = "object"
	FieldTypeAny       FieldType = "any"
)

type Schema struct {
	Name     string
	Type     SchemaType
	Messages []MessageDefinition
	Enums    []EnumDefinition
}

type MessageDefinition struct {
	Name        string
	Fields      []FieldDefinition
	Description string
}

type FieldDefinition struct {
	Name         string
	Number       int
	Type         FieldType
	IsRequired   bool
	IsRepeated   bool
	IsDeprecated bool
	DefaultValue interface{}
	EnumRef      string
	MessageRef   string
	Description  string
}

type EnumDefinition struct {
	Name        string
	Values      []EnumValue
	Description string
}

type EnumValue struct {
	Name   string
	Number int
}
