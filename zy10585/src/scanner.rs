use crate::types::{DirectoryEntry, PermissionTemplate, PermissionGap, IssueType};
use std::path::Path;
use walkdir::WalkDir;
use users::{get_user_by_uid, get_group_by_gid};
use std::fs::metadata;

pub fn scan_directory(base_path: &Path, template: &PermissionTemplate) -> (Vec<DirectoryEntry>, Vec<PermissionGap>) {
    let mut entries = Vec::new();
    let mut gaps = Vec::new();

    let walker = if template.recursive {
        WalkDir::new(base_path).into_iter()
    } else {
        WalkDir::new(base_path).max_depth(1).into_iter()
    };

    for entry in walker.filter_map(|e| e.ok()) {
        let path = entry.path();
        if let Ok(meta) = metadata(path) {
            let is_dir = meta.is_dir();
            let mode = get_unix_mode(&meta);
            let (owner, group, uid, gid) = get_owner_group(&meta);

            let dir_entry = DirectoryEntry {
                path: path.to_path_buf(),
                is_dir,
                mode,
                owner: owner.clone(),
                group: group.clone(),
                owner_uid: uid,
                group_gid: gid,
            };

            let gap = check_permissions(&dir_entry, template);
            if !gap.issues.is_empty() {
                gaps.push(gap);
            }

            entries.push(dir_entry);
        }
    }

    (entries, gaps)
}

fn get_unix_mode(meta: &std::fs::Metadata) -> u32 {
    use std::os::unix::fs::PermissionsExt;
    meta.permissions().mode() & 0o7777
}

fn get_owner_group(meta: &std::fs::Metadata) -> (String, String, u32, u32) {
    use std::os::unix::fs::MetadataExt;
    let uid = meta.uid();
    let gid = meta.gid();

    let owner = get_user_by_uid(uid)
        .map(|u| u.name().to_string_lossy().into_owned())
        .unwrap_or_else(|| uid.to_string());

    let group = get_group_by_gid(gid)
        .map(|g| g.name().to_string_lossy().into_owned())
        .unwrap_or_else(|| gid.to_string());

    (owner, group, uid, gid)
}

fn check_permissions(entry: &DirectoryEntry, template: &PermissionTemplate) -> PermissionGap {
    let mut issues = Vec::new();

    let expected_mode = if entry.is_dir {
        Some(template.dir_mode)
    } else {
        template.file_mode
    };

    if let Some(exp_mode) = expected_mode {
        if entry.mode != exp_mode {
            issues.push(IssueType::ModeMismatch);
        }
    }

    if entry.owner != template.owner {
        issues.push(IssueType::OwnerMismatch);
    }

    if entry.group != template.group {
        issues.push(IssueType::GroupMismatch);
    }

    PermissionGap {
        path: entry.path.clone(),
        expected_mode,
        actual_mode: entry.mode,
        expected_owner: Some(template.owner.clone()),
        actual_owner: entry.owner.clone(),
        expected_group: Some(template.group.clone()),
        actual_group: entry.group.clone(),
        issues,
    }
}
