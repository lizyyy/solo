package models

type DeployPlan struct {
	Title        string        `yaml:"title" json:"title"`
	Description  string        `yaml:"description" json:"description"`
	Date         string        `yaml:"date" json:"date"`
	Batches      []DeployBatch `yaml:"batches" json:"batches"`
	RollbackPlan RollbackPlan  `yaml:"rollback_plan" json:"rollback_plan"`
}

type DeployBatch struct {
	Name          string   `yaml:"name" json:"name"`
	Order         int      `yaml:"order" json:"order"`
	Services      []string `yaml:"services" json:"services"`
	DelayMinutes  int      `yaml:"delay_minutes" json:"delay_minutes"`
	PreChecks     []string `yaml:"pre_checks,omitempty" json:"pre_checks,omitempty"`
	PostChecks    []string `yaml:"post_checks,omitempty" json:"post_checks,omitempty"`
	Canary        bool     `yaml:"canary" json:"canary"`
	CanaryPercent int      `yaml:"canary_percent,omitempty" json:"canary_percent,omitempty"`
}

type RollbackPlan struct {
	Strategy    string   `yaml:"strategy" json:"strategy"`
	MaxRetries  int      `yaml:"max_retries" json:"max_retries"`
	Checkpoints []string `yaml:"checkpoints" json:"checkpoints"`
}
