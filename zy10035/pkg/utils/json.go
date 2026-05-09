package utils

import "encoding/json"

func MustMarshal(v interface{}) string {
	data, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return string(data)
}

func MustMarshalIndent(v interface{}) string {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return ""
	}
	return string(data)
}

func MustUnmarshal(data string, v interface{}) {
	_ = json.Unmarshal([]byte(data), v)
}

func Marshal(v interface{}) (string, error) {
	data, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func Unmarshal(data string, v interface{}) error {
	return json.Unmarshal([]byte(data), v)
}
