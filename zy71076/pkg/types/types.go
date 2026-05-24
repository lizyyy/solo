package types

import (
	"encoding/json"
	"fmt"
)

type VariableSource string

const (
	SourceDefault     VariableSource = "default"
	SourceTFVars      VariableSource = "tfvars"
	SourceEnvVar      VariableSource = "environment"
	SourceModuleInput VariableSource = "module_input"
	SourceCLI         VariableSource = "cli"
	SourceUnknown     VariableSource = "unknown"
)

type VariableType string

const (
	TypeString  VariableType = "string"
	TypeNumber  VariableType = "number"
	TypeBool    VariableType = "bool"
	TypeList    VariableType = "list"
	TypeMap     VariableType = "map"
	TypeObject  VariableType = "object"
	TypeTuple   VariableType = "tuple"
	TypeSet     VariableType = "set"
	TypeUnknown VariableType = "unknown"
)

type VariableDefinition struct {
	Name        string
	Type        VariableType
	Description string
	Default     interface{}
	Sensitive   bool
	Nullable    bool
	SourceFile  string
	LineNumber  int
}

type VariableValue struct {
	Value       interface{}
	MaskedValue string
	Source      VariableSource
	SourceFile  string
	SourceType  string
	Priority    int
}

func (vv *VariableValue) GetDisplayValue(mask bool) interface{} {
	if mask && vv.MaskedValue != "" {
		return vv.MaskedValue
	}
	return vv.Value
}

type ResolvedVariable struct {
	Name             string
	Type             VariableType
	Sensitive        bool
	EffectiveValue   interface{}
	MaskedValue      string
	ValueSources     []VariableValue
	ActiveSource     VariableSource
	ActiveSourceFile string
	Conflicts        []Conflict
	ModulePath       string
}

type Conflict struct {
	Type        string
	Description string
	Sources     []string
	Severity    string
}

type Module struct {
	Name           string
	Source         string
	Path           string
	Variables      map[string]*ResolvedVariable
	SubModules     map[string]*Module
	VariableInputs map[string]interface{}
	SourceFile     string
}

type AnalysisResult struct {
	RootModule      *Module
	AllVariables    map[string]*ResolvedVariable
	TotalVariables  int
	SensitiveCount  int
	Conflicts       []Conflict
	Summary         Summary
	EnvironmentVars map[string]string
	TFVarsFiles     []string
}

type Summary struct {
	TotalVariables     int
	DefaultValues      int
	TFVarsValues       int
	EnvVarValues       int
	ModuleInputValues  int
	SensitiveVariables int
	Conflicts          int
	ModulesCount       int
}

type OutputConfig struct {
	OutputDir      string
	FormatJSON     bool
	FormatMarkdown bool
	FormatConsole  bool
	MaskSensitive  bool
	Verbose        bool
}

const (
	ExitSuccess         = 0
	ExitValidationError = 1
	ExitParseError      = 2
	ExitConflict        = 3
	ExitInternalError   = 10
)

func (s VariableSource) String() string {
	return string(s)
}

func (t VariableType) String() string {
	return string(t)
}

func (v *ResolvedVariable) MarshalJSON() ([]byte, error) {
	type Alias ResolvedVariable
	displayValue := v.EffectiveValue
	if v.Sensitive {
		displayValue = v.MaskedValue
	}
	return json.Marshal(&struct {
		*Alias
		DisplayValue interface{} `json:"display_value"`
	}{
		Alias:        (*Alias)(v),
		DisplayValue: displayValue,
	})
}

func (c *Conflict) String() string {
	return fmt.Sprintf("[%s] %s (sources: %v)", c.Severity, c.Description, c.Sources)
}
