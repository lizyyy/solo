use permguard::*;
use clap::Parser;
use std::path::PathBuf;

fn main() {
    let cli = Cli::parse();
    let exit_code = match run_command(&cli) {
        Ok(code) => code,
        Err(e) => {
            eprintln!("错误: {}", e);
            1
        }
    };
    std::process::exit(exit_code);
}

fn run_command(cli: &Cli) -> Result<i32, String> {
    match &cli.command {
        Commands::Scan { path, template, template_csv } => {
            run_scan(cli, path, template, template_csv)
        }
        Commands::Repair { path, template, apply } => {
            run_repair(cli, path, template, *apply)
        }
        Commands::Template { list, csv } => {
            run_template(cli, *list, csv)
        }
    }
}

fn run_scan(cli: &Cli, path: &str, template_name: &str, template_csv: &Option<String>) -> Result<i32, String> {
    let base_path = PathBuf::from(path);
    if !base_path.exists() {
        return Err(format!("路径不存在: {}", path));
    }

    let (templates, mut bad_records) = if let Some(csv_path) = template_csv {
        parse_templates_from_csv(&PathBuf::from(csv_path))
    } else {
        (vec![create_default_template(template_name)?], Vec::new())
    };

    let template = templates.into_iter()
        .find(|t| t.name == template_name)
        .ok_or_else(|| format!("未找到模板 '{}'", template_name))?;

    let (entries, gaps) = scan_directory(&base_path, &template);

    let result = ScanResult {
        template,
        base_path,
        entries_scanned: entries.len(),
        entries_with_issues: gaps.len(),
        gaps,
        bad_records,
        scan_time: chrono::Local::now(),
    };

    if !cli.quiet {
        print_terminal_summary(&result);
    }

    if let Some(json_path) = &cli.json_output {
        write_machine_readable(&result, &PathBuf::from(json_path))
            .map_err(|e| format!("写入JSON失败: {}", e))?;
        if !cli.quiet {
            println!("机器可读结果已保存到: {}", json_path);
        }
    }

    if let Some(report_path) = &cli.report_output {
        write_human_readable(&result, &PathBuf::from(report_path))
            .map_err(|e| format!("写入报告失败: {}", e))?;
        if !cli.quiet {
            println!("报告已保存到: {}", report_path);
        }
    }

    let summary = generate_summary(&result);
    Ok(if summary.total_issues > 0 || summary.bad_records_count > 0 {
        2
    } else {
        0
    })
}

fn run_repair(cli: &Cli, path: &str, template_name: &str, apply: bool) -> Result<i32, String> {
    let base_path = PathBuf::from(path);
    if !base_path.exists() {
        return Err(format!("路径不存在: {}", path));
    }

    let template = create_default_template(template_name)?;
    let (_entries, gaps) = scan_directory(&base_path, &template);

    let previews = generate_preview(&gaps, &template);

    if !cli.quiet {
        print_preview(&previews);
    }

    if apply && !previews.is_empty() {
        if !cli.quiet {
            println!("正在应用修复...");
        }
        let (success, fail, errors) = apply_repairs(&previews);

        if !cli.quiet {
            println!("\n修复完成:");
            println!("  成功: {} 项", success);
            println!("  失败: {} 项", fail);
            if !errors.is_empty() {
                println!("\n错误详情:");
                for e in errors {
                    println!("  - {}", e);
                }
            }
        }

        Ok(if fail > 0 { 1 } else { 0 })
    } else if !apply && !previews.is_empty() {
        if !cli.quiet {
            println!("使用 --apply 参数应用修复");
        }
        Ok(0)
    } else {
        Ok(0)
    }
}

fn run_template(_cli: &Cli, list: bool, csv: &Option<String>) -> Result<i32, String> {
    if list {
        println!("可用的内置模板:");
        println!("  default - 默认模板 (755, 当前用户:组)");
        println!("  strict  - 严格权限 (700, 仅用户可读写)");
        println!("  shared  - 共享目录 (775, 用户组可读写)");
    }

    if let Some(csv_path) = csv {
        println!("\nCSV模板文件格式:");
        println!("  列1: 模板名称");
        println!("  列2: 目录权限 (八进制, 如 755)");
        println!("  列3: 属主用户名");
        println!("  列4: 属组名");
        println!("  列5: 文件权限 (可选, 八进制)");
        println!("  列6: 是否递归 (可选, true/false)");
        println!("\n示例:");
        println!("  name,dir_mode,owner,group,file_mode,recursive");
        println!("  webroot,755,www-data,www-data,644,true");
        println!("\n当前路径: {}", csv_path);
    }

    Ok(0)
}

fn create_default_template(name: &str) -> Result<PermissionTemplate, String> {
    let user = users::get_current_username()
        .ok_or_else(|| "无法获取当前用户名".to_string())?
        .to_string_lossy()
        .into_owned();

    let group = users::get_current_groupname()
        .ok_or_else(|| "无法获取当前用户组".to_string())?
        .to_string_lossy()
        .into_owned();

    match name {
        "default" => Ok(PermissionTemplate {
            name: "default".to_string(),
            dir_mode: 0o755,
            file_mode: Some(0o644),
            owner: user,
            group,
            recursive: true,
        }),
        "strict" => Ok(PermissionTemplate {
            name: "strict".to_string(),
            dir_mode: 0o700,
            file_mode: Some(0o600),
            owner: user,
            group,
            recursive: true,
        }),
        "shared" => Ok(PermissionTemplate {
            name: "shared".to_string(),
            dir_mode: 0o775,
            file_mode: Some(0o664),
            owner: user,
            group,
            recursive: true,
        }),
        _ => Err(format!("未知模板 '{}', 使用 --template-list 查看可用模板", name)),
    }
}
