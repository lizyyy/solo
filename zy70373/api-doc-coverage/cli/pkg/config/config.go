package config

import (
	"io/ioutil"

	"gopkg.in/yaml.v2"
)

type Config struct {
	RoutesDir   string                `yaml:"routesDir"`
	OpenAPIPath string                `yaml:"openAPIPath"`
	ExamplesDir string                `yaml:"examplesDir"`
	IgnoreFile  string                `yaml:"ignoreFile"`
	ServiceMap  map[string]ServiceInfo `yaml:"serviceMap"`
	OwnerMap    map[string]string     `yaml:"ownerMap"`
}

type ServiceInfo struct {
	Name   string `yaml:"name"`
	Owner  string `yaml:"owner"`
	Prefix string `yaml:"prefix"`
}

func Load(path string) (*Config, error) {
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg Config
	err = yaml.Unmarshal(data, &cfg)
	if err != nil {
		return nil, err
	}

	return &cfg, nil
}
