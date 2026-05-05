package parser

import (
	"bufio"
	"io"
	"time"

	"github.com/zy1214/pefa/pkg/evidence"
)

type Parser interface {
	EvidenceType() evidence.EvidenceType
	Detect(content string) bool
	Parse(content string) (evidence.Evidence, error)
	ParseStream(r io.Reader) (evidence.Evidence, error)
}

type BaseParser struct {
	evidenceType evidence.EvidenceType
}

func (b *BaseParser) EvidenceType() evidence.EvidenceType {
	return b.evidenceType
}

func (b *BaseParser) Detect(content string) bool {
	return false
}

func (b *BaseParser) Parse(content string) (evidence.Evidence, error) {
	return nil, &evidence.ParseError{
		EvidenceType: b.evidenceType,
		ErrorType:    evidence.ErrInvalidFormat,
		Message:      "Parse not implemented for this parser",
		Suggestion:   "Use a supported evidence type parser",
	}
}

func (b *BaseParser) ParseStream(r io.Reader) (evidence.Evidence, error) {
	content, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	return b.Parse(string(content))
}

type ParserRegistry struct {
	parsers        map[evidence.EvidenceType]Parser
	orderedParsers []Parser
}

func NewParserRegistry() *ParserRegistry {
	return &ParserRegistry{
		parsers:        make(map[evidence.EvidenceType]Parser),
		orderedParsers: make([]Parser, 0),
	}
}

func (r *ParserRegistry) Register(p Parser) {
	et := p.EvidenceType()
	if _, exists := r.parsers[et]; !exists {
		r.orderedParsers = append(r.orderedParsers, p)
	}
	r.parsers[et] = p
}

func (r *ParserRegistry) Get(et evidence.EvidenceType) Parser {
	return r.parsers[et]
}

func (r *ParserRegistry) Detect(content string) (Parser, bool) {
	for _, p := range r.orderedParsers {
		if p.Detect(content) {
			return p, true
		}
	}
	return nil, false
}

func (r *ParserRegistry) List() []evidence.EvidenceType {
	types := make([]evidence.EvidenceType, 0, len(r.orderedParsers))
	for _, p := range r.orderedParsers {
		types = append(types, p.EvidenceType())
	}
	return types
}

func NewDefaultRegistry() *ParserRegistry {
	reg := NewParserRegistry()
	reg.Register(NewTopParser())
	reg.Register(NewHtopParser())
	reg.Register(NewVmstatParser())
	reg.Register(NewIostatParser())
	reg.Register(NewNetstatParser())
	reg.Register(NewSsParser())
	reg.Register(NewStraceParser())
	reg.Register(NewPerfScriptParser())
	reg.Register(NewFoldedStackParser())
	return reg
}

type TimestampExtractor interface {
	Extract(line string) (time.Time, bool)
}

type ScopedReader struct {
	scanner *bufio.Scanner
	current string
	lineNum int
}

func NewScopedReader(r io.Reader) *ScopedReader {
	return &ScopedReader{
		scanner: bufio.NewScanner(r),
		lineNum: 0,
	}
}

func (s *ScopedReader) Next() bool {
	if s.scanner.Scan() {
		s.current = s.scanner.Text()
		s.lineNum++
		return true
	}
	return false
}

func (s *ScopedReader) Text() string {
	return s.current
}

func (s *ScopedReader) LineNum() int {
	return s.lineNum
}

func (s *ScopedReader) Err() error {
	return s.scanner.Err()
}
