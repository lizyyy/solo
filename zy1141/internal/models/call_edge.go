package models

type CallEdge struct {
	SourceService string            `json:"source_service"`
	TargetService string            `json:"target_service"`
	Method        string            `json:"method"`
	Path          string            `json:"path"`
	OperationID   string            `json:"operation_id"`
	Protocol      string            `json:"protocol"`
	Tags          []string          `json:"tags"`
	Metadata      map[string]string `json:"metadata"`
}

type RawCallEdge struct {
	SourceService string            `json:"source_service"`
	TargetService string            `json:"target_service"`
	Method        string            `json:"method"`
	Path          string            `json:"path"`
	OperationID   string            `json:"operation_id,omitempty"`
	Protocol      string            `json:"protocol,omitempty"`
	Tags          []string          `json:"tags,omitempty"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}
