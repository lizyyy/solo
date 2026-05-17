import click
import sys
from pathlib import Path

from .parser import LogFileParser
from .reporter import generate_terminal_summary, save_report

@click.group()
def cli():
    """Logfmt Structured Parser CLI"""
    pass

