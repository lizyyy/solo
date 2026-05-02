import click
import os
from .parser import Parsers
from .rule_engine import RuleEngine, RiskLevel
from .report import Reports


@click.group()
@click.version_option(version="0.1.0")
def main():
    """Email delivery DNS health check CLI tool"""
    pass


@main.command()
@click.option('--domains', '-d', required=True, help='Path to domains CSV file')
@click.option('--dns-records', '-r', required=True, help='Path to DNS records JSON file')
@click.option('--policy', '-p', required=True, help='Path to provider policy YAML file')
@click.option('--output-markdown', '-m', default='report.md', help='Output Markdown report file')
@click.option('--output-csv', '-c', default='report.csv', help='Output CSV report file')
def check(domains, dns_records, policy, output_markdown, output_csv):
    """Run DNS health check on domains"""
    click.echo("📧 Email DNS Health Check")
    click.echo("=" * 40)
    
    try:
        click.echo(f"📄 Parsing domains from: {domains}")
        click.echo(f"📄 Parsing DNS records from: {dns_records}")
        click.echo(f"📄 Parsing provider policy from: {policy}")
        
        domain_checks, dns_records_data, policies = Parsers.parse_all(
            domains, dns_records, policy
        )
        
        click.echo(f"✅ Loaded {len(domain_checks)} domains to check")
        click.echo(f"✅ Loaded {len(policies)} provider policies")
        
        click.echo("\n🔍 Running checks...")
        results = RuleEngine.check_all(domain_checks, dns_records_data, policies)
        
        total_critical = 0
        total_warning = 0
        total_info = 0
        
        for domain, issues in results.items():
            for issue in issues:
                if issue.risk_level == RiskLevel.CRITICAL:
                    total_critical += 1
                elif issue.risk_level == RiskLevel.WARNING:
                    total_warning += 1
                else:
                    total_info += 1
        
        click.echo("\n📊 Results summary:")
        click.echo(f"   🔴 Critical: {total_critical}")
        click.echo(f"   🟡 Warning: {total_warning}")
        click.echo(f"   🔵 Info: {total_info}")
        
        click.echo(f"\n📝 Generating reports...")
        Reports.generate_all(results, output_markdown, output_csv)
        
        click.echo(f"✅ Markdown report: {output_markdown}")
        click.echo(f"✅ CSV report: {output_csv}")
        
        if total_critical > 0:
            click.echo("\n⚠️  There are critical issues that need attention!")
            exit(1)
        elif total_warning > 0:
            click.echo("\nℹ️  There are warnings to review.")
            exit(0)
        else:
            click.echo("\n🎉 All checks passed!")
            exit(0)
            
    except Exception as e:
        click.echo(f"\n❌ Error: {str(e)}", err=True)
        exit(1)


@main.command()
def init():
    """Initialize sample files in current directory"""
    samples_dir = os.path.join(os.path.dirname(__file__), '..', 'samples')
    
    if not os.path.exists(samples_dir):
        click.echo("Sample files not found in package.", err=True)
        exit(1)
    
    files_to_copy = ['domains.csv', 'dns_records.json', 'provider_policy.yaml']
    
    click.echo("📁 Initializing sample files...")
    
    for filename in files_to_copy:
        src = os.path.join(samples_dir, filename)
        dst = os.path.join(os.getcwd(), filename)
        
        if os.path.exists(dst):
            click.echo(f"   ⚠️  {filename} already exists, skipping")
            continue
        
        if os.path.exists(src):
            import shutil
            shutil.copy(src, dst)
            click.echo(f"   ✅ Created {filename}")
        else:
            click.echo(f"   ❌ {filename} not found in samples")
    
    click.echo("\n✅ Sample files initialized!")
    click.echo("   You can now run: email-dns-checker check -d domains.csv -r dns_records.json -p provider_policy.yaml")


if __name__ == '__main__':
    main()
