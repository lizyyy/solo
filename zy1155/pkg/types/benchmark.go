package types

import "time"

type EncodingFormat string

const (
	FormatJSON       EncodingFormat = "json"
	FormatProtobuf   EncodingFormat = "protobuf"
	FormatMessagePack EncodingFormat = "msgpack"
)

type BenchmarkResult struct {
	Format       EncodingFormat
	EncodeTime   time.Duration
	DecodeTime   time.Duration
	SizeBytes    int
	Success      bool
	ErrorMessage string
	PayloadID    string
}

type FormatStats struct {
	Format          EncodingFormat
	TotalSizeBytes  int64
	AverageSize     float64
	MinSize         int
	MaxSize         int
	AverageEncodeTime time.Duration
	AverageDecodeTime time.Duration
	MinEncodeTime   time.Duration
	MaxEncodeTime   time.Duration
	MinDecodeTime   time.Duration
	MaxDecodeTime   time.Duration
	SuccessCount    int
	FailureCount    int
	TotalCount      int
}

type BenchmarkCollection struct {
	TotalCount  int
	Results     []BenchmarkResult
	FormatStats map[EncodingFormat]FormatStats
	Failures    []BenchmarkResult
}

type ComparisonReport struct {
	ProtobufVsJSON   FormatComparison
	MsgpackVsJSON    FormatComparison
	ProtobufVsMsgpack FormatComparison
}

type FormatComparison struct {
	FormatA      EncodingFormat
	FormatB      EncodingFormat
	SizeRatio    float64
	EncodeSpeedRatio float64
	DecodeSpeedRatio float64
	IsAFaster    bool
	IsASmaller   bool
}
