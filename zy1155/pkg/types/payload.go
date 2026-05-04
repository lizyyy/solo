package types

type Payload struct {
	ID          string
	Source      string
	RawData     []byte
	ParsedData  map[string]interface{}
	MessageType string
	Timestamp   int64
}

type PayloadCollection struct {
	TotalCount int
	Payloads   []Payload
}

type ClientVersion struct {
	Version     string
	MinSchema   string
	MaxSchema   string
	Supported   bool
	Deprecated  bool
	Description string
}
