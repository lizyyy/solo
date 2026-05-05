package main

import (
	"fmt"
)

// 错误示例: 依赖 map 遍历顺序
func BadIterationOrder() {
	m := map[string]int{
		"a": 1,
		"b": 2,
		"c": 3,
	}

	fmt.Println("第一次遍历:")
	for k, v := range m {
		fmt.Printf("%s: %d\n", k, v)
	}

	fmt.Println("\n第二次遍历:")
	for k, v := range m {
		fmt.Printf("%s: %d\n", k, v)
	}

	// 危险！错误做法：假设遍历顺序固定
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}

	// 错误：假设 keys[0] 总是 "a"
	fmt.Printf("\n错误假设: 第一个元素是 '%s'\n", keys[0])
}

// 正确示例: 稳定的遍历顺序
func GoodIterationOrder() {
	m := map[string]int{
		"a": 1,
		"b": 2,
		"c": 3,
	}

	// 正确做法：提取 key 并排序
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}

	// 手动排序确保顺序
	for i := 0; i < len(keys); i++ {
		for j := i + 1; j < len(keys); j++ {
			if keys[j] < keys[i] {
				keys[i], keys[j] = keys[j], keys[i]
			}
		}
	}

	fmt.Println("稳定顺序遍历:")
	for _, k := range keys {
		fmt.Printf("%s: %d\n", k, m[k])
	}
}

// 错误示例: 在遍历中修改 map
func BadModifyWhileIterating() {
	m := map[string]int{
		"a": 1,
		"b": 2,
		"c": 3,
	}

	fmt.Println("遍历中修改 map:")
	for k, v := range m {
		fmt.Printf("%s: %d\n", k, v)
		// 危险！在遍历中添加元素
		newKey := fmt.Sprintf("%s_new", k)
		m[newKey] = v * 2
	}

	fmt.Printf("\n最终 map 大小: %d (不确定!)\n", len(m))
}

// 正确示例: 先收集要删除的 key
func GoodSafeModification() {
	m := map[string]int{
		"a": 1,
		"b": 2,
		"c": 3,
		"d": 4,
	}

	// 正确做法：先收集要删除的 key
	keysToDelete := make([]string, 0)
	for k, v := range m {
		if v%2 == 0 {
			keysToDelete = append(keysToDelete, k)
		}
	}

	// 然后删除
	for _, k := range keysToDelete {
		delete(m, k)
	}

	fmt.Println("删除偶数后:")
	for k, v := range m {
		fmt.Printf("%s: %d\n", k, v)
	}
}

func main() {
	fmt.Println("=== 错误示例: 依赖遍历顺序 ===")
	BadIterationOrder()

	fmt.Println("\n=== 正确示例: 稳定遍历顺序 ===")
	GoodIterationOrder()

	fmt.Println("\n=== 正确示例: 安全修改 map ===")
	GoodSafeModification()

	fmt.Println("\n⚠️  警告: BadModifyWhileIterating 的行为不确定!")
	fmt.Println("Go 1.10+ 可能导致无限循环或 panic")
}
