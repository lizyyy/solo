package checker

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

type ModuleInfo struct {
	ModulePath   string
	Packages     map[string]*PackageInfo
	Imports      []PackageImport
	Dependencies []Dependency
}

type PackageInfo struct {
	Path       string
	Name       string
	Imports    []string
	Files      []string
}

type PackageImport struct {
	ImportingPath string
	ImportedPath  string
}

type Dependency struct {
	ModulePath string
	Version    string
	Indirect   bool
}

type ModuleScanner struct {
	rootDir string
}

func NewModuleScanner(rootDir string) *ModuleScanner {
	return &ModuleScanner{rootDir: rootDir}
}

func (s *ModuleScanner) Scan() (*ModuleInfo, error) {
	modulePath, err := s.readModulePath()
	if err != nil {
		return nil, fmt.Errorf("failed to read module path: %w", err)
	}

	packages := make(map[string]*PackageInfo)
	allImports := []PackageImport{}

	err = filepath.Walk(s.rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if !info.IsDir() && strings.HasSuffix(path, ".go") && !strings.HasSuffix(path, "_test.go") {
			pkgInfo, err := s.parseGoFile(path)
			if err != nil {
				return fmt.Errorf("failed to parse %s: %w", path, err)
			}

			if pkgInfo != nil {
				if existing, ok := packages[pkgInfo.Path]; ok {
					existing.Imports = mergeImports(existing.Imports, pkgInfo.Imports)
					existing.Files = append(existing.Files, pkgInfo.Files...)
				} else {
					packages[pkgInfo.Path] = pkgInfo
				}

				for _, importedPkg := range pkgInfo.Imports {
					if isInternalImport(importedPkg, modulePath) {
						allImports = append(allImports, PackageImport{
							ImportingPath: pkgInfo.Path,
							ImportedPath:  importedPkg,
						})
					}
				}
			}
		}
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk directory: %w", err)
	}

	dependencies, err := s.readGoModDependencies()
	if err != nil {
		return nil, fmt.Errorf("failed to read go.mod dependencies: %w", err)
	}

	return &ModuleInfo{
		ModulePath:   modulePath,
		Packages:     packages,
		Imports:      allImports,
		Dependencies: dependencies,
	}, nil
}

func (s *ModuleScanner) readModulePath() (string, error) {
	goModPath := filepath.Join(s.rootDir, "go.mod")
	content, err := os.ReadFile(goModPath)
	if err != nil {
		return "", fmt.Errorf("failed to read go.mod: %w", err)
	}

	lines := strings.Split(string(content), "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "module ") {
			return strings.TrimSpace(strings.TrimPrefix(line, "module ")), nil
		}
	}

	return "", fmt.Errorf("module path not found in go.mod")
}

func (s *ModuleScanner) parseGoFile(path string) (*PackageInfo, error) {
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, path, nil, parser.ParseComments)
	if err != nil {
		return nil, nil
	}

	dir := filepath.Dir(path)
	relDir, err := filepath.Rel(s.rootDir, dir)
	if err != nil {
		return nil, fmt.Errorf("failed to get relative path: %w", err)
	}

	modulePath, err := s.readModulePath()
	if err != nil {
		return nil, err
	}

	pkgPath := filepath.ToSlash(relDir)
	if pkgPath != "." {
		pkgPath = modulePath + "/" + pkgPath
	} else {
		pkgPath = modulePath
	}

	imports := []string{}
	for _, imp := range node.Imports {
		if imp.Path != nil {
			importPath := strings.Trim(imp.Path.Value, `"`)
			if !isStandardLibrary(importPath) {
				imports = append(imports, importPath)
			}
		}
	}

	return &PackageInfo{
		Path:    pkgPath,
		Name:    node.Name.Name,
		Imports: imports,
		Files:   []string{path},
	}, nil
}

func (s *ModuleScanner) readGoModDependencies() ([]Dependency, error) {
	goModPath := filepath.Join(s.rootDir, "go.mod")
	content, err := os.ReadFile(goModPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read go.mod: %w", err)
	}

	dependencies := []Dependency{}
	lines := strings.Split(string(content), "\n")

	inRequireBlock := false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if strings.HasPrefix(trimmed, "require (") {
			inRequireBlock = true
			continue
		}
		if inRequireBlock && trimmed == ")" {
			inRequireBlock = false
			continue
		}

		if inRequireBlock && trimmed != "" && !strings.HasPrefix(trimmed, "//") {
			dep := parseDependencyLine(trimmed)
			if dep != nil {
				dependencies = append(dependencies, *dep)
			}
		}
	}

	return dependencies, nil
}

func parseDependencyLine(line string) *Dependency {
	parts := strings.Fields(line)
	if len(parts) < 2 {
		return nil
	}

	dep := &Dependency{
		ModulePath: parts[0],
		Version:    parts[1],
		Indirect:   len(parts) >= 3 && parts[2] == "//indirect",
	}

	return dep
}

func isStandardLibrary(path string) bool {
	parts := strings.Split(path, "/")
	if len(parts) == 0 {
		return false
	}

	firstPart := parts[0]
	if strings.Contains(firstPart, ".") {
		return false
	}

	return true
}

func isInternalImport(importPath, modulePath string) bool {
	return strings.HasPrefix(importPath, modulePath)
}

func mergeImports(a, b []string) []string {
	existing := make(map[string]bool)
	for _, imp := range a {
		existing[imp] = true
	}

	result := append([]string{}, a...)
	for _, imp := range b {
		if !existing[imp] {
			result = append(result, imp)
			existing[imp] = true
		}
	}

	return result
}

var (
	versionPattern = regexp.MustCompile(`^\d+\.\d+\.\d+`)
)
