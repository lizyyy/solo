package benchmark

import (
	"encoding/json"
	"math"
	"time"

	"github.com/vmihailenco/msgpack/v5"
	"github.com/yourname/pcheck/pkg/types"
)

type Encoder interface {
	Encode(data interface{}) ([]byte, error)
	Decode(encoded []byte, target interface{}) error
	Format() types.EncodingFormat
}

type JSONEncoder struct{}

func (j *JSONEncoder) Encode(data interface{}) ([]byte, error) {
	return json.Marshal(data)
}

func (j *JSONEncoder) Decode(encoded []byte, target interface{}) error {
	return json.Unmarshal(encoded, target)
}

func (j *JSONEncoder) Format() types.EncodingFormat {
	return types.FormatJSON
}

type MessagePackEncoder struct{}

func (m *MessagePackEncoder) Encode(data interface{}) ([]byte, error) {
	return msgpack.Marshal(data)
}

func (m *MessagePackEncoder) Decode(encoded []byte, target interface{}) error {
	return msgpack.Unmarshal(encoded, target)
}

func (m *MessagePackEncoder) Format() types.EncodingFormat {
	return types.FormatMessagePack
}

type ProtoBufferEncoder struct{}

func (p *ProtoBufferEncoder) Encode(data interface{}) ([]byte, error) {
	return marshalProto(data)
}

func (p *ProtoBufferEncoder) Decode(encoded []byte, target interface{}) error {
	return unmarshalProto(encoded, target)
}

func (p *ProtoBufferEncoder) Format() types.EncodingFormat {
	return types.FormatProtobuf
}

type Comparer struct {
	Rules *types.Rules
}

func NewComparer(rules *types.Rules) *Comparer {
	if rules == nil {
		rules = &types.Rules{}
	}
	if rules.PerformanceChecks.SampleSize == 0 {
		rules.PerformanceChecks.SampleSize = 100
	}
	if rules.PerformanceChecks.Iterations == 0 {
		rules.PerformanceChecks.Iterations = 10
	}
	return &Comparer{Rules: rules}
}

func (c *Comparer) CompareAll(payloads []types.Payload, iterations int) *types.BenchmarkCollection {
	collection := &types.BenchmarkCollection{
		TotalCount:  len(payloads),
		Results:     []types.BenchmarkResult{},
		FormatStats: make(map[types.EncodingFormat]types.FormatStats),
		Failures:    []types.BenchmarkResult{},
	}

	encoders := c.getEncoders()

	for _, payload := range payloads {
		for _, encoder := range encoders {
			result := c.benchmarkEncodeDecode(payload, encoder, iterations)
			collection.Results = append(collection.Results, result)
			
			if !result.Success {
				collection.Failures = append(collection.Failures, result)
			}
		}
	}

	c.calculateStats(collection)
	return collection
}

func (c *Comparer) getEncoders() []Encoder {
	var encoders []Encoder
	
	if c.Rules.PerformanceChecks.CompareJSON {
		encoders = append(encoders, &JSONEncoder{})
	}
	if c.Rules.PerformanceChecks.CompareProtobuf {
		encoders = append(encoders, &ProtoBufferEncoder{})
	}
	if c.Rules.PerformanceChecks.CompareMessagePack {
		encoders = append(encoders, &MessagePackEncoder{})
	}
	
	if len(encoders) == 0 {
		encoders = []Encoder{
			&JSONEncoder{},
			&ProtoBufferEncoder{},
			&MessagePackEncoder{},
		}
	}
	
	return encoders
}

func (c *Comparer) benchmarkEncodeDecode(payload types.Payload, encoder Encoder, iterations int) types.BenchmarkResult {
	result := types.BenchmarkResult{
		Format:    encoder.Format(),
		PayloadID: payload.ID,
		Success:   true,
	}

	data := payload.ParsedData

	var totalEncodeTime time.Duration
	var totalDecodeTime time.Duration
	var encodedData []byte
	var encodeErr, decodeErr error

	for i := 0; i < iterations; i++ {
		encodeStart := time.Now()
		encoded, err := encoder.Encode(data)
		encodeTime := time.Since(encodeStart)
		
		if err != nil {
			encodeErr = err
			break
		}
		
		totalEncodeTime += encodeTime
		
		if i == 0 {
			encodedData = make([]byte, len(encoded))
			copy(encodedData, encoded)
		}

		var decoded map[string]interface{}
		decodeStart := time.Now()
		err = encoder.Decode(encoded, &decoded)
		decodeTime := time.Since(decodeStart)
		
		if err != nil {
			decodeErr = err
			break
		}
		
		totalDecodeTime += decodeTime
	}

	if encodeErr != nil {
		result.Success = false
		result.ErrorMessage = "encode error: " + encodeErr.Error()
	} else if decodeErr != nil {
		result.Success = false
		result.ErrorMessage = "decode error: " + decodeErr.Error()
	} else {
		result.EncodeTime = totalEncodeTime / time.Duration(iterations)
		result.DecodeTime = totalDecodeTime / time.Duration(iterations)
		result.SizeBytes = len(encodedData)
	}

	return result
}

func (c *Comparer) calculateStats(collection *types.BenchmarkCollection) {
	formatResults := make(map[types.EncodingFormat][]types.BenchmarkResult)
	
	for _, result := range collection.Results {
		formatResults[result.Format] = append(formatResults[result.Format], result)
	}

	for format, results := range formatResults {
		stats := types.FormatStats{
			Format:         format,
			TotalCount:     len(results),
			MinSize:        math.MaxInt,
			MaxSize:        0,
			MinEncodeTime:  math.MaxInt64,
			MaxEncodeTime:  0,
			MinDecodeTime:  math.MaxInt64,
			MaxDecodeTime:  0,
		}

		var totalSize int64
		var totalEncodeTime, totalDecodeTime time.Duration
		successCount := 0

		for _, r := range results {
			if !r.Success {
				continue
			}
			successCount++

			totalSize += int64(r.SizeBytes)
			totalEncodeTime += r.EncodeTime
			totalDecodeTime += r.DecodeTime

			if r.SizeBytes < stats.MinSize {
				stats.MinSize = r.SizeBytes
			}
			if r.SizeBytes > stats.MaxSize {
				stats.MaxSize = r.SizeBytes
			}
			if r.EncodeTime < stats.MinEncodeTime {
				stats.MinEncodeTime = r.EncodeTime
			}
			if r.EncodeTime > stats.MaxEncodeTime {
				stats.MaxEncodeTime = r.EncodeTime
			}
			if r.DecodeTime < stats.MinDecodeTime {
				stats.MinDecodeTime = r.DecodeTime
			}
			if r.DecodeTime > stats.MaxDecodeTime {
				stats.MaxDecodeTime = r.DecodeTime
			}
		}

		if successCount > 0 {
			stats.AverageSize = float64(totalSize) / float64(successCount)
			stats.AverageEncodeTime = totalEncodeTime / time.Duration(successCount)
			stats.AverageDecodeTime = totalDecodeTime / time.Duration(successCount)
			stats.SuccessCount = successCount
			stats.FailureCount = len(results) - successCount
			stats.TotalSizeBytes = totalSize
		}

		collection.FormatStats[format] = stats
	}
}

func (c *Comparer) GenerateComparisonReport(collection *types.BenchmarkCollection) *types.ComparisonReport {
	report := &types.ComparisonReport{}

	jsonStats, hasJSON := collection.FormatStats[types.FormatJSON]
	protoStats, hasProto := collection.FormatStats[types.FormatProtobuf]
	msgpackStats, hasMsgpack := collection.FormatStats[types.FormatMessagePack]

	if hasJSON && hasProto {
		report.ProtobufVsJSON = c.compareFormats(jsonStats, protoStats)
	}

	if hasJSON && hasMsgpack {
		report.MsgpackVsJSON = c.compareFormats(jsonStats, msgpackStats)
	}

	if hasProto && hasMsgpack {
		report.ProtobufVsMsgpack = c.compareFormats(protoStats, msgpackStats)
	}

	return report
}

func (c *Comparer) compareFormats(statsA, statsB types.FormatStats) types.FormatComparison {
	comparison := types.FormatComparison{
		FormatA: statsA.Format,
		FormatB: statsB.Format,
	}

	if statsA.AverageSize > 0 {
		comparison.SizeRatio = statsB.AverageSize / statsA.AverageSize
		comparison.IsASmaller = statsA.AverageSize < statsB.AverageSize
	}

	if statsA.AverageEncodeTime > 0 && statsB.AverageEncodeTime > 0 {
		comparison.EncodeSpeedRatio = float64(statsB.AverageEncodeTime) / float64(statsA.AverageEncodeTime)
		comparison.IsAFaster = statsA.AverageEncodeTime < statsB.AverageEncodeTime
	}

	if statsA.AverageDecodeTime > 0 && statsB.AverageDecodeTime > 0 {
		comparison.DecodeSpeedRatio = float64(statsB.AverageDecodeTime) / float64(statsA.AverageDecodeTime)
	}

	return comparison
}

func marshalProto(data interface{}) ([]byte, error) {
	switch v := data.(type) {
	case map[string]interface{}:
		return marshalProtoMap(v)
	case []interface{}:
		return marshalProtoArray(v)
	default:
		return marshalProtoValue(data)
	}
}

func marshalProtoMap(m map[string]interface{}) ([]byte, error) {
	var result []byte
	fieldNum := 1
	for _, v := range m {
		encoded, err := marshalProtoValue(v)
		if err != nil {
			return nil, err
		}
		key := encodeVarint(uint64(fieldNum<<2 | getWireType(v)))
		result = append(result, key...)
		result = append(result, encoded...)
		fieldNum++
	}
	return result, nil
}

func marshalProtoArray(arr []interface{}) ([]byte, error) {
	var result []byte
	for _, v := range arr {
		encoded, err := marshalProtoValue(v)
		if err != nil {
			return nil, err
		}
		result = append(result, encoded...)
	}
	return result, nil
}

func marshalProtoValue(v interface{}) ([]byte, error) {
	switch val := v.(type) {
	case nil:
		return []byte{}, nil
	case bool:
		if val {
			return encodeVarint(1), nil
		}
		return encodeVarint(0), nil
	case int:
		return encodeVarint(uint64(val)), nil
	case int8:
		return encodeVarint(uint64(val)), nil
	case int16:
		return encodeVarint(uint64(val)), nil
	case int32:
		return encodeVarint(uint64(val)), nil
	case int64:
		return encodeVarint(uint64(val)), nil
	case uint:
		return encodeVarint(uint64(val)), nil
	case uint8:
		return encodeVarint(uint64(val)), nil
	case uint16:
		return encodeVarint(uint64(val)), nil
	case uint32:
		return encodeVarint(uint64(val)), nil
	case uint64:
		return encodeVarint(val), nil
	case float32:
		return encodeFloat32(val), nil
	case float64:
		return encodeFloat64(val), nil
	case string:
		bytes := []byte(val)
		length := encodeVarint(uint64(len(bytes)))
		return append(length, bytes...), nil
	case []byte:
		length := encodeVarint(uint64(len(val)))
		return append(length, val...), nil
	case []interface{}:
		bytes, err := marshalProtoArray(val)
		if err != nil {
			return nil, err
		}
		length := encodeVarint(uint64(len(bytes)))
		return append(length, bytes...), nil
	case map[string]interface{}:
		bytes, err := marshalProtoMap(val)
		if err != nil {
			return nil, err
		}
		length := encodeVarint(uint64(len(bytes)))
		return append(length, bytes...), nil
	default:
		return []byte{}, nil
	}
}

func unmarshalProto(data []byte, target interface{}) error {
	if target == nil {
		return nil
	}
	
	result, _, err := unmarshalProtoValue(data)
	if err != nil {
		return err
	}
	
	if m, ok := target.(*map[string]interface{}); ok {
		if resultMap, ok := result.(map[string]interface{}); ok {
			*m = resultMap
		}
	} else if arr, ok := target.(*[]interface{}); ok {
		if resultArr, ok := result.([]interface{}); ok {
			*arr = resultArr
		}
	}
	
	return nil
}

func unmarshalProtoValue(data []byte) (interface{}, int, error) {
	if len(data) == 0 {
		return nil, 0, nil
	}
	
	result := make(map[string]interface{})
	pos := 0
	
	for pos < len(data) {
		key, n := decodeVarint(data[pos:])
		pos += n
		
		wireType := key & 0x7
		fieldNum := key >> 2
		fieldName := string(rune('a' + fieldNum - 1))
		
		var value interface{}
		var err error
		
		switch wireType {
		case 0:
			value, n, err = decodeVarintValue(data[pos:])
		case 1:
			value, n, err = decodeFixed64Value(data[pos:])
		case 2:
			value, n, err = decodeLengthDelimitedValue(data[pos:])
		case 5:
			value, n, err = decodeFixed32Value(data[pos:])
		default:
			n = 0
		}
		
		if err != nil {
			return nil, pos, err
		}
		
		pos += n
		result[fieldName] = value
	}
	
	return result, pos, nil
}

func encodeVarint(v uint64) []byte {
	var buf []byte
	for {
		b := byte(v & 0x7F)
		v >>= 7
		if v != 0 {
			b |= 0x80
		}
		buf = append(buf, b)
		if v == 0 {
			break
		}
	}
	return buf
}

func decodeVarint(data []byte) (uint64, int) {
	var v uint64
	var shift uint
	for i, b := range data {
		v |= uint64(b&0x7F) << shift
		shift += 7
		if b&0x80 == 0 {
			return v, i + 1
		}
	}
	return v, len(data)
}

func decodeVarintValue(data []byte) (interface{}, int, error) {
	v, n := decodeVarint(data)
	return int64(v), n, nil
}

func decodeFixed64Value(data []byte) (interface{}, int, error) {
	if len(data) < 8 {
		return nil, 0, nil
	}
	return float64(0), 8, nil
}

func decodeFixed32Value(data []byte) (interface{}, int, error) {
	if len(data) < 4 {
		return nil, 0, nil
	}
	return float32(0), 4, nil
}

func decodeLengthDelimitedValue(data []byte) (interface{}, int, error) {
	length, n := decodeVarint(data)
	pos := n
	if pos+int(length) > len(data) {
		return nil, pos, nil
	}
	bytes := data[pos : pos+int(length)]
	pos += int(length)
	
	if len(bytes) == 0 {
		return "", pos, nil
	}
	
	isString := true
	for _, b := range bytes {
		if b < 32 || b > 126 {
			if b == 0 || b == 9 || b == 10 || b == 13 {
				continue
			}
			isString = false
			break
		}
	}
	
	if isString {
		return string(bytes), pos, nil
	}
	
	return bytes, pos, nil
}

func encodeFloat32(v float32) []byte {
	return []byte{0, 0, 0, 0}
}

func encodeFloat64(v float64) []byte {
	return []byte{0, 0, 0, 0, 0, 0, 0, 0}
}

func getWireType(v interface{}) int {
	switch v.(type) {
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, bool:
		return 0
	case float32:
		return 5
	case float64:
		return 1
	case string, []byte, []interface{}, map[string]interface{}:
		return 2
	default:
		return 2
	}
}
