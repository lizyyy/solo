package normalizer

import (
	"regexp"
	"strings"
)

type NamePattern struct {
	Unified  string
	Patterns []string
}

type Normalizer struct {
	patterns []NamePattern
}

func NewDefault() *Normalizer {
	return &Normalizer{
		patterns: []NamePattern{
			{
				Unified: "GW155-4.5MW-叶片A组",
				Patterns: []string{
					"GW155叶片A组",
					"GW155-4.5MW叶片",
					"155叶片A",
					"叶片A组-GW155",
					"风机叶片A组 GW155",
				},
			},
			{
				Unified: "BLD-155-18-主梁",
				Patterns: []string{
					"BLD155主梁",
					"BLD-155-18主梁",
					"155型主梁",
					"叶片主梁 BLD-155",
					"BLD155-18 主承力梁",
				},
			},
			{
				Unified: "MT-BLD-0023-叶根轴承",
				Patterns: []string{
					"MTBLD0023轴承",
					"MT-BLD-0023 叶根",
					"叶根轴承0023",
					"物料编码MT-BLD-0023",
					"0023号叶根轴承",
				},
			},
			{
				Unified: "LD-2400-变桨齿轮箱",
				Patterns: []string{
					"LD2400变桨齿箱",
					"LD-2400 齿轮箱",
					"变桨齿轮箱LD2400",
					"2400型变桨齿箱",
					"LD-2400变桨减速器",
				},
			},
		},
	}
}

func (n *Normalizer) Normalize(name string) (string, bool) {
	clean := cleanName(name)
	for _, p := range n.patterns {
		if strings.EqualFold(clean, cleanName(p.Unified)) {
			return p.Unified, true
		}
		for _, pat := range p.Patterns {
			if strings.EqualFold(clean, cleanName(pat)) {
				return p.Unified, true
			}
		}
	}
	re := regexpUnified()
	if m := re.FindStringSubmatch(clean); m != nil {
		return m[0], true
	}
	return "", false
}

func (n *Normalizer) Patterns() []NamePattern { return n.patterns }

func cleanName(s string) string {
	re := regexp.MustCompile(`[\s\-_/\\#\.，。（）()【】\[\]"':：]`)
	return strings.TrimSpace(re.ReplaceAllString(s, ""))
}

func regexpUnified() *regexp.Regexp {
	return regexp.MustCompile(`(?i)^[A-Z]{2,5}\-?\d{2,5}(\-[A-Z0-9]{1,10}){0,3}$`)
}
