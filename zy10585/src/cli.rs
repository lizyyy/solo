use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "permguard")]
#[command(about = "目录权限模板CLI - 扫描、对比、修复目录权限", long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,

    #[arg(short, long)]
    pub json_output: Option<String>,

    #[arg(short, long)]
    pub report_output: Option<String>,

    #[arg(short, long)]
    pub quiet: bool,
}

#[derive(Subcommand)]
pub enum Commands {
    Scan {
        #[arg(short, long)]
        path: String,

        #[arg(short, long)]
        template: String,

        #[arg(short, long)]
        template_csv: Option<String>,
    },

    Repair {
        #[arg(short, long)]
        path: String,

        #[arg(short, long)]
        template: String,

        #[arg(long)]
        apply: bool,
    },

    Template {
        #[arg(short, long)]
        list: bool,

        #[arg(short, long)]
        csv: Option<String>,
    },
}
