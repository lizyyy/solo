use crate::types::{PermissionGap, RepairPreview, PermissionTemplate};
use std::path::Path;
use users::{get_user_by_name, get_group_by_name};

pub fn generate_preview(gaps: &[PermissionGap], template: &PermissionTemplate) -> Vec<RepairPreview> {
    let mut previews = Vec::new();

    for gap in gaps {
        let mut changes = Vec::new();
        let target_mode = gap.expected_mode.unwrap_or(gap.actual_mode);

        if gap.issues.contains(&crate::types::IssueType::ModeMismatch) {
            changes.push(format!("权限: {:04o} → {:04o}", gap.actual_mode, target_mode));
        }

        if gap.issues.contains(&crate::types::IssueType::OwnerMismatch) {
            changes.push(format!("属主: {} → {}", gap.actual_owner, template.owner));
        }

        if gap.issues.contains(&crate::types::IssueType::GroupMismatch) {
            changes.push(format!("属组: {} → {}", gap.actual_group, template.group));
        }

        previews.push(RepairPreview {
            path: gap.path.clone(),
            current_mode: gap.actual_mode,
            target_mode,
            current_owner: gap.actual_owner.clone(),
            target_owner: template.owner.clone(),
            current_group: gap.actual_group.clone(),
            target_group: template.group.clone(),
            changes,
        });
    }

    previews
}

pub fn print_preview(previews: &[RepairPreview]) {
    use colored::*;

    println!("\n{}", "═══════════════════════════════════════════════════".bright_cyan());
    println!("{}", "           权限修复预览".bright_cyan().bold());
    println!("{}", "═══════════════════════════════════════════════════".bright_cyan());

    if previews.is_empty() {
        println!("\n{}", "✅ 没有需要修复的权限问题".bright_green());
        return;
    }

    println!("\n将修改 {} 个项目:\n", previews.len().to_string().bright_yellow());

    for (i, preview) in previews.iter().enumerate() {
        println!("{}. {}", (i + 1).to_string().bright_blue(), preview.path.display());
        for change in &preview.changes {
            println!("   {}", change.bright_magenta());
        }
        println!();
    }

    println!("{}", "═══════════════════════════════════════════════════".bright_cyan());
    println!("{}", "  警告: 以上修改将直接应用到文件系统！".bright_red().bold());
    println!("{}", "═══════════════════════════════════════════════════\n".bright_cyan());
}

pub fn apply_repairs(previews: &[RepairPreview]) -> (usize, usize, Vec<String>) {
    let mut success_count = 0;
    let mut fail_count = 0;
    let mut errors = Vec::new();

    for preview in previews {
        match apply_single_repair(preview) {
            Ok(_) => success_count += 1,
            Err(e) => {
                fail_count += 1;
                errors.push(format!("{}: {}", preview.path.display(), e));
            }
        }
    }

    (success_count, fail_count, errors)
}

fn apply_single_repair(preview: &RepairPreview) -> Result<(), String> {
    use std::fs::{set_permissions, Permissions};
    use std::os::unix::fs::PermissionsExt;

    let path = &preview.path;

    if preview.current_mode != preview.target_mode {
        let perm = Permissions::from_mode(preview.target_mode);
        set_permissions(path, perm)
            .map_err(|e| format!("设置权限失败: {}", e))?;
    }

    if preview.current_owner != preview.target_owner || preview.current_group != preview.target_group {
        let uid = if preview.current_owner != preview.target_owner {
            Some(get_user_by_name(&preview.target_owner)
                .ok_or_else(|| format!("用户 '{}' 不存在", preview.target_owner))?
                .uid())
        } else {
            None
        };

        let gid = if preview.current_group != preview.target_group {
            Some(get_group_by_name(&preview.target_group)
                .ok_or_else(|| format!("用户组 '{}' 不存在", preview.target_group))?
                .gid())
        } else {
            None
        };

        unsafe {
            let c_path = std::ffi::CString::new(path.to_str().unwrap_or_default())
                .map_err(|e| format!("路径转换失败: {}", e))?;

            let ret = libc::chown(
                c_path.as_ptr(),
                uid.unwrap_or(0xffffffff) as libc::uid_t,
                gid.unwrap_or(0xffffffff) as libc::gid_t,
            );

            if ret != 0 {
                return Err(format!("chown 失败 (错误码: {})", std::io::Error::last_os_error()));
            }
        }
    }

    Ok(())
}
