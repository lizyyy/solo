package parser

import (
	"fmt"
	"io/ioutil"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/zy8078/netpol-precheck/pkg/model"
)

func ParseYAMLFile(filePath string) ([]interface{}, error) {
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %v", err)
	}

	return ParseYAMLContent(content)
}

func ParseYAMLContent(content []byte) ([]interface{}, error) {
	var results []interface{}
	decoder := yaml.NewDecoder(strings.NewReader(string(content)))

	for {
		var item interface{}
		if err := decoder.Decode(&item); err != nil {
			break
		}
		if item != nil {
			results = append(results, item)
		}
	}

	if len(results) == 0 {
		return nil, fmt.Errorf("no YAML documents found")
	}

	return results, nil
}

func ParsePods(items []interface{}) ([]model.Pod, error) {
	var pods []model.Pod

	for _, item := range items {
		data, err := yaml.Marshal(item)
		if err != nil {
			return nil, err
		}

		var pod model.Pod
		if err := yaml.Unmarshal(data, &pod); err != nil {
			continue
		}

		if pod.ObjectMeta.Name != "" {
			if pod.ObjectMeta.Namespace == "" {
				pod.ObjectMeta.Namespace = "default"
			}
			pods = append(pods, pod)
		}
	}

	return pods, nil
}

func ParseServices(items []interface{}) ([]model.Service, error) {
	var services []model.Service

	for _, item := range items {
		data, err := yaml.Marshal(item)
		if err != nil {
			return nil, err
		}

		var service model.Service
		if err := yaml.Unmarshal(data, &service); err != nil {
			continue
		}

		if service.ObjectMeta.Name != "" {
			if service.ObjectMeta.Namespace == "" {
				service.ObjectMeta.Namespace = "default"
			}
			for i := range service.Spec.Ports {
				service.Spec.Ports[i].TargetPort = parseIntOrString(service.Spec.Ports[i].TargetPort)
			}
			services = append(services, service)
		}
	}

	return services, nil
}

func ParseNamespaces(items []interface{}) ([]model.Namespace, error) {
	var namespaces []model.Namespace

	for _, item := range items {
		data, err := yaml.Marshal(item)
		if err != nil {
			return nil, err
		}

		var ns model.Namespace
		if err := yaml.Unmarshal(data, &ns); err != nil {
			continue
		}

		if ns.ObjectMeta.Name != "" {
			namespaces = append(namespaces, ns)
		}
	}

	return namespaces, nil
}

func ParseNetworkPolicies(items []interface{}) ([]model.NetworkPolicy, error) {
	var policies []model.NetworkPolicy

	for _, item := range items {
		data, err := yaml.Marshal(item)
		if err != nil {
			return nil, err
		}

		var np model.NetworkPolicy
		if err := yaml.Unmarshal(data, &np); err != nil {
			continue
		}

		if np.ObjectMeta.Name != "" {
			if np.ObjectMeta.Namespace == "" {
				np.ObjectMeta.Namespace = "default"
			}
			for i := range np.Spec.Ingress {
				for j := range np.Spec.Ingress[i].Ports {
					np.Spec.Ingress[i].Ports[j].Port = parseIntOrString(np.Spec.Ingress[i].Ports[j].Port)
				}
			}
			for i := range np.Spec.Egress {
				for j := range np.Spec.Egress[i].Ports {
					np.Spec.Egress[i].Ports[j].Port = parseIntOrString(np.Spec.Egress[i].Ports[j].Port)
				}
			}
			policies = append(policies, np)
		}
	}

	return policies, nil
}

func parseIntOrString(val interface{}) model.IntOrString {
	switch v := val.(type) {
	case int:
		return model.IntOrString{Type: "int", IntVal: int32(v)}
	case int32:
		return model.IntOrString{Type: "int", IntVal: v}
	case int64:
		return model.IntOrString{Type: "int", IntVal: int32(v)}
	case string:
		return model.IntOrString{Type: "string", StrVal: v}
	default:
		return model.IntOrString{Type: "string", StrVal: fmt.Sprintf("%v", val)}
	}
}
