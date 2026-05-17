use serde::{Deserialize, Serialize};
use std::fmt;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionTemplate {
    pub name: String,
    pub dir_mode: u32,
    pub file_mode: Option<u32>,
    pub owner: String,
    pub group: String,
    pub recursive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryEntry {
    pub path: PathBuf,
    pub is_dir: bool,
    pub mode: u32,
    pub owner: String,
    pub group: String,
    pub owner_uid: u32,
    pub group_gid: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionGap {
    pub path: PathBuf,
    pub expected_mode: Option<u32>,
    pub actual_mode: u32,
    pub expected_owner: Option<String>,
    pub actual_owner: String,
    pub expected_group: Option<String>,
    pub actual_group: String,
    pub issues: Vec<IssueType>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum IssueType {
    ModeMismatch,
    OwnerMismatch,
    GroupMismatch,
}

impl fmt::Display for IssueType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            IssueType::ModeMismatch => write!(f, "权限模式不匹配"),
            IssueType::OwnerMismatch => write!(f, "属主不匹配"),
            IssueType::GroupMismatch => write!(f, "属组不匹配"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BadRecord {
    pub line_number: usize,
    pub raw_content: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub template: PermissionTemplate,
    pub base_path: PathBuf,
    pub entries_scanned: usize,
    pub entries_with_issues: usize,
    pub gaps: Vec<PermissionGap>,
    pub bad_records: Vec<BadRecord>,
    pub scan_time: chrono::DateTime<chrono::Local>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepairPreview {
    pub path: PathBuf,
    pub current_mode: u32,
    pub target_mode: u32,
    pub current_owner: String,
    pub target_owner: String,
    pub current_group: String,
    pub target_group: String,
    pub changes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportSummary {
    pub total_scanned: usize,
    pub total_issues: usize,
    pub mode_issues: usize,
    pub owner_issues: usize,
    pub group_issues: usize,
    pub bad_records_count: usize,
}
