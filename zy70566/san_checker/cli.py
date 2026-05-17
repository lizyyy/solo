import click
import os
import sys
from datetime import datetime

from .parser import parse_domain_list, parse_csr, parse_certificate
from .comparer import compare_san, check_certificate_expiry
from .reporter import generate_terminal_summary, generate_json_output


@click.group()
def cli():
    pass

@click.group()
def cli():
    pass


@cli.command()
@click.argument("domain_file", type=click.Path(exists=True))
@click.option("--csr", "-c", type=click.Path(exists=True), help="CSR 文件路径")
@click.option("--cert", "-t", type=click.Path(exists=True), help="证书文件路径")
@click.option("--json", "-j", "output_json", is_flag=True, help="输出 JSON 格式")
@click.option("--output", "-o", type=click.Path(), help="输出文件路径")
def check(domain_file, csr, cert, output_json, output):
    """核对 SAN 列表""" 
    try:
        domain_result = parse_domain_list(domain_file)
        domains = domain_result["domains"]
        bad_lines_raw = domain_result["bad_lines"]
        bad_lines = [{"line": bl["line_number"], "content": bl["raw_content"], "reason": bl["reason"]} for bl in bad_lines_raw]
        actual_san = []
        cert_info = {}
        if csr:
            csr_info = parse_csr(csr)
            actual_san = csr_info.get("san_list", [])
        elif cert:
            cert_info = parse_certificate(cert)
            actual_san = cert_info.get("san_list", [])
        else:
            click.echo("错误: 必须指定 --csr 或 --cert")
            sys.exit(1)
        comparison = compare_san(domains, actual_san)
        expiry_check = {}
        if cert and cert_info:
            expiry_check = check_certificate_expiry(cert_info)
        result = {
            "timestamp": datetime.now().isoformat(),
            "domain_file": domain_file,
            "csr_file": csr,
            "cert_file": cert,
            "domains_loaded": len(domains),
            "san_comparison": comparison,
            "certificate_info": cert_info,
            "expiry_check": expiry_check,
            "bad_lines": bad_lines
        }
        if output_json:
            report_text = generate_json_output(result)
        else:
            report_text = generate_terminal_summary(result)
        if output:
            with open(output, "w") as f:
                f.write(report_text)
            click.echo("报告已写入: {}".format(output))
        else:
            click.echo(report_text)
        if not comparison.get("all_matched") or bad_lines:
            sys.exit(1)
    except Exception as e:
        click.echo("错误: {}".format(str(e)), err=True)
        sys.exit(1)


def main():
    cli()

if __name__ == "__main__":
    main()
