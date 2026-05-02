package engine

import (
	"fmt"
	"strings"

	"github.com/zy8078/netpol-precheck/pkg/model"
)

type PolicyEngine struct {
	Namespaces      []model.Namespace
	Pods            []model.Pod
	Services        []model.Service
	NetworkPolicies []model.NetworkPolicy
}

func NewPolicyEngine(ns []model.Namespace, pods []model.Pod, services []model.Service, np []model.NetworkPolicy) *PolicyEngine {
	return &PolicyEngine{
		Namespaces:      ns,
		Pods:            pods,
		Services:        services,
		NetworkPolicies: np,
	}
}

func (pe *PolicyEngine) CheckReachability(intent *model.TrafficIntent) *model.ReachabilityResult {
	var reasons []string
	var matchedPolicies []*model.NetworkPolicy
	var allowed bool
	var riskLevel model.RiskLevel

	sourcePods := pe.findPods(intent.SourceNamespace, intent.SourceLabels)
	if len(sourcePods) == 0 {
		reasons = append(reasons, fmt.Sprintf("No pods found in namespace '%s' with labels %v", intent.SourceNamespace, intent.SourceLabels))
	}

	targetPods := pe.findPods(intent.DestinationNamespace, intent.DestinationLabels)
	if intent.DestinationService != "" {
		svc := pe.findService(intent.DestinationNamespace, intent.DestinationService)
		if svc == nil {
			reasons = append(reasons, fmt.Sprintf("Service '%s/%s' not found", intent.DestinationNamespace, intent.DestinationService))
		} else {
			targetPods = pe.findPodsBySelector(intent.DestinationNamespace, svc.Spec.Selector)
			if len(targetPods) == 0 {
				reasons = append(reasons, fmt.Sprintf("No pods match service '%s/%s' selector %v", intent.DestinationNamespace, intent.DestinationService, svc.Spec.Selector))
			}
		}
	} else if len(targetPods) == 0 {
		reasons = append(reasons, fmt.Sprintf("No pods found in namespace '%s' with labels %v", intent.DestinationNamespace, intent.DestinationLabels))
	}

	targetNamespace := pe.findNamespace(intent.DestinationNamespace)
	if targetNamespace == nil {
		reasons = append(reasons, fmt.Sprintf("Destination namespace '%s' not found", intent.DestinationNamespace))
	}

	ingressPolicies := pe.getIngressPoliciesForPods(targetPods)
	allowed, matchedPolicies, reason := pe.evaluateIngressPolicies(intent, sourcePods, targetPods, targetNamespace, ingressPolicies)
	reasons = append(reasons, reason)

	riskLevel = pe.assessRisk(intent, allowed, len(sourcePods), len(targetPods), len(matchedPolicies), reasons)

	return &model.ReachabilityResult{
		Intent:          intent,
		Allowed:         allowed,
		Reason:          strings.Join(reasons, "; "),
		MatchedPolicies: matchedPolicies,
		RiskLevel:       riskLevel,
	}
}

func (pe *PolicyEngine) findPods(namespace string, labels map[string]string) []model.Pod {
	var result []model.Pod
	for _, pod := range pe.Pods {
		if pod.ObjectMeta.Namespace != namespace {
			continue
		}
		if pe.matchesLabels(pod.ObjectMeta.Labels, labels) {
			result = append(result, pod)
		}
	}
	return result
}

func (pe *PolicyEngine) findPodsBySelector(namespace string, selector map[string]string) []model.Pod {
	var result []model.Pod
	for _, pod := range pe.Pods {
		if pod.ObjectMeta.Namespace != namespace {
			continue
		}
		if pe.matchesLabels(pod.ObjectMeta.Labels, selector) {
			result = append(result, pod)
		}
	}
	return result
}

func (pe *PolicyEngine) findService(namespace, name string) *model.Service {
	for i := range pe.Services {
		if pe.Services[i].ObjectMeta.Namespace == namespace && pe.Services[i].ObjectMeta.Name == name {
			return &pe.Services[i]
		}
	}
	return nil
}

func (pe *PolicyEngine) findNamespace(name string) *model.Namespace {
	for i := range pe.Namespaces {
		if pe.Namespaces[i].ObjectMeta.Name == name {
			return &pe.Namespaces[i]
		}
	}
	return nil
}

func (pe *PolicyEngine) matchesLabels(podLabels, selectorLabels map[string]string) bool {
	if len(selectorLabels) == 0 {
		return true
	}
	for k, v := range selectorLabels {
		if podLabels[k] != v {
			return false
		}
	}
	return true
}

func (pe *PolicyEngine) getIngressPoliciesForPods(pods []model.Pod) []*model.NetworkPolicy {
	policySet := make(map[string]*model.NetworkPolicy)

	for _, pod := range pods {
		for i := range pe.NetworkPolicies {
			np := &pe.NetworkPolicies[i]
			if np.ObjectMeta.Namespace != pod.ObjectMeta.Namespace {
				continue
			}
			if np.Spec.PodSelector.Matches(pod.ObjectMeta.Labels) {
				key := fmt.Sprintf("%s/%s", np.ObjectMeta.Namespace, np.ObjectMeta.Name)
				policySet[key] = np
			}
		}
	}

	result := make([]*model.NetworkPolicy, 0, len(policySet))
	for _, np := range policySet {
		result = append(result, np)
	}
	return result
}

func (pe *PolicyEngine) evaluateIngressPolicies(intent *model.TrafficIntent, sourcePods, targetPods []model.Pod, targetNamespace *model.Namespace, policies []*model.NetworkPolicy) (bool, []*model.NetworkPolicy, string) {
	if len(targetPods) == 0 {
		return false, nil, "No target pods to evaluate"
	}

	hasIngressPolicies := len(policies) > 0

	if !hasIngressPolicies {
		return true, nil, "No ingress network policies exist, allowing all traffic (default allow)"
	}

	var matchedAllowPolicies []*model.NetworkPolicy
	var defaultDenyPolicies []*model.NetworkPolicy

	for _, np := range policies {
		if !np.HasIngressPolicy() {
			continue
		}

		if np.IsDefaultDeny() {
			defaultDenyPolicies = append(defaultDenyPolicies, np)
			continue
		}

		for _, rule := range np.Spec.Ingress {
			if pe.matchesIngressRule(intent, sourcePods, targetNamespace, rule) {
				matchedAllowPolicies = append(matchedAllowPolicies, np)
				break
			}
		}
	}

	if len(matchedAllowPolicies) > 0 {
		policyNames := make([]string, len(matchedAllowPolicies))
		for i, np := range matchedAllowPolicies {
			policyNames[i] = fmt.Sprintf("%s/%s", np.ObjectMeta.Namespace, np.ObjectMeta.Name)
		}
		return true, matchedAllowPolicies, fmt.Sprintf("Allowed by policies: %s", strings.Join(policyNames, ", "))
	}

	if len(defaultDenyPolicies) > 0 {
		policyNames := make([]string, len(defaultDenyPolicies))
		for i, np := range defaultDenyPolicies {
			policyNames[i] = fmt.Sprintf("%s/%s", np.ObjectMeta.Namespace, np.ObjectMeta.Name)
		}
		return false, defaultDenyPolicies, fmt.Sprintf("Denied by default-deny policies: %s", strings.Join(policyNames, ", "))
	}

	return false, nil, "Denied: no matching ingress rules found in policies"
}

func (pe *PolicyEngine) matchesIngressRule(intent *model.TrafficIntent, sourcePods []model.Pod, targetNamespace *model.Namespace, rule model.NetworkPolicyIngressRule) bool {
	if len(rule.From) == 0 && len(rule.Ports) == 0 {
		return true
	}

	if len(rule.From) == 0 {
		return pe.matchesPorts(intent, rule.Ports, sourcePods)
	}

	for _, peer := range rule.From {
		if pe.matchesPeer(intent, sourcePods, targetNamespace, peer) {
			if pe.matchesPorts(intent, rule.Ports, sourcePods) {
				return true
			}
		}
	}

	return false
}

func (pe *PolicyEngine) matchesPeer(intent *model.TrafficIntent, sourcePods []model.Pod, targetNamespace *model.Namespace, peer model.NetworkPolicyPeer) bool {
	if peer.PodSelector != nil && peer.NamespaceSelector != nil {
		for _, pod := range sourcePods {
			if peer.PodSelector.Matches(pod.ObjectMeta.Labels) {
				sourceNamespace := pe.findNamespace(intent.SourceNamespace)
				if sourceNamespace != nil && peer.NamespaceSelector.Matches(sourceNamespace.ObjectMeta.Labels) {
					return true
				}
			}
		}
	} else if peer.PodSelector != nil {
		for _, pod := range sourcePods {
			if peer.PodSelector.Matches(pod.ObjectMeta.Labels) {
				return true
			}
		}
	} else if peer.NamespaceSelector != nil {
		sourceNamespace := pe.findNamespace(intent.SourceNamespace)
		if sourceNamespace != nil && peer.NamespaceSelector.Matches(sourceNamespace.ObjectMeta.Labels) {
			return true
		}
	} else if peer.IPBlock != nil {
		return true
	} else {
		return true
	}

	return false
}

func (pe *PolicyEngine) matchesPorts(intent *model.TrafficIntent, policyPorts []model.NetworkPolicyPort, sourcePods []model.Pod) bool {
	if len(policyPorts) == 0 {
		return true
	}

	for _, policyPort := range policyPorts {
		if strings.ToUpper(policyPort.ProtocolOrDefault()) != strings.ToUpper(intent.Protocol) {
			continue
		}

		if policyPort.Port.Type == "int" {
			if policyPort.Port.IntVal == intent.Port {
				return true
			}
		} else if policyPort.Port.Type == "string" {
			for _, pod := range sourcePods {
				for _, container := range pod.Spec.Containers {
					for _, port := range container.Ports {
						if port.Name == policyPort.Port.StrVal {
							if port.ContainerPort == intent.Port {
								return true
							}
						}
					}
				}
			}
		}
	}

	return false
}

func (pe *PolicyEngine) assessRisk(intent *model.TrafficIntent, allowed bool, sourceCount, targetCount, policyCount int, reasons []string) model.RiskLevel {
	if !allowed {
		return model.RiskCritical
	}

	if sourceCount == 0 || targetCount == 0 {
		return model.RiskHigh
	}

	if policyCount == 0 {
		return model.RiskMedium
	}

	hasWarning := false
	for _, reason := range reasons {
		if strings.Contains(reason, "not found") || strings.Contains(reason, "No pods") {
			hasWarning = true
			break
		}
	}

	if hasWarning {
		return model.RiskMedium
	}

	return model.RiskLow
}

func (pe *PolicyEngine) GenerateRiskMatrix(intents []model.TrafficIntent) []model.RiskMatrixEntry {
	var matrix []model.RiskMatrixEntry

	for _, intent := range intents {
		result := pe.CheckReachability(&intent)

		policyNames := make([]string, len(result.MatchedPolicies))
		for i, np := range result.MatchedPolicies {
			policyNames[i] = fmt.Sprintf("%s/%s", np.ObjectMeta.Namespace, np.ObjectMeta.Name)
		}

		sourceKey := fmt.Sprintf("%s/%v", intent.SourceNamespace, intent.SourceLabels)
		destKey := fmt.Sprintf("%s/%v", intent.DestinationNamespace, intent.DestinationLabels)
		if intent.DestinationService != "" {
			destKey = fmt.Sprintf("%s/service:%s", intent.DestinationNamespace, intent.DestinationService)
		}

		matrix = append(matrix, model.RiskMatrixEntry{
			Source:              sourceKey,
			Destination:         destKey,
			Port:                intent.Port,
			Protocol:            intent.Protocol,
			Allowed:             result.Allowed,
			RiskLevel:           result.RiskLevel,
			ConflictingPolicies: policyNames,
		})
	}

	return matrix
}
