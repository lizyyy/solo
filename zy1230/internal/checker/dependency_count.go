package checker

import (
	"fmt"
	"go-policy-scanner/pkg/model"
)

type DependencyCountChecker struct {
	BaseChecker
	moduleInfo       *ModuleInfo
	maxAllowedDeps   int
}

func NewDependencyCountChecker(moduleInfo *ModuleInfo, maxAllowedDeps int) *DependencyCountChecker {
	if maxAllowedDeps <= 0 {
		maxAllowedDeps = 20
	}
	return &DependencyCountChecker{
		moduleInfo:     moduleInfo,
		maxAllowedDeps: maxAllowedDeps,
	}
}

func (c *DependencyCountChecker) Check() ([]model.Violation, error) {
	c.Reset()

	totalDeps := len(c.moduleInfo.Dependencies)
	if totalDeps > c.maxAllowedDeps {
		c.AddViolation(
			"medium",
			fmt.Sprintf("Too many external dependencies: %d (max allowed: %d)",
				totalDeps, c.maxAllowedDeps),
			"go.mod",
			c.formatDependencyList(),
			0,
		)
	}

	for pkgPath, pkgInfo := range c.moduleInfo.Packages {
		if len(pkgInfo.Imports) > 10 {
			c.AddViolation(
				"low",
				fmt.Sprintf("Package %s has %d imports, consider refactoring",
					pkgPath, len(pkgInfo.Imports)),
				"",
				fmt.Sprintf("Imports: %v", pkgInfo.Imports),
				0,
			)
		}
	}

	return c.GetViolations(), nil
}

func (c *DependencyCountChecker) formatDependencyList() string {
	var result string
	for _, dep := range c.moduleInfo.Dependencies {
		indirect := ""
		if dep.Indirect {
			indirect = " (indirect)"
		}
		result += fmt.Sprintf("- %s %s%s\n", dep.ModulePath, dep.Version, indirect)
	}
	return result
}
