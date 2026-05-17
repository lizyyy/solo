package parser

type ProtoFile struct {
	FilePath    string      `json:"file_path"`
	Messages    []Message   `json:"messages"`
	Enums       []Enum      `json:"enums"`
	Services    []Service   `json:"services"`
	Imports     []string    `json:"imports"`
	PackageName string      `json:"package_name"`
	Syntax      string      `json:"syntax"`
	Errors      []ParseError `json:"errors"`
}

type Message struct {
	Name   string  `json:"name"`
	Line   int     `json:"line"`
	Fields []Field `json:"fields"`
}

type Field struct {
	Name         string      `json:"name"`
	Line         int         `json:"line"`
	Type         string      `json:"type"`
	Number       int         `json:"number"`
	Label        string      `json:"label"`
	DefaultValue interface{} `json:"default_value"`
	IsExplicit   bool        `json:"is_explicit"`
	Options      []string    `json:"options"`
	RiskLevel    string      `json:"risk_level"`
	RiskReason   string      `json:"risk_reason"`
}

type Enum struct {
	Name   string      `json:"name"`
	Line   int         `json:"line"`
	Values []EnumValue `json:"values"`
}

type EnumValue struct {
	Name   string `json:"name"`
	Line   int    `json:"line"`
	Number int    `json:"number"`
}

type Service struct {
	Name    string   `json:"name"`
	Line    int      `json:"line"`
	Methods []Method `json:"methods"`
}

type Method struct {
	Name         string `json:"name"`
	Line         int    `json:"line"`
	InputType    string `json:"input_type"`
	OutputType   string `json:"output_type"`
	ClientStream bool   `json:"client_stream"`
	ServerStream bool   `json:"server_stream"`
}

type ParseError struct {
	FilePath string `json:"file_path"`
	Line     int    `json:"line"`
	Message  string `json:"message"`
	RawLine  string `json:"raw_line"`
}

type RiskLevel string

const (
	RiskHigh   RiskLevel = "HIGH"
	RiskMedium RiskLevel = "MEDIUM"
	RiskLow    RiskLevel = "LOW"
)

var Proto3Defaults = map[string]interface{}{
	"double":   0.0,
	"float":    0.0,
	"int32":    0,
	"int64":    0,
	"uint32":   0,
	"uint64":   0,
	"sint32":   0,
	"sint64":   0,
	"fixed32":  0,
	"fixed64":  0,
	"sfixed32": 0,
	"sfixed64": 0,
	"bool":     false,
	"string":   "",
	"bytes":    []byte{},
}
