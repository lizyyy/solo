package model

type OpType string

const (
	OpMake              OpType = "make"
	OpSlice             OpType = "slice"
	OpFullSlice         OpType = "full_slice"
	OpAppend            OpType = "append"
	OpCopy              OpType = "copy"
	OpDelete            OpType = "delete"
	OpFilter            OpType = "filter"
	OpFuncPassByValue   OpType = "func_pass_by_value"
	OpFuncPassByRef     OpType = "func_pass_by_ref"
	OpModifyElement     OpType = "modify_element"
)

type Operation struct {
	ID         string
	Type       OpType
	Target     string
	Sources    []string
	Parameters map[string]interface{}
	Description string
	LineNumber int
}

type Step struct {
	StepNumber     int
	Operation      *Operation
	Slices         map[string]*Slice
	Arrays         map[string]*Array
	SliceAliases   map[string][]string
	DidGrow        bool
	GrowFrom       int
	GrowTo         int
	HoldsBigArray  bool
	BigArrayHolder string
	Notes          []string
}

func (s *Step) GetSliceByName(name string) (*Slice, bool) {
	slice, ok := s.Slices[name]
	return slice, ok
}

func (s *Step) GetArrayByID(id string) (*Array, bool) {
	array, ok := s.Arrays[id]
	return array, ok
}

func (s *Step) GetAliasesFor(sliceName string) []string {
	aliases, ok := s.SliceAliases[sliceName]
	if !ok {
		return []string{}
	}
	return aliases
}
