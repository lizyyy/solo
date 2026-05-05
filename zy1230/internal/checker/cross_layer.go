package checker

import (
	"fmt"
	"go-policy-scanner/pkg/model"
	"path/filepath"
	"regexp"
	"strings"
)

type CrossLayerChecker struct {
	BaseChecker
	moduleInfo *ModuleInfo
	policy     *model.ServicePolicy
}

func NewCrossLayerChecker(moduleInfo *ModuleInfo, policy *model.ServicePolicy) *CrossLayerChecker {
	return &CrossLayerChecker{
		moduleInfo: moduleInfo,
		policy:     policy,
	}
}

func (c *CrossLayerChecker) Check() ([]model.Violation, error) {
	c.Reset()

	for _, imp := range c.moduleInfo.Imports {
		if c.isCrossLayerViolation(imp) {
			c.AddViolation(
				"high",
				fmt.Sprintf("Cross-layer violation: %s imports %s", imp.ImportingPath, imp.ImportedPath),
				"",
				fmt.Sprintf("Package %s is not allowed to import %s according to policy",
					imp.ImportingPath, imp.ImportedPath),
				0,
			)
		}
	}

	return c.GetViolations(), nil
}

func (c *CrossLayerChecker) isCrossLayerViolation(imp PackageImport) bool {
	importingModule := c.findModuleForPackage(imp.ImportingPath)
	importedModule := c.findModuleForPackage(imp.ImportedPath)

	if importingModule == nil {
		return false
	}

	if importedModule == nil {
		return false
	}

	return !c.isAllowedImport(importingModule, importedModule)
}

func (c *CrossLayerChecker) findModuleForPackage(pkgPath string) *model.ModuleConfig {
	relativePath := strings.TrimPrefix(pkgPath, c.moduleInfo.ModulePath)
	relativePath = strings.TrimPrefix(relativePath, "/")

	for i := range c.policy.Modules {
		module := &c.policy.Modules[i]
		modulePath := strings.TrimPrefix(module.Path, "./")
		modulePath = strings.TrimPrefix(modulePath, "/")

		if strings.HasPrefix(relativePath, modulePath) {
			return module
		}

		if relativePath == "" && modulePath == "." {
			return module
		}
	}

	return nil
}

func (c *CrossLayerChecker) isAllowedImport(importingModule, importedModule *model.ModuleConfig) bool {
	if importingModule.Name == importedModule.Name {
		return true
	}

	for _, allowedPattern := range importingModule.AllowedImports {
		if c.matchesPattern(allowedPattern, importedModule.Path) {
			return true
		}
	}

	return false
}

func (c *CrossLayerChecker) matchesPattern(pattern, path string) bool {
	pattern = filepath.ToSlash(pattern)
	path = filepath.ToSlash(path)

	pattern = strings.TrimPrefix(pattern, "./")
	pattern = strings.TrimPrefix(pattern, "/")
	path = strings.TrimPrefix(path, "./")
	path = strings.TrimPrefix(path, "/")

	if pattern == path {
		return true
	}

	if strings.Contains(pattern, "*") {
		regexPattern := strings.ReplaceAll(pattern, ".", "\\.")
		regexPattern = strings.ReplaceAll(regexPattern, "*", ".*")
		regexPattern = "^" + regexPattern + "$"

		matched, err := regexp.MatchString(regexPattern, path)
		if err == nil && matched {
			return true
		}
	}

	return false
}
