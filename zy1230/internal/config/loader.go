package config

import (
	"fmt"
	"os"

	"go-policy-scanner/pkg/model"

	"gopkg.in/yaml.v3"
)

func LoadServicePolicy(path string) (*model.ServicePolicy, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read policy file: %w", err)
	}

	var policy model.ServicePolicy
	if err := yaml.Unmarshal(data, &policy); err != nil {
		return nil, fmt.Errorf("failed to parse policy file: %w", err)
	}

	if err := validatePolicy(&policy); err != nil {
		return nil, err
	}

	return &policy, nil
}

func validatePolicy(policy *model.ServicePolicy) error {
	if policy.ProjectName == "" {
		return fmt.Errorf("project_name is required in policy file")
	}

	if len(policy.Modules) == 0 {
		return fmt.Errorf("at least one module must be defined in policy file")
	}

	for i, module := range policy.Modules {
		if module.Name == "" {
			return fmt.Errorf("module %d: name is required", i)
		}
		if module.Path == "" {
			return fmt.Errorf("module %s: path is required", module.Name)
		}
		if module.Type == "" {
			return fmt.Errorf("module %s: type is required (e.g., service, library, api)", module.Name)
		}
	}

	return nil
}

func DefaultServicePolicy() *model.ServicePolicy {
	return &model.ServicePolicy{
		ProjectName: "default-project",
		Modules: []model.ModuleConfig{
			{
				Name:           "internal",
				Path:           "./internal",
				Type:           "internal",
				AllowedImports: []string{"go-policy-scanner/internal/*"},
			},
			{
				Name:           "pkg",
				Path:           "./pkg",
				Type:           "library",
				AllowedImports: []string{"go-policy-scanner/pkg/*"},
			},
			{
				Name:           "cmd",
				Path:           "./cmd",
				Type:           "service",
				AllowedImports: []string{"go-policy-scanner/internal/*", "go-policy-scanner/pkg/*"},
			},
		},
		CheckRules: model.CheckRules{
			EnableCyclicDepCheck:   true,
			EnableCrossLayerCheck:  true,
			EnableApiSyncCheck:     true,
			EnableMigrationCheck:   true,
			EnableErrorCodeCheck:   true,
			EnableLogFieldCheck:    true,
			MaxAllowedDependencies: 20,
		},
		ErrorCodes: []model.ErrorCodeDef{},
		LogFields:  []model.LogFieldDef{},
	}
}
