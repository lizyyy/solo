package engine

import (
	"testing"

	"github.com/zy8078/netpol-precheck/pkg/model"
)

func TestLabelSelectorMatches(t *testing.T) {
	tests := []struct {
		name     string
		selector model.LabelSelector
		labels   map[string]string
		expected bool
	}{
		{
			name:     "empty selector matches all",
			selector: model.LabelSelector{},
			labels:   map[string]string{"app": "test"},
			expected: true,
		},
		{
			name: "matchLabels matches exactly",
			selector: model.LabelSelector{
				MatchLabels: map[string]string{"app": "frontend"},
			},
			labels:   map[string]string{"app": "frontend", "tier": "web"},
			expected: true,
		},
		{
			name: "matchLabels does not match",
			selector: model.LabelSelector{
				MatchLabels: map[string]string{"app": "backend"},
			},
			labels:   map[string]string{"app": "frontend"},
			expected: false,
		},
		{
			name: "matchExpressions In",
			selector: model.LabelSelector{
				MatchExpressions: []model.LabelSelectorRequirement{
					{Key: "tier", Operator: "In", Values: []string{"web", "api"}},
				},
			},
			labels:   map[string]string{"tier": "web"},
			expected: true,
		},
		{
			name: "matchExpressions NotIn",
			selector: model.LabelSelector{
				MatchExpressions: []model.LabelSelectorRequirement{
					{Key: "tier", Operator: "NotIn", Values: []string{"db"}},
				},
			},
			labels:   map[string]string{"tier": "web"},
			expected: true,
		},
		{
			name: "matchExpressions Exists",
			selector: model.LabelSelector{
				MatchExpressions: []model.LabelSelectorRequirement{
					{Key: "app", Operator: "Exists"},
				},
			},
			labels:   map[string]string{"app": "test"},
			expected: true,
		},
		{
			name: "matchExpressions DoesNotExist",
			selector: model.LabelSelector{
				MatchExpressions: []model.LabelSelectorRequirement{
					{Key: "deprecated", Operator: "DoesNotExist"},
				},
			},
			labels:   map[string]string{"app": "test"},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.selector.Matches(tt.labels)
			if result != tt.expected {
				t.Errorf("LabelSelector.Matches() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestPolicyEngineCheckReachability(t *testing.T) {
	ns := []model.Namespace{
		{ObjectMeta: model.ObjectMeta{Name: "frontend", Labels: map[string]string{"name": "frontend"}}},
		{ObjectMeta: model.ObjectMeta{Name: "backend", Labels: map[string]string{"name": "backend"}}},
	}

	pods := []model.Pod{
		{
			ObjectMeta: model.ObjectMeta{Name: "frontend-pod", Namespace: "frontend", Labels: map[string]string{"app": "frontend"}},
			Spec:       model.PodSpec{},
		},
		{
			ObjectMeta: model.ObjectMeta{Name: "backend-pod", Namespace: "backend", Labels: map[string]string{"app": "backend"}},
			Spec:       model.PodSpec{},
		},
	}

	services := []model.Service{}

	policies := []model.NetworkPolicy{
		{
			ObjectMeta: model.ObjectMeta{Name: "allow-frontend", Namespace: "backend"},
			Spec: model.NetworkPolicySpec{
				PodSelector: model.LabelSelector{MatchLabels: map[string]string{"app": "backend"}},
				PolicyTypes: []string{"Ingress"},
				Ingress: []model.NetworkPolicyIngressRule{
					{
						From: []model.NetworkPolicyPeer{
							{
								NamespaceSelector: &model.LabelSelector{MatchLabels: map[string]string{"name": "frontend"}},
								PodSelector:       &model.LabelSelector{MatchLabels: map[string]string{"app": "frontend"}},
							},
						},
						Ports: []model.NetworkPolicyPort{
							{Protocol: "TCP", Port: model.IntOrString{Type: "int", IntVal: 8080}},
						},
					},
				},
			},
		},
	}

	pe := NewPolicyEngine(ns, pods, services, policies)

	t.Run("allowed traffic", func(t *testing.T) {
		intent := &model.TrafficIntent{
			SourceNamespace:      "frontend",
			SourceLabels:         map[string]string{"app": "frontend"},
			DestinationNamespace: "backend",
			DestinationLabels:    map[string]string{"app": "backend"},
			Port:                 8080,
			Protocol:             "TCP",
		}

		result := pe.CheckReachability(intent)
		if !result.Allowed {
			t.Errorf("Expected allowed, got denied: %s", result.Reason)
		}
		if result.RiskLevel != model.RiskLow {
			t.Errorf("Expected RiskLow, got %v", result.RiskLevel)
		}
	})

	t.Run("denied traffic - no matching policy", func(t *testing.T) {
		intent := &model.TrafficIntent{
			SourceNamespace:      "frontend",
			SourceLabels:         map[string]string{"app": "frontend"},
			DestinationNamespace: "backend",
			DestinationLabels:    map[string]string{"app": "backend"},
			Port:                 9090,
			Protocol:             "TCP",
		}

		result := pe.CheckReachability(intent)
		if result.Allowed {
			t.Errorf("Expected denied, got allowed")
		}
		if result.RiskLevel != model.RiskCritical {
			t.Errorf("Expected RiskCritical, got %v", result.RiskLevel)
		}
	})

	t.Run("no policies - default allow", func(t *testing.T) {
		peNoPolicy := NewPolicyEngine(ns, pods, services, []model.NetworkPolicy{})

		intent := &model.TrafficIntent{
			SourceNamespace:      "frontend",
			SourceLabels:         map[string]string{"app": "frontend"},
			DestinationNamespace: "backend",
			DestinationLabels:    map[string]string{"app": "backend"},
			Port:                 8080,
			Protocol:             "TCP",
		}

		result := peNoPolicy.CheckReachability(intent)
		if !result.Allowed {
			t.Errorf("Expected allowed (no policies = default allow), got denied: %s", result.Reason)
		}
	})
}

func TestEmptySelector(t *testing.T) {
	ns := []model.Namespace{
		{ObjectMeta: model.ObjectMeta{Name: "default"}},
	}

	pods := []model.Pod{
		{
			ObjectMeta: model.ObjectMeta{Name: "pod1", Namespace: "default", Labels: map[string]string{"app": "test"}},
			Spec:       model.PodSpec{},
		},
	}

	services := []model.Service{}

	policies := []model.NetworkPolicy{
		{
			ObjectMeta: model.ObjectMeta{Name: "default-deny", Namespace: "default"},
			Spec: model.NetworkPolicySpec{
				PodSelector: model.LabelSelector{},
				PolicyTypes: []string{"Ingress"},
				Ingress:     []model.NetworkPolicyIngressRule{},
			},
		},
	}

	pe := NewPolicyEngine(ns, pods, services, policies)

	intent := &model.TrafficIntent{
		SourceNamespace:      "default",
		SourceLabels:         map[string]string{"app": "test"},
		DestinationNamespace: "default",
		DestinationLabels:    map[string]string{"app": "test"},
		Port:                 80,
		Protocol:             "TCP",
	}

	result := pe.CheckReachability(intent)
	if result.Allowed {
		t.Errorf("Expected denied (empty ingress rules), got allowed")
	}
}

func TestAllowAllTraffic(t *testing.T) {
	ns := []model.Namespace{
		{ObjectMeta: model.ObjectMeta{Name: "default"}},
	}

	pods := []model.Pod{
		{
			ObjectMeta: model.ObjectMeta{Name: "pod1", Namespace: "default", Labels: map[string]string{"app": "test"}},
			Spec:       model.PodSpec{},
		},
	}

	services := []model.Service{}

	policies := []model.NetworkPolicy{
		{
			ObjectMeta: model.ObjectMeta{Name: "allow-all", Namespace: "default"},
			Spec: model.NetworkPolicySpec{
				PodSelector: model.LabelSelector{MatchLabels: map[string]string{"app": "test"}},
				PolicyTypes: []string{"Ingress"},
				Ingress: []model.NetworkPolicyIngressRule{
					{
						From:  []model.NetworkPolicyPeer{},
						Ports: []model.NetworkPolicyPort{},
					},
				},
			},
		},
	}

	pe := NewPolicyEngine(ns, pods, services, policies)

	intent := &model.TrafficIntent{
		SourceNamespace:      "default",
		SourceLabels:         map[string]string{"app": "client"},
		DestinationNamespace: "default",
		DestinationLabels:    map[string]string{"app": "test"},
		Port:                 80,
		Protocol:             "TCP",
	}

	result := pe.CheckReachability(intent)
	if !result.Allowed {
		t.Errorf("Expected allowed (empty from/ports means allow all), got denied: %s", result.Reason)
	}
}
