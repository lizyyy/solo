package models

type Service struct {
	Name            string            `yaml:"name" json:"name"`
	Version         string            `yaml:"version" json:"version"`
	Description     string            `yaml:"description" json:"description"`
	Language        string            `yaml:"language" json:"language"`
	Repository      string            `yaml:"repository" json:"repository"`
	OpenAPISpec     string            `yaml:"openapi_spec" json:"openapi_spec"`
	Endpoints       []Endpoint        `yaml:"endpoints" json:"endpoints"`
	Tags            []string          `yaml:"tags" json:"tags"`
	Metadata        map[string]string `yaml:"metadata" json:"metadata"`
	ContractVersion string            `yaml:"contract_version" json:"contract_version"`
}

type Endpoint struct {
	Method      string       `yaml:"method" json:"method"`
	Path        string       `yaml:"path" json:"path"`
	Summary     string       `yaml:"summary" json:"summary"`
	OperationID string       `yaml:"operation_id" json:"operation_id"`
	Deprecated  bool         `yaml:"deprecated" json:"deprecated"`
	Parameters  []Parameter  `yaml:"parameters" json:"parameters"`
	RequestBody *RequestBody `yaml:"request_body" json:"request_body"`
	Responses   []Response   `yaml:"responses" json:"responses"`
	Tags        []string     `yaml:"tags" json:"tags"`
}

type Parameter struct {
	Name        string `yaml:"name" json:"name"`
	In          string `yaml:"in" json:"in"`
	Required    bool   `yaml:"required" json:"required"`
	Schema      Schema `yaml:"schema" json:"schema"`
	Description string `yaml:"description" json:"description"`
}

type RequestBody struct {
	Required bool              `yaml:"required" json:"required"`
	Content  map[string]Schema `yaml:"content" json:"content"`
}

type Response struct {
	StatusCode  string            `yaml:"status_code" json:"status_code"`
	Description string            `yaml:"description" json:"description"`
	Content     map[string]Schema `yaml:"content" json:"content"`
}

type Schema struct {
	Type       string            `yaml:"type" json:"type"`
	Format     string            `yaml:"format,omitempty" json:"format,omitempty"`
	Required   []string          `yaml:"required,omitempty" json:"required,omitempty"`
	Properties map[string]Schema `yaml:"properties,omitempty" json:"properties,omitempty"`
	Items      *Schema           `yaml:"items,omitempty" json:"items,omitempty"`
	Enum       []string          `yaml:"enum,omitempty" json:"enum,omitempty"`
	MinLength  *int              `yaml:"min_length,omitempty" json:"min_length,omitempty"`
	MaxLength  *int              `yaml:"max_length,omitempty" json:"max_length,omitempty"`
	Minimum    *float64          `yaml:"minimum,omitempty" json:"minimum,omitempty"`
	Maximum    *float64          `yaml:"maximum,omitempty" json:"maximum,omitempty"`
}
