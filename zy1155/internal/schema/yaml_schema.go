package schema

import (
	"os"

	"gopkg.in/yaml.v3"
)

type YAMLSchema struct {
	Name     string            `yaml:"name"`
	Version  string            `yaml:"version"`
	Messages []YAMLMessage     `yaml:"messages"`
	Enums    []YAMLEnum        `yaml:"enums"`
}

type YAMLMessage struct {
	Name        string       `yaml:"name"`
	Description string       `yaml:"description"`
	Fields      []YAMLField  `yaml:"fields"`
}

type YAMLField struct {
	Name         string      `yaml:"name"`
	Number       int         `yaml:"number"`
	Type         string      `yaml:"type"`
	Required     bool        `yaml:"required"`
	Repeated     bool        `yaml:"repeated"`
	Deprecated   bool        `yaml:"deprecated"`
	Default      interface{} `yaml:"default"`
	EnumRef      string      `yaml:"enum_ref"`
	MessageRef   string      `yaml:"message_ref"`
	Description  string      `yaml:"description"`
}

type YAMLEnum struct {
	Name        string          `yaml:"name"`
	Description string          `yaml:"description"`
	Values      []YAMLEnumValue `yaml:"values"`
}

type YAMLEnumValue struct {
	Name   string `yaml:"name"`
	Number int    `yaml:"number"`
}

func ParseYAMLFile(filePath string) (*YAMLSchema, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var schema YAMLSchema
	if err := yaml.Unmarshal(data, &schema); err != nil {
		return nil, err
	}

	return &schema, nil
}

func ParseYAMLData(data []byte) (*YAMLSchema, error) {
	var schema YAMLSchema
	if err := yaml.Unmarshal(data, &schema); err != nil {
		return nil, err
	}
	return &schema, nil
}
