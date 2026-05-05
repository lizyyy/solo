package parser

import (
	"fmt"
	"os"
	"regexp"
)

type SnippetInfo struct {
	Path           string
	Content        string
	DeferCount     int
	PanicCount     int
	RecoverCount   int
	HasNamedReturn bool
}

func ParseSnippet(path string) (*SnippetInfo, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("读取片段文件失败: %w", err)
	}

	contentStr := string(content)
	info := &SnippetInfo{
		Path:    path,
		Content: contentStr,
	}

	deferRegex := regexp.MustCompile(`\bdefer\s+\w+`)
	info.DeferCount = len(deferRegex.FindAllString(contentStr, -1))

	panicRegex := regexp.MustCompile(`\bpanic\s*\(`)
	info.PanicCount = len(panicRegex.FindAllString(contentStr, -1))

	recoverRegex := regexp.MustCompile(`\brecover\s*\(`)
	info.RecoverCount = len(recoverRegex.FindAllString(contentStr, -1))

	namedReturnRegex := regexp.MustCompile(`func\s+\w+\s*\([^)]*\)\s*\(\s*\w+\s+\w+`)
	info.HasNamedReturn = namedReturnRegex.MatchString(contentStr)

	return info, nil
}
