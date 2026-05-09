package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

type ScenarioInfo struct {
	Name   string                 `json:"name"`
	Type   string                 `json:"type"`
	Status string                 `json:"status"`
	Config map[string]interface{} `json:"config"`
}

type State struct {
	Timestamp        time.Time              `json:"timestamp"`
	ActiveGoroutines int                    `json:"active_goroutines"`
	DBConnections    int                    `json:"db_connections"`
	DBIdle           int                    `json:"db_idle"`
	DBInUse          int                    `json:"db_in_use"`
	RedisConnections int                    `json:"redis_connections"`
	QueueLength      int                    `json:"queue_length"`
	Metrics          map[string]interface{} `json:"metrics"`
}

type Event struct {
	ID        string                 `json:"id"`
	Timestamp time.Time              `json:"timestamp"`
	Scenario  string                 `json:"scenario"`
	Level     string                 `json:"level"`
	Message   string                 `json:"message"`
	Data      map[string]interface{} `json:"data,omitempty"`
}

var baseURL = "http://127.0.0.1:8080"

func main() {
	if len(os.Args) < 2 {
		printHelp()
		os.Exit(1)
	}

	if envURL := os.Getenv("CHAOS_API_URL"); envURL != "" {
		baseURL = envURL
	}

	cmd := os.Args[1]
	switch cmd {
	case "list", "ls":
		listScenarios()
	case "start":
		if len(os.Args) < 3 {
			fmt.Println("Usage: chaos-cli start <scenario>")
			os.Exit(1)
		}
		controlScenario(os.Args[2], "start")
	case "stop":
		if len(os.Args) < 3 {
			fmt.Println("Usage: chaos-cli stop <scenario>")
			os.Exit(1)
		}
		controlScenario(os.Args[2], "stop")
	case "recover":
		if len(os.Args) < 3 {
			fmt.Println("Usage: chaos-cli recover <scenario>")
			os.Exit(1)
		}
		controlScenario(os.Args[2], "recover")
	case "status":
		getStatus()
	case "events":
		getEvents()
	case "scenario":
		if len(os.Args) < 3 {
			fmt.Println("Usage: chaos-cli scenario <name>")
			os.Exit(1)
		}
		getScenarioDetail(os.Args[2])
	case "help":
		printHelp()
	default:
		fmt.Printf("Unknown command: %s\n", cmd)
		printHelp()
		os.Exit(1)
	}
}

func printHelp() {
	fmt.Println("Chaos Simulator CLI")
	fmt.Println("")
	fmt.Println("Usage: chaos-cli <command> [args]")
	fmt.Println("")
	fmt.Println("Commands:")
	fmt.Println("  list, ls              List all available scenarios")
	fmt.Println("  start <scenario>      Start a scenario")
	fmt.Println("  stop <scenario>       Stop a scenario")
	fmt.Println("  recover <scenario>    Recover a scenario")
	fmt.Println("  status                Show system status")
	fmt.Println("  events                Show recent events")
	fmt.Println("  scenario <name>       Show scenario details")
	fmt.Println("  help                  Show this help")
	fmt.Println("")
	fmt.Println("Available scenarios:")
	fmt.Println("  - connection_pool_exhaustion")
	fmt.Println("  - message_queue_backlog")
	fmt.Println("  - goroutine_leak")
	fmt.Println("  - db_lock_wait")
	fmt.Println("  - cache_dirty_data")
	fmt.Println("  - config_drift")
	fmt.Println("")
	fmt.Println("Environment:")
	fmt.Println("  CHAOS_API_URL         API server URL (default: http://127.0.0.1:8080)")
}

func listScenarios() {
	resp, err := http.Get(baseURL + "/api/scenarios")
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var scenarios []ScenarioInfo
	json.Unmarshal(body, &scenarios)

	fmt.Println("Available scenarios:")
	for _, s := range scenarios {
		statusColor := statusToColor(s.Status)
		fmt.Printf("  %s [%s] %s\033[0m\n", s.Name, statusColor, s.Status)
	}
}

func controlScenario(name, action string) {
	payload, _ := json.Marshal(map[string]string{"action": action})
	resp, err := http.Post(baseURL+"/api/scenarios/"+name, "application/json", bytes.NewBuffer(payload))
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("Error: %s\n", string(body))
		os.Exit(1)
	}

	fmt.Printf("%s: %s completed\n", name, action)
}

func getStatus() {
	resp, err := http.Get(baseURL + "/api/state")
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var state State
	json.Unmarshal(body, &state)

	fmt.Println("System Status:")
	fmt.Printf("  Goroutines:    %d\n", state.ActiveGoroutines)
	fmt.Printf("  DB Connections: %d (in use: %d, idle: %d)\n", state.DBConnections, state.DBInUse, state.DBIdle)
	fmt.Printf("  Redis Conns:   %d\n", state.RedisConnections)
	fmt.Printf("  Queue Length:  %d\n", state.QueueLength)
	if len(state.Metrics) > 0 {
		fmt.Println("  Metrics:")
		for k, v := range state.Metrics {
			fmt.Printf("    %s: %v\n", k, v)
		}
	}
}

func getEvents() {
	resp, err := http.Get(baseURL + "/api/events")
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var events []Event
	json.Unmarshal(body, &events)

	if len(events) == 0 {
		fmt.Println("No events yet")
		return
	}

	fmt.Println("Recent Events (last 20):")
	start := len(events) - 20
	if start < 0 {
		start = 0
	}
	for i := start; i < len(events); i++ {
		e := events[i]
		levelColor := levelToColor(e.Level)
		fmt.Printf("[%s] %s%s\033[0m [%s] %s\n",
			e.Timestamp.Format("15:04:05"),
			levelColor,
			e.Level,
			e.Scenario,
			e.Message)
	}
}

func getScenarioDetail(name string) {
	resp, err := http.Get(baseURL + "/api/scenarios/" + name)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		fmt.Printf("Scenario not found: %s\n", name)
		os.Exit(1)
	}

	var pretty bytes.Buffer
	body, _ := io.ReadAll(resp.Body)
	json.Indent(&pretty, body, "", "  ")
	fmt.Println(pretty.String())
}

func statusToColor(status string) string {
	switch status {
	case "running":
		return "\033[33m"
	case "ready":
		return "\033[32m"
	case "error":
		return "\033[31m"
	case "recovered":
		return "\033[36m"
	default:
		return "\033[0m"
	}
}

func levelToColor(level string) string {
	switch level {
	case "error":
		return "\033[31m"
	case "warn":
		return "\033[33m"
	case "info":
		return "\033[34m"
	case "debug":
		return "\033[36m"
	default:
		return "\033[0m"
	}
}
