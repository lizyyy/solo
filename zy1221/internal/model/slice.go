package model

import "fmt"

type Array struct {
	ID      string
	Size    int
	Values  []interface{}
	RefCount int
}

func (a *Array) String() string {
	return fmt.Sprintf("Array{ID: %s, Size: %d, Values: %v, RefCount: %d}", a.ID, a.Size, a.Values, a.RefCount)
}

type Slice struct {
	Name      string
	Len       int
	Cap       int
	Start     int
	ArrayID   string
	IsAliased bool
}

func (s *Slice) String() string {
	return fmt.Sprintf("Slice{Name: %s, Len: %d, Cap: %d, Start: %d, ArrayID: %s, IsAliased: %v}",
		s.Name, s.Len, s.Cap, s.Start, s.ArrayID, s.IsAliased)
}

func (s *Slice) GetElementIndices() []int {
	indices := make([]int, s.Len)
	for i := 0; i < s.Len; i++ {
		indices[i] = s.Start + i
	}
	return indices
}
