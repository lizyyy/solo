package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"os"

	"github.com/zy8078/netpol-precheck/pkg/engine"
	"github.com/zy8078/netpol-precheck/pkg/model"
	"github.com/zy8078/netpol-precheck/pkg/parser"
	"github.com/zy8078/netpol-precheck/pkg/report"
)

func main() {
	var (
		k8sYAMLPath     = flag.String("k8s", "", "Path to Kubernetes YAML file containing namespaces, pods, services")
		policyYAMLPath  = flag.String("policy", "", "Path to NetworkPolicy YAML file")
		intentsCSVPath  = flag.String("intents", "", "Path to traffic intents CSV file")
		outputFormat    = flag.String("format", "markdown", "Output format: markdown or json")
		outputFile      = flag.String("output", "", "Output file path (default: stdout)")
	)

	flag.Parse()

	if *k8sYAMLPath == "" || *policyYAMLPath == "" || *intentsCSVPath == "" {
		fmt.Println("Usage: netpol-precheck --k8s <k8s.yaml> --policy <policy.yaml> --intents <intents.csv> [--format markdown|json] [--output <file>]")
		os.Exit(1)
	}

	k8sItems, err := parser.ParseYAMLFile(*k8sYAMLPath)
	if err != nil {
		fmt.Printf("Error parsing Kubernetes YAML: %v\n", err)
		os.Exit(1)
	}

	policyItems, err := parser.ParseYAMLFile(*policyYAMLPath)
	if err != nil {
		fmt.Printf("Error parsing NetworkPolicy YAML: %v\n", err)
		os.Exit(1)
	}

	intents, err := parser.ParseTrafficIntentsCSV(*intentsCSVPath)
	if err != nil {
		fmt.Printf("Error parsing traffic intents CSV: %v\n", err)
		os.Exit(1)
	}

	namespaces, err := parser.ParseNamespaces(k8sItems)
	if err != nil {
		fmt.Printf("Error parsing namespaces: %v\n", err)
		os.Exit(1)
	}

	pods, err := parser.ParsePods(k8sItems)
	if err != nil {
		fmt.Printf("Error parsing pods: %v\n", err)
		os.Exit(1)
	}

	services, err := parser.ParseServices(k8sItems)
	if err != nil {
		fmt.Printf("Error parsing services: %v\n", err)
		os.Exit(1)
	}

	policies, err := parser.ParseNetworkPolicies(policyItems)
	if err != nil {
		fmt.Printf("Error parsing network policies: %v\n", err)
		os.Exit(1)
	}

	policyEngine := engine.NewPolicyEngine(namespaces, pods, services, policies)

	var results []*model.ReachabilityResult
	for _, intent := range intents {
		result := policyEngine.CheckReachability(&intent)
		results = append(results, result)
	}

	riskMatrix := policyEngine.GenerateRiskMatrix(intents)

	report := report.NewReport(results, riskMatrix)

	var output string
	switch *outputFormat {
	case "json":
		jsonOutput, err := report.ToJSON()
		if err != nil {
			fmt.Printf("Error generating JSON report: %v\n", err)
			os.Exit(1)
		}
		output = jsonOutput
	case "markdown":
		fallthrough
	default:
		output = report.ToMarkdown()
	}

	if *outputFile != "" {
		err := ioutil.WriteFile(*outputFile, []byte(output), 0644)
		if err != nil {
			fmt.Printf("Error writing output file: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Report written to %s\n", *outputFile)
	} else {
		fmt.Println(output)
	}
}
