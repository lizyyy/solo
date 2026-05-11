package cli

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"

	"lensrent/internal/models"
	"lensrent/internal/service"
)

func promptYesNo(message string, defaultYes bool) bool {
	reader := bufio.NewReader(os.Stdin)
	defaultText := "[y/N]"
	if defaultYes {
		defaultText = "[Y/n]"
	}
	fmt.Printf("%s %s: ", message, defaultText)

	input, _ := reader.ReadString('\n')
	input = strings.TrimSpace(strings.ToLower(input))

	if input == "" {
		return defaultYes
	}

	return input == "y" || input == "yes"
}

func formatMoney(amount float64) string {
	return fmt.Sprintf("%.2f", amount)
}

func parseChecklistItems(items []string) []models.CheckItem {
	result := []models.CheckItem{}
	for _, item := range items {
		parts := strings.SplitN(item, ":", 2)
		name := strings.TrimSpace(parts[0])
		isGood := true
		comment := ""

		if len(parts) > 1 {
			rest := strings.TrimSpace(parts[1])
			if strings.HasPrefix(rest, "NG") || strings.HasPrefix(rest, "BAD") || strings.HasPrefix(rest, "坏") {
				isGood = false
				if len(rest) > 2 {
					comment = strings.TrimSpace(rest[2:])
					if strings.HasPrefix(comment, "-") || strings.HasPrefix(comment, ":") {
						comment = strings.TrimSpace(comment[1:])
					}
				}
			} else {
				comment = rest
			}
		}

		result = append(result, models.CheckItem{
			Name:    name,
			IsGood:  isGood,
			Comment: comment,
		})
	}
	return result
}

func printValidationResult(result *service.ValidationResult) {
	if len(result.Errors) > 0 {
		fmt.Println("\n⚠️  校验错误:")
		for _, e := range result.Errors {
			fmt.Printf("   - [%s] %s\n", e.Field, e.Message)
		}
	}

	if len(result.Conflicts) > 0 {
		fmt.Println("\n⚠️  冲突检测:")
		for _, c := range result.Conflicts {
			fmt.Printf("   - %s\n", c)
		}
	}

	if len(result.Warnings) > 0 {
		fmt.Println("\nℹ️  注意事项:")
		for _, w := range result.Warnings {
			fmt.Printf("   - [%s] %s\n", w.Field, w.Message)
		}
	}
}

func printRentalSummary(r *models.Rental) {
	fmt.Println("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Printf("订单号: %s\n", r.ID)
	fmt.Printf("状态:   %s\n", r.Status)
	fmt.Println("────────────────────────────────────────")
	fmt.Printf("器材:   %s\n", r.EquipmentName)
	fmt.Printf("租客:   %s (%s)\n", r.RenterName, r.RenterPhone)
	fmt.Printf("租期:   %s → %s\n", r.RentalStart, r.RentalEnd)
	if r.ActualReturn != "" {
		fmt.Printf("实归:   %s\n", r.ActualReturn)
	}
	fmt.Println("────────────────────────────────────────")
	fmt.Printf("押金:   ¥%s\n", formatMoney(r.DepositPaid))
	fmt.Printf("日租:   ¥%s/天\n", formatMoney(r.DailyRate))

	if len(r.AccessoriesOut) > 0 {
		fmt.Printf("配件:   %v\n", r.AccessoriesOut)
	}

	if r.IsReturned {
		fmt.Println("────────────────────────────────────────")
		if r.OverdueDays > 0 {
			fmt.Printf("逾期:   %d 天 (费用 ¥%s)\n", r.OverdueDays, formatMoney(r.OverdueFee))
		}
		if len(r.MissingAccessories) > 0 {
			fmt.Printf("缺失:   %v (扣款 ¥%s)\n", r.MissingAccessories, formatMoney(r.MissingFee))
		}
		if r.IsCompensated {
			fmt.Printf("赔付:   ¥%s (%s)\n", formatMoney(r.CompensationAmount), r.CompensationNote)
		}
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		fmt.Printf("  应退押金: ¥%s\n", formatMoney(r.RefundAmount))
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	} else {
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	}
	fmt.Println()
}

func parseFloatOrDefault(s string, defaultValue float64) float64 {
	if s == "" {
		return defaultValue
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return defaultValue
	}
	return f
}

func parseStringSlice(s string) []string {
	if s == "" {
		return []string{}
	}
	parts := strings.Split(s, ",")
	result := []string{}
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}
