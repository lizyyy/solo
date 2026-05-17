#!/usr/bin/env python3
import os
import stat
import json
import sys
from datetime import datetime
from dataclasses import dataclass
from typing import List, Dict, Any
import click

@dataclass
class PermissionEntry:
    path: str
    mode: str
    owner: str
    error: str = None

@dataclass
class DiffResult:
    path: str
    field: str
    old: Any
    new: Any

class Scanner:
    def __init__(self, path):
        self.path = os.path.abspath(path)
        self.entries = []
        self.errors = []

    def scan(self):
        if not os.path.exists(self.path):
            self.errors.append({"path":self.path,"error":"Not found"})
            return self.entries, self.errors
        if os.path.isdir(self.path):
            for root, dirs, files in os.walk(self.path):
                for name in dirs + files:
                    full = os.path.join(root, name)
                    self._scan_one(full)
        else:
            self._scan_one(self.path)
        return self.entries, self.errors

    def _scan_one(self, path):
        try:
            st = os.lstat(path)
            mode = oct(stat.S_IMODE(st.st_mode))[2:].zfill(3)
            try: owner = os.getpwuid(st.st_uid).pw_name
            except: owner = str(st.st_uid)
            self.entries.append(PermissionEntry(path, mode, owner))
        except Exception as e:
            err = str(e)
            self.errors.append({"path":path,"error":err})
            self.entries.append(PermissionEntry(path, "", "", error=err))

class Manager:
    def __init__(self, sdir=".perm-snapshots"):
        self.sdir = sdir
        os.makedirs(sdir, exist_ok=True)

    def save(self, name, entries, errors):
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        fn = f"{name}_{ts}.json"
        fp = os.path.join(self.sdir, fn)
        data = {"name":name,"timestamp":ts,"entries":[e.__dict__ for e in entries],"errors":errors}
        with open(fp, "w") as f: json.dump(data, f, indent=2)
        return fp

    def load(self, fp):
        with open(fp) as f: return json.load(f)

    def list(self):
        if not os.path.exists(self.sdir): return []
        return sorted([f for f in os.listdir(self.sdir) if f.endswith(".json")])

class Differ:
    def compare(self, base, curr):
        be = {e["path"]:e for e in base["entries"]}
        ce = {e["path"]:e for e in curr["entries"]}
        diffs = []
        added = []
        removed = []
        all_paths = set(be.keys()) | set(ce.keys())
        for p in all_paths:
            if p not in be: added.append(ce[p])
            elif p not in ce: removed.append(be[p])
            else:
                b = be[p]
                c = ce[p]
                for k in ["mode","owner"]:
                    if b.get(k) != c.get(k):
                        diffs.append(DiffResult(p, k, b.get(k), c.get(k)))
        return diffs, added, removed

class Reporter:
    def summary(self, diffs, added, removed, errors):
        lines = ["="*60, "  Permission Snapshot Diff Summary", "="*60]
        lines.append(f"Modified: {len(diffs)}, Added: {len(added)}, Removed: {len(removed)}, Errors: {len(errors)}")
        if diffs:
            lines.append("-"*60)
            lines.append("Modifications:")
            for d in diffs[:10]: lines.append(f"  {d.path}: {d.old} -> {d.new}")
        if added:
            lines.append("-"*60)
            lines.append("Added:")
            for a in added[:5]: lines.append(f"  + {a['path']}")
        if removed:
            lines.append("-"*60)
            lines.append("Removed:")
            for r in removed[:5]: lines.append(f"  - {r['path']}")
        if errors:
            lines.append("-"*60)
            lines.append("Errors:")
            for e in errors: lines.append(f"  {e['path']}: {e['error']}")
        lines.append("="*60)
        return "\n".join(lines)

    def json_out(self, diffs, added, removed, errors, bname, cname):
        return json.dumps({"baseline":bname,"current":cname,"summary":
            {"modified":len(diffs),"added":len(added),"removed":len(removed),"errors":len(errors)},
            "modified":[{"path":d.path,"field":d.field,"old":d.old,"new":d.new} for d in diffs],
            "added":added,"removed":removed,"errors":errors}, indent=2)

@click.group()
def cli(): pass

@cli.command()
@click.argument("path")
@click.option("--name", "-n")
def scan(path, name):
    if not os.path.exists(path):
        click.echo(f"Error: {path} not found", err=True)
        sys.exit(1)
    if not name: name = os.path.basename(os.path.abspath(path))
    s = Scanner(path)
    entries, errors = s.scan()
    m = Manager()
    fp = m.save(name, entries, errors)
    click.echo(f"Snapshot saved: {fp} ({len(entries)} entries, {len(errors)} errors)")
    if errors: sys.exit(2)

@cli.command("list")
def list_snaps():
    m = Manager()
    snaps = m.list()
    if not snaps: click.echo("No snapshots found")
    else:
        click.echo("Snapshots:")
        for i, s in enumerate(snaps, 1): click.echo(f"  {i}. {s}")

@cli.command()
@click.argument("baseline")
@click.option("--path", "-p")
@click.option("--output-json")
def diff(baseline, path, output_json):
    m = Manager()
    if os.path.exists(baseline): bf = baseline
    else: bf = os.path.join(".perm-snapshots", baseline)
    if not os.path.exists(bf):
        click.echo(f"Error: baseline {bf} not found", err=True)
        sys.exit(1)
    bdata = m.load(bf)
    if path:
        s = Scanner(path)
        entries, errors = s.scan()
        cdata = {"name":"current_scan","entries":[e.__dict__ for e in entries],"errors":errors}
    else:
        click.echo("Error: specify --path", err=True)
        sys.exit(1)
    d = Differ()
    diffs, added, removed = d.compare(bdata, cdata)
    r = Reporter()
    click.echo(r.summary(diffs, added, removed, errors))
    if output_json:
        with open(output_json, "w") as f: f.write(r.json_out(diffs, added, removed, errors, bdata["name"], cdata["name"]))
        click.echo(f"JSON saved to {output_json}")
    if errors: sys.exit(2)
    elif diffs or added or removed: sys.exit(3)

@cli.command()
@click.argument("snap")
def show(snap):
    m = Manager()
    if os.path.exists(snap): fp = snap
    else: fp = os.path.join(".perm-snapshots", snap)
    if not os.path.exists(fp):
        click.echo(f"Error: {fp} not found", err=True)
        sys.exit(1)
    data = m.load(fp)
    click.echo(f"Snapshot: {data['name']}")
    click.echo(f"Entries: {len(data['entries'])}, Errors: {len(data['errors'])}")
    for e in data["entries"]:
        err = " [ERROR]" if e.get("error") else ""
        click.echo(f"  {e['mode']} {e['owner']} {e['path']}{err}")

if __name__ == "__main__":
    cli()