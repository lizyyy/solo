package models

type Workspace struct {
	Root         string                 `json:"root"`
	Config       WorkspaceConfig        `json:"config"`
	Services     map[string]Service     `json:"services"`
	CallEdges    []CallEdge             `json:"call_edges"`
	Owners       map[string]Owner       `json:"owners"`
	Policies     []Policy               `json:"policies"`
	DeployPlan   *DeployPlan            `json:"deploy_plan,omitempty"`
	OpenAPISpecs map[string]OpenAPISpec `json:"openapi_specs"`
}

type WorkspaceConfig struct {
	Version     string            `yaml:"version" json:"version"`
	Name        string            `yaml:"name" json:"name"`
	Description string            `yaml:"description" json:"description"`
	CreatedAt   string            `yaml:"created_at" json:"created_at"`
	LastUpdated string            `yaml:"last_updated" json:"last_updated"`
	Metadata    map[string]string `yaml:"metadata" json:"metadata"`
}

type OpenAPISpec struct {
	FilePath string
	Spec     map[string]interface{}
}

type ImportConfig struct {
	ServicesPath   string
	OpenAPIDir     string
	CallEdgesPath  string
	OwnersPath     string
	PoliciesPath   string
	DeployPlanPath string
}
