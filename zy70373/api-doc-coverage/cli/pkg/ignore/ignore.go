package ignore

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"regexp"
	"time"

	"github.com/example/api-doc-coverage/cli/pkg/checker"
	"github.com/example/api-doc-coverage/cli/pkg/models"
)

type IgnoreList struct {
	Items []models.IgnoreItem `json:"items"`
}

func Load(path string) (*IgnoreList, error) {
	list := &IgnoreList{Items: []models.IgnoreItem{}}
	
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return list, nil
	}

	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}

	err = json.Unmarshal(data, list)
	if err != nil {
		return nil, err
	}

	return list, nil
}

func Save(list *IgnoreList, path string) error {
	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}

	return ioutil.WriteFile(path, data, 0644)
}

func generateID(pattern, itemType string) string {
	hash := sha256.Sum256([]byte(pattern + "|" + itemType))
	return hex.EncodeToString(hash[:])
}

func (l *IgnoreList) Add(pattern, itemType, reason, service, owner string, expiresAt time.Time) models.IgnoreItem {
	item := models.IgnoreItem{
		ID:        generateID(pattern, itemType),
		Pattern:   pattern,
		Type:      itemType,
		Reason:    reason,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
		Service:   service,
		Owner:     owner,
	}

	for i, existing := range l.Items {
		if existing.ID == item.ID {
			l.Items[i] = item
			return item
		}
	}

	l.Items = append(l.Items, item)
	return item
}

func (l *IgnoreList) Remove(id string) bool {
	for i, item := range l.Items {
		if item.ID == id {
			l.Items = append(l.Items[:i], l.Items[i+1:]...)
			return true
		}
	}
	return false
}

func (l *IgnoreList) IsIgnored(route models.Route, issueType string) bool {
	now := time.Now()
	routeKey := fmt.Sprintf("%s %s", route.Method, route.Path)

	for _, item := range l.Items {
		if item.Type != "" && item.Type != issueType {
			continue
		}

		if now.After(item.ExpiresAt) {
			continue
		}

		re, err := regexp.Compile(item.Pattern)
		if err != nil {
			continue
		}

		if re.MatchString(routeKey) {
			return true
		}

		if item.Pattern == routeKey {
			return true
		}

		if item.Pattern == route.Path {
			return true
		}
	}

	return false
}

func (l *IgnoreList) IsRouteIgnored(route models.Route) bool {
	return l.IsIgnored(route, "")
}

func FilterCheckResult(result checker.CheckResult, ignoreList *IgnoreList) checker.CheckResult {
	filtered := checker.CheckResult{
		Blockers:      []models.RouteIssue{},
		Warnings:      []models.OpenAPIIssue{},
		ExampleIssues: []models.ExampleIssue{},
		Suggestions: []models.Suggestion{},
	}

	for _, issue := range result.Blockers {
		if !ignoreList.IsIgnored(issue.Route, issue.Type) {
			filtered.Blockers = append(filtered.Blockers, issue)
		}
	}

	filtered.Warnings = result.Warnings
	filtered.ExampleIssues = result.ExampleIssues
	filtered.Suggestions = result.Suggestions

	return filtered
}

func FilterDiffResult(diff checker.DiffResult, ignoreList *IgnoreList) checker.DiffResult {
	filtered := checker.DiffResult{
		UndocumentedRoutes: []models.Route{},
		UnmatchedDocs:    []models.OpenAPIRoute{},
		OutdatedDocs:   []checker.OutdatedDoc{},
	}

	for _, route := range diff.UndocumentedRoutes {
		if !ignoreList.IsRouteIgnored(route) {
			filtered.UndocumentedRoutes = append(filtered.UndocumentedRoutes, route)
		}
	}

	for _, doc := range diff.UnmatchedDocs {
		filtered.UnmatchedDocs = append(filtered.UnmatchedDocs, doc)
	}

	for _, outdated := range diff.OutdatedDocs {
		if !ignoreList.IsRouteIgnored(outdated.CodeRoute) {
			filtered.OutdatedDocs = append(filtered.OutdatedDocs, outdated)
		}
	}

	return filtered
}
