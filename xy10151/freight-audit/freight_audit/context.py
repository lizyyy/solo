import os
import click

from freight_audit.config import load_config


class Context:
    def __init__(self):
        self.project_dir = os.getcwd()
        self.config = None


pass_ctx = click.make_pass_decorator(Context)


def ensure_config(ctx: Context) -> None:
    if ctx.config is None:
        ctx.config = load_config(ctx.project_dir)
