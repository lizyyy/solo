package checker

import (
	"fmt"
	"go-policy-scanner/pkg/model"
	"strings"
)

type CyclicDependencyChecker struct {
	BaseChecker
	moduleInfo *ModuleInfo
}

func NewCyclicDependencyChecker(moduleInfo *ModuleInfo) *CyclicDependencyChecker {
	return &CyclicDependencyChecker{
		moduleInfo: moduleInfo,
	}
}

func (c *CyclicDependencyChecker) Check() ([]model.Violation, error) {
	c.Reset()

	adjacency := c.buildAdjacencyList()
	visited := make(map[string]bool)
	recStack := make(map[string]bool)
	path := []string{}

	for pkg := range adjacency {
		if !visited[pkg] {
			if c.hasCycle(pkg, adjacency, visited, recStack, path) {
				return c.GetViolations(), nil
			}
		}
	}

	return c.GetViolations(), nil
}

func (c *CyclicDependencyChecker) buildAdjacencyList() map[string][]string {
	adjacency := make(map[string][]string)

	for pkg := range c.moduleInfo.Packages {
		adjacency[pkg] = []string{}
	}

	for _, imp := range c.moduleInfo.Imports {
		adjacency[imp.ImportingPath] = append(adjacency[imp.ImportingPath], imp.ImportedPath)
	}

	return adjacency
}

func (c *CyclicDependencyChecker) hasCycle(
	pkg string,
	adjacency map[string][]string,
	visited, recStack map[string]bool,
	path []string,
) bool {
	if recStack[pkg] {
		cyclePath := c.buildCyclePath(path, pkg)
		c.AddViolation(
			"critical",
			fmt.Sprintf("Cyclic dependency detected: %s", strings.Join(cyclePath, " -> ")),
			"",
			fmt.Sprintf("Cycle involves packages: %v", cyclePath),
			0,
		)
		return true
	}

	if visited[pkg] {
		return false
	}

	visited[pkg] = true
	recStack[pkg] = true
	path = append(path, pkg)

	for _, neighbor := range adjacency[pkg] {
		if c.hasCycle(neighbor, adjacency, visited, recStack, path) {
			return true
		}
	}

	recStack[pkg] = false
	if len(path) > 0 {
		path = path[:len(path)-1]
	}

	return false
}

func (c *CyclicDependencyChecker) buildCyclePath(path []string, startPkg string) []string {
	for i, p := range path {
		if p == startPkg {
			return append(path[i:], startPkg)
		}
	}
	return append(path, startPkg)
}
