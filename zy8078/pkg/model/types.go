package model

import (
	"fmt"
	"net"

	"gopkg.in/yaml.v3"
)

type ObjectMeta struct {
	Name        string            `yaml:"name"`
	Namespace   string            `yaml:"namespace"`
	Labels      map[string]string `yaml:"labels"`
	Annotations map[string]string `yaml:"annotations"`
}

type Pod struct {
	ObjectMeta ObjectMeta `yaml:"metadata"`
	Spec       PodSpec    `yaml:"spec"`
}

type PodSpec struct {
	Containers []Container `yaml:"containers"`
}

type Container struct {
	Name  string    `yaml:"name"`
	Ports []Port    `yaml:"ports"`
	Image string    `yaml:"image"`
}

type Port struct {
	Name          string `yaml:"name"`
	ContainerPort int32  `yaml:"containerPort"`
	Protocol      string `yaml:"protocol"`
	HostPort      int32  `yaml:"hostPort"`
}

type Service struct {
	ObjectMeta ObjectMeta `yaml:"metadata"`
	Spec       ServiceSpec `yaml:"spec"`
}

type ServiceSpec struct {
	Selector  map[string]string `yaml:"selector"`
	Ports     []ServicePort     `yaml:"ports"`
	ClusterIP string            `yaml:"clusterIP"`
	Type      string            `yaml:"type"`
}

type ServicePort struct {
	Name       string      `yaml:"name"`
	Protocol   string      `yaml:"protocol"`
	Port       int32       `yaml:"port"`
	TargetPort IntOrString `yaml:"targetPort"`
	NodePort   int32       `yaml:"nodePort"`
}

type IntOrString struct {
	Type   string
	IntVal int32
	StrVal string
}

func (i *IntOrString) UnmarshalYAML(value *yaml.Node) error {
	switch value.Kind {
	case yaml.ScalarNode:
		var intVal int32
		if err := value.Decode(&intVal); err == nil {
			*i = IntOrString{Type: "int", IntVal: intVal}
			return nil
		}
		var strVal string
		if err := value.Decode(&strVal); err != nil {
			return err
		}
		*i = IntOrString{Type: "string", StrVal: strVal}
		return nil
	default:
		return fmt.Errorf("unsupported YAML node type for IntOrString")
	}
}

type Namespace struct {
	ObjectMeta ObjectMeta `yaml:"metadata"`
}

type NetworkPolicy struct {
	ObjectMeta ObjectMeta         `yaml:"metadata"`
	Spec       NetworkPolicySpec `yaml:"spec"`
}

type NetworkPolicySpec struct {
	PodSelector     LabelSelector         `yaml:"podSelector"`
	PolicyTypes     []string              `yaml:"policyTypes"`
	Ingress         []NetworkPolicyIngressRule `yaml:"ingress"`
	Egress          []NetworkPolicyEgressRule  `yaml:"egress"`
}

type LabelSelector struct {
	MatchLabels      map[string]string `yaml:"matchLabels"`
	MatchExpressions []LabelSelectorRequirement `yaml:"matchExpressions"`
}

type LabelSelectorRequirement struct {
	Key      string   `yaml:"key"`
	Operator string   `yaml:"operator"`
	Values   []string `yaml:"values"`
}

type NetworkPolicyIngressRule struct {
	From    []NetworkPolicyPeer `yaml:"from"`
	Ports   []NetworkPolicyPort `yaml:"ports"`
}

type NetworkPolicyEgressRule struct {
	To      []NetworkPolicyPeer `yaml:"to"`
	Ports   []NetworkPolicyPort `yaml:"ports"`
}

type NetworkPolicyPeer struct {
	PodSelector       *LabelSelector `yaml:"podSelector"`
	NamespaceSelector *LabelSelector `yaml:"namespaceSelector"`
	IPBlock           *IPBlock       `yaml:"ipBlock"`
}

type NetworkPolicyPort struct {
	Protocol   string      `yaml:"protocol"`
	Port       IntOrString `yaml:"port"`
	EndPort    int32       `yaml:"endPort"`
}

type IPBlock struct {
	CIDR          string   `yaml:"cidr"`
	Except        []string `yaml:"except"`
}

type TrafficIntent struct {
	SourceNamespace      string
	SourceLabels         map[string]string
	DestinationNamespace string
	DestinationLabels    map[string]string
	DestinationService   string
	Port                 int32
	Protocol             string
	Description          string
}

type ReachabilityResult struct {
	Intent          *TrafficIntent
	Allowed         bool
	Reason          string
	MatchedPolicies []*NetworkPolicy
	RiskLevel       RiskLevel
}

type RiskLevel string

const (
	RiskLow      RiskLevel = "LOW"
	RiskMedium   RiskLevel = "MEDIUM"
	RiskHigh     RiskLevel = "HIGH"
	RiskCritical RiskLevel = "CRITICAL"
)

type RiskMatrixEntry struct {
	Source              string
	Destination         string
	Port                int32
	Protocol            string
	Allowed             bool
	RiskLevel           RiskLevel
	ConflictingPolicies []string
}

func (p Port) ProtocolOrDefault() string {
	if p.Protocol == "" {
		return "TCP"
	}
	return p.Protocol
}

func (np NetworkPolicyPort) ProtocolOrDefault() string {
	if np.Protocol == "" {
		return "TCP"
	}
	return np.Protocol
}

func (sp ServicePort) ProtocolOrDefault() string {
	if sp.Protocol == "" {
		return "TCP"
	}
	return sp.Protocol
}

func (ls LabelSelector) IsEmpty() bool {
	return len(ls.MatchLabels) == 0 && len(ls.MatchExpressions) == 0
}

func (ls LabelSelector) Matches(labels map[string]string) bool {
	if ls.IsEmpty() {
		return true
	}

	for k, v := range ls.MatchLabels {
		if labels[k] != v {
			return false
		}
	}

	for _, expr := range ls.MatchExpressions {
		if !expr.Matches(labels) {
			return false
		}
	}

	return true
}

func (lsr LabelSelectorRequirement) Matches(labels map[string]string) bool {
	value, exists := labels[lsr.Key]

	switch lsr.Operator {
	case "In":
		if !exists {
			return false
		}
		for _, v := range lsr.Values {
			if v == value {
				return true
			}
		}
		return false
	case "NotIn":
		if !exists {
			return true
		}
		for _, v := range lsr.Values {
			if v == value {
				return false
			}
		}
		return true
	case "Exists":
		return exists
	case "DoesNotExist":
		return !exists
	default:
		return false
	}
}

func (np NetworkPolicy) HasIngressPolicy() bool {
	for _, pt := range np.Spec.PolicyTypes {
		if pt == "Ingress" {
			return true
		}
	}
	return len(np.Spec.PolicyTypes) == 0 && len(np.Spec.Ingress) > 0
}

func (np NetworkPolicy) HasEgressPolicy() bool {
	for _, pt := range np.Spec.PolicyTypes {
		if pt == "Egress" {
			return true
		}
	}
	return len(np.Spec.PolicyTypes) == 0 && len(np.Spec.Egress) > 0
}

func (np NetworkPolicy) IsDefaultDeny() bool {
	if len(np.Spec.Ingress) == 0 && np.HasIngressPolicy() {
		return true
	}
	return false
}

func ParseCIDR(cidr string) (*net.IPNet, error) {
	_, ipnet, err := net.ParseCIDR(cidr)
	return ipnet, err
}
