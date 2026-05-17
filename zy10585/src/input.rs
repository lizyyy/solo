use crate::types::{PermissionTemplate, BadRecord};
use csv::ReaderBuilder;
use std::path::Path;

pub fn parse_templates_from_csv(path: &Path) -> (Vec<PermissionTemplate>, Vec<BadRecord>) {
    let mut templates = Vec::new();
    let mut bad_records = Vec::new();

    if let Ok(mut rdr) = ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_path(path)
    {
        for (line_num, result) in rdr.records().enumerate() {
            let line_number = line_num + 2;

            match result {
                Ok(record) => {
                    match parse_template_record(&record) {
                        Ok(template) => templates.push(template),
                        Err(reason) => bad_records.push(BadRecord {
                            line_number,
                            raw_content: record.iter().collect::<Vec<_>>().join(","),
                            reason,
                        }),
                    }
                }
                Err(e) => {
                    bad_records.push(BadRecord {
                        line_number,
                        raw_content: e.to_string(),
                        reason: "CSV解析错误".to_string(),
                    });
                }
            }
        }
    }

    (templates, bad_records)
}

fn parse_template_record(record: &csv::StringRecord) -> Result<PermissionTemplate, String> {
    if record.len() < 4 {
        return Err("字段数量不足".to_string());
    }

    let name = record.get(0).unwrap_or("").to_string();
    if name.is_empty() {
        return Err("模板名称不能为空".to_string());
    }

    let dir_mode_str = record.get(1).unwrap_or("");
    let dir_mode = parse_octal(dir_mode_str)?;

    let owner = record.get(2).unwrap_or("").to_string();
    if owner.is_empty() {
        return Err("属主不能为空".to_string());
    }

    let group = record.get(3).unwrap_or("").to_string();
    if group.is_empty() {
        return Err("属组不能为空".to_string());
    }

    let file_mode = record.get(4)
        .filter(|s| !s.is_empty())
        .map(|s| parse_octal(s))
        .transpose()?;

    let recursive = record.get(5)
        .map(|s| s.to_lowercase() == "true" || s == "1")
        .unwrap_or(true);

    Ok(PermissionTemplate {
        name,
        dir_mode,
        file_mode,
        owner,
        group,
        recursive,
    })
}

fn parse_octal(s: &str) -> Result<u32, String> {
    u32::from_str_radix(s, 8)
        .map_err(|e| format!("无效的八进制权限 '{}': {}", s, e))
}

pub fn parse_paths_from_csv(path: &Path) -> (Vec<std::path::PathBuf>, Vec<BadRecord>) {
    let mut paths = Vec::new();
    let mut bad_records = Vec::new();

    if let Ok(mut rdr) = ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_path(path)
    {
        for (line_num, result) in rdr.records().enumerate() {
            let line_number = line_num + 2;

            match result {
                Ok(record) => {
                    if let Some(path_str) = record.get(0) {
                        let pb = std::path::PathBuf::from(path_str);
                        if pb.exists() {
                            paths.push(pb);
                        } else {
                            bad_records.push(BadRecord {
                                line_number,
                                raw_content: path_str.to_string(),
                                reason: "路径不存在".to_string(),
                            });
                        }
                    } else {
                        bad_records.push(BadRecord {
                            line_number,
                            raw_content: "".to_string(),
                            reason: "路径字段为空".to_string(),
                        });
                    }
                }
                Err(e) => {
                    bad_records.push(BadRecord {
                        line_number,
                        raw_content: e.to_string(),
                        reason: "CSV解析错误".to_string(),
                    });
                }
            }
        }
    }

    (paths, bad_records)
}
