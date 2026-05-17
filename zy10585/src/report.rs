use crate::types::{ScanResult, ReportSummary, PermissionGap, IssueType, BadRecord};
use colored::*;
use std::path::Path;

pub fn generate_summary(result: &ScanResult) -> ReportSummary {
    let mut mode_issues = 0;
    let mut owner_issues = 0;
    let mut group_issues = 0;

    for gap in &result.gaps {
        for issue in &gap.issues {
            match issue {
                IssueType::ModeMismatch => mode_issues += 1,
                IssueType::OwnerMismatch => owner_issues += 1,
                IssueType::GroupMismatch => group_issues += 1,
            }
        }
    }

    ReportSummary {
        total_scanned: result.entries_scanned,
        total_issues: result.gaps.len(),
        mode_issues,
        owner_issues,
        group_issues,
        bad_records_count: result.bad_records.len(),
    }
}

pub fn print_terminal_summary(result: &ScanResult) {
    let summary = generate_summary(result);

    println!("\n{}", "═══════════════════════════════════════════════════".bright_cyan());
    println!("{}", "           目录权限扫描报告".bright_cyan().bold());
    println!("{}", "═══════════════════════════════════════════════════".bright_cyan());

    println!("\n{}", "📋 基本信息".bright_yellow().bold());
    println!("  扫描时间: {}", result.scan_time.format("%Y-%m-%d %H:%M:%S"));
    println!("  基准目录: {}", result.base_path.display());
    println!("  使用模板: {}", result.template.name);
    println!("  目标权限: {:04o} (目录)", result.template.dir_mode);
    if let Some(fm) = result.template.file_mode {
        println!("  文件权限: {:04o}", fm);
    }
    println!("  属主属组: {}:{}", result.template.owner, result.template.group);

    println!("\n{}", "📊 统计摘要".bright_yellow().bold());
    println!("  扫描条目: {} 个", summary.total_scanned.to_string().bright_white());
    println!("  发现问题: {} 个", summary.total_issues.to_string().bright_red());
    println!("    - 权限模式: {} 处", summary.mode_issues.to_string().bright_magenta());
    println!("    - 属主不匹配: {} 处", summary.owner_issues.to_string().bright_magenta());
    println!("    - 属组不匹配: {} 处", summary.group_issues.to_string().bright_magenta());

    if summary.bad_records_count > 0 {
        println!("  {} {} 条", "⚠️ 坏输入记录:".bright_yellow(), summary.bad_records_count.to_string().bright_red());
    }

    if !result.gaps.is_empty() {
        println!("\n{}", "🔍 问题详情".bright_yellow().bold());
        for (i, gap) in result.gaps.iter().take(20).enumerate() {
            println!("  {}. {}", (i + 1).to_string().bright_blue(), gap.path.display());
            print_gap_details(gap);
        }
        if result.gaps.len() > 20 {
            println!("  ... 还有 {} 条未显示", result.gaps.len() - 20);
        }
    }

    if !result.bad_records.is_empty() {
        println!("\n{}", "⚠️  坏输入记录 (保留原位置)".bright_yellow().bold());
        for bad in &result.bad_records {
            println!("  [行 {}] {}", bad.line_number.to_string().bright_red(), bad.reason.bright_red());
            println!("       原始内容: {}", bad.raw_content.dimmed());
        }
    }

    let status = if summary.total_issues == 0 && summary.bad_records_count == 0 {
        "✅ 全部通过".bright_green().bold()
    } else if summary.total_issues > 0 {
        "❌ 存在权限问题".bright_red().bold()
    } else {
        "⚠️  存在输入问题".bright_yellow().bold()
    };

    println!("\n{}", "═══════════════════════════════════════════════════".bright_cyan());
    println!("              检查结果: {}", status);
    println!("{}", "═══════════════════════════════════════════════════\n".bright_cyan());
}

fn print_gap_details(gap: &PermissionGap) {
    for issue in &gap.issues {
        match issue {
            IssueType::ModeMismatch => {
                if let Some(exp) = gap.expected_mode {
                    println!("       权限: {:04o} → {:04o}",
                        format!("{:04o}", gap.actual_mode).bright_red(),
                        format!("{:04o}", exp).bright_green());
                }
            }
            IssueType::OwnerMismatch => {
                println!("       属主: {} → {}",
                    gap.actual_owner.bright_red(),
                    gap.expected_owner.as_ref().unwrap().bright_green());
            }
            IssueType::GroupMismatch => {
                println!("       属组: {} → {}",
                    gap.actual_group.bright_red(),
                    gap.expected_group.as_ref().unwrap().bright_green());
            }
        }
    }
}

pub fn write_machine_readable(result: &ScanResult, output_path: &Path) -> std::io::Result<()> {
    let json = serde_json::to_string_pretty(result)?;
    std::fs::write(output_path, json)?;
    Ok(())
}

pub fn write_human_readable(result: &ScanResult, output_path: &Path) -> std::io::Result<()> {
    let summary = generate_summary(result);

    let mut content = String::new();
    content.push_str("目录权限检查报告\n");
    content.push_str("=================\n\n");
    content.push_str(&format!("生成时间: {}\n", result.scan_time.format("%Y-%m-%d %H:%M:%S")));
    content.push_str(&format!("基准目录: {}\n", result.base_path.display()));
    content.push_str("\n");

    content.push_str("使用的权限模板\n");
    content.push_str("----------------\n");
    content.push_str(&format!("模板名称: {}\n", result.template.name));
    content.push_str(&format!("目录权限: {:04o}\n", result.template.dir_mode));
    if let Some(fm) = result.template.file_mode {
        content.push_str(&format!("文件权限: {:04o}\n", fm));
    }
    content.push_str(&format!("属主: {}\n", result.template.owner));
    content.push_str(&format!("属组: {}\n", result.template.group));
    content.push_str(&format!("递归扫描: {}\n", if result.template.recursive { "是" } else { "否" }));
    content.push_str("\n");

    content.push_str("统计摘要\n");
    content.push_str("--------\n");
    content.push_str(&format!("扫描条目总数: {}\n", summary.total_scanned));
    content.push_str(&format!("发现问题总数: {}\n", summary.total_issues));
    content.push_str(&format!("  - 权限模式不匹配: {} 处\n", summary.mode_issues));
    content.push_str(&format!("  - 属主不匹配: {} 处\n", summary.owner_issues));
    content.push_str(&format!("  - 属组不匹配: {} 处\n", summary.group_issues));
    content.push_str(&format!("坏输入记录数: {}\n", summary.bad_records_count));
    content.push_str("\n");

    if !result.gaps.is_empty() {
        content.push_str("问题详细列表\n");
        content.push_str("------------\n");
        for (i, gap) in result.gaps.iter().enumerate() {
            content.push_str(&format!("\n{}. {}\n", i + 1, gap.path.display()));
            content.push_str(&format!("   类型: {}\n", if gap.path.is_dir() { "目录" } else { "文件" }));

            for issue in &gap.issues {
                match issue {
                    IssueType::ModeMismatch => {
                        if let Some(exp) = gap.expected_mode {
                            content.push_str(&format!("   权限模式: 当前 {:04o}, 期望 {:04o}\n",
                                gap.actual_mode, exp));
                        }
                    }
                    IssueType::OwnerMismatch => {
                        content.push_str(&format!("   属主: 当前 '{}', 期望 '{}'\n",
                            gap.actual_owner, gap.expected_owner.as_ref().unwrap()));
                    }
                    IssueType::GroupMismatch => {
                        content.push_str(&format!("   属组: 当前 '{}', 期望 '{}'\n",
                            gap.actual_group, gap.expected_group.as_ref().unwrap()));
                    }
                }
            }
        }
        content.push_str("\n");
    }

    if !result.bad_records.is_empty() {
        content.push_str("坏输入记录 (保留原始位置)\n");
        content.push_str("------------------------\n");
        for bad in &result.bad_records {
            content.push_str(&format!("\n行号: {}\n", bad.line_number));
            content.push_str(&format!("原因: {}\n", bad.reason));
            content.push_str(&format!("原始内容: {}\n", bad.raw_content));
        }
    }

    content.push_str("\n建议\n");
    content.push_str("----\n");
    if summary.total_issues > 0 {
        content.push_str("1. 请使用 'repair' 命令预览并修复上述权限问题\n");
        content.push_str("2. 修复前请确认修复操作不会影响系统安全性\n");
    }
    if summary.bad_records_count > 0 {
        content.push_str("3. 请检查并修正输入文件中的坏记录\n");
    }
    if summary.total_issues == 0 && summary.bad_records_count == 0 {
        content.push_str("所有检查通过，无需操作！\n");
    }

    std::fs::write(output_path, content)?;
    Ok(())
}
