from io import TextIOWrapper
from typing import List, Optional, TextIO

from .models import ScanResult, Project, PortConfig, PortStatus


class ConsoleReporter:
    STATUS_COLORS = {
        PortStatus.AVAILABLE: "\033[92m",
        PortStatus.OCCUPIED: "\033[91m",
        PortStatus.CONFLICT: "\033[93m",
        PortStatus.INVALID: "\033[95m",
        PortStatus.UNKNOWN_PROCESS: "\033[94m",
    }
    STATUS_RESET = "\033[0m"
    STATUS_SYMBOLS = {
        PortStatus.AVAILABLE: "✓",
        PortStatus.OCCUPIED: "✗",
        PortStatus.CONFLICT: "⚠",
        PortStatus.INVALID: "?",
        PortStatus.UNKNOWN_PROCESS: "?",
    }

    def __init__(self, use_color: bool = True):
        self.use_color = use_color

    def _format_status(self, status: PortStatus) -> str:
        text = {
            PortStatus.AVAILABLE: "可用",
            PortStatus.OCCUPIED: "占用",
            PortStatus.CONFLICT: "冲突",
            PortStatus.INVALID: "错误",
            PortStatus.UNKNOWN_PROCESS: "未知",
        }.get(status, "未知")

        if self.use_color and status in self.STATUS_COLORS:
            return f"{self.STATUS_COLORS[status]}{self.STATUS_SYMBOLS[status]} {text}{self.STATUS_RESET}"
        return f"{self.STATUS_SYMBOLS[status]} {text}"

    def print_list(self, result: ScanResult) -> None:
        if not result.projects:
            print("未找到任何项目。请先运行 'port-checker scan'。")
            return

        print("\n" + "=" * 80)
        print(f"  端口占用巡检列表  (扫描: {self._format_time(result.scanned_at)})")
        if result.checked_at:
            print(f"  检测时间: {self._format_time(result.checked_at)}")
        print("=" * 80)

        for project in result.projects.values():
            self._print_project_summary(project)

        self._print_summary(result)

    def _print_project_summary(self, project: Project) -> None:
        print(f"\n📦 {project.name}")
        print(f"   路径: {project.path}")

        if not project.ports:
            print("   (未发现端口配置)")
            return

        available = len(project.get_available_ports())
        occupied = len(project.get_occupied_ports())
        conflicts = len([p for p in project.ports if p.status == PortStatus.CONFLICT])
        invalid = len([p for p in project.ports if p.status == PortStatus.INVALID])

        print(f"   配置端口: {len(project.ports)} | 可用: {available} | 占用: {occupied} | 冲突: {conflicts} | 错误: {invalid}")

    def print_detail(self, result: ScanResult, project_name: Optional[str] = None) -> None:
        if not result.projects:
            print("未找到任何项目。请先运行 'port-checker scan'。")
            return

        projects_to_show = [result.projects[project_name]] if project_name else list(result.projects.values())

        for project in projects_to_show:
            self._print_project_detail(project)

        self._print_summary(result)

    def _print_project_detail(self, project: Project) -> None:
        print("\n" + "─" * 80)
        print(f"📦 项目: {project.name}")
        print(f"   路径: {project.path}")
        print(f"   扫描时间: {self._format_time(project.last_scanned)}")
        print(f"   检测时间: {self._format_time(project.last_checked)}")
        print(f"   配置文件: {', '.join(project.config_files)}")

        if not project.ports:
            print("\n   未发现端口配置。")
            return

        print("\n   端口详情:")
        print("   " + "-" * 70)
        print(f"   {'状态':<10} {'端口':<8} {'服务':<25} {'来源':<30}")
        print("   " + "-" * 70)

        for port_config in sorted(project.ports, key=lambda p: p.port):
            status_str = self._format_status(port_config.status)
            port_str = str(port_config.port) if port_config.status != PortStatus.INVALID else "?"
            print(f"   {status_str:<10} {port_str:<8} {port_config.service:<25} {port_config.source:<30}")

            if port_config.status == PortStatus.OCCUPIED and port_config.process_name:
                print(f"   {'':<10} {'':<8} 进程: {port_config.process_name} (PID: {port_config.process_id})")
            if port_config.status == PortStatus.UNKNOWN_PROCESS:
                print(f"   {'':<10} {'':<8} 进程: 未知")
            if port_config.error:
                print(f"   {'':<10} {'':<8} 错误: {port_config.error}")

        self._print_suggestions_for_project(project)

    def _print_suggestions_for_project(self, project: Project) -> None:
        available = project.get_available_ports()
        occupied = project.get_occupied_ports()
        conflicts = [p for p in project.ports if p.status == PortStatus.CONFLICT]
        invalid = [p for p in project.ports if p.status == PortStatus.INVALID]
        unknown = [p for p in project.ports if p.status == PortStatus.UNKNOWN_PROCESS]

        if not (available or occupied or conflicts or invalid or unknown):
            return

        print(f"\n   💡 建议:")

        if available and len(available) == len(project.ports):
            print(f"      ✅ 所有端口可用，可以直接启动项目。")
        elif available:
            print(f"      ✅ 可用端口 ({len(available)}): {', '.join(str(p.port) for p in available)}")

        if occupied:
            print(f"      ⚠️  被占用端口 ({len(occupied)}):")
            for p in occupied:
                if p.process_name:
                    print(f"         - 端口 {p.port}: 被 '{p.process_name}' (PID: {p.process_id}) 占用")
                    print(f"           建议: 可以使用 `kill {p.process_id}` 关闭进程，或修改项目配置使用其他端口")
                else:
                    print(f"         - 端口 {p.port}: 被未知进程占用")

        if conflicts:
            print(f"      ⚠️  配置冲突 ({len(conflicts)}):")
            for p in conflicts:
                print(f"         - 端口 {p.port}: 与其他项目配置冲突")
                print(f"           建议: 修改其中一个项目的端口配置")

        if invalid:
            print(f"      ⚠️  格式错误 ({len(invalid)}):")
            for p in invalid:
                print(f"         - '{p.raw_value}' (服务: {p.service}): {p.error}")
                print(f"           建议: 检查并修复配置文件")

        if unknown:
            print(f"      ⚠️  未知进程 ({len(unknown)}):")
            for p in unknown:
                print(f"         - 端口 {p.port}: 被未知进程占用")
                print(f"           建议: 使用 `lsof -i :{p.port}` 手动检查")

    def _print_summary(self, result: ScanResult) -> None:
        all_ports = result.get_all_ports()
        if not all_ports:
            return

        total = len(all_ports)
        available = len([p for p in all_ports if p.status == PortStatus.AVAILABLE])
        occupied = len([p for p in all_ports if p.status == PortStatus.OCCUPIED])
        conflicts = len([p for p in all_ports if p.status == PortStatus.CONFLICT])
        invalid = len([p for p in all_ports if p.status == PortStatus.INVALID])
        unknown = len([p for p in all_ports if p.status == PortStatus.UNKNOWN_PROCESS])

        print("\n" + "=" * 80)
        print("  汇总统计")
        print("=" * 80)
        print(f"  项目数: {len(result.projects)}")
        print(f"  总端口: {total} | 可用: {available} | 占用: {occupied} | 冲突: {conflicts} | 格式错误: {invalid} | 未知进程: {unknown}")
        print()

        if available == total:
            print("  🎉 所有项目端口均可直接启动！")
        else:
            if occupied > 0:
                print(f"  ⚠️  {occupied} 个端口被占用，需要关闭进程或修改配置")
            if conflicts > 0:
                print(f"  ⚠️  {conflicts} 个端口存在项目间配置冲突")
            if invalid > 0:
                print(f"  ⚠️  {invalid} 个端口配置格式有误")
            if unknown > 0:
                print(f"  ⚠️  {unknown} 个端口被未知进程占用")

    def _format_time(self, dt) -> str:
        if dt is None:
            return "未执行"
        return dt.strftime("%Y-%m-%d %H:%M:%S")


class FileReporter:
    def __init__(self, output_path: str):
        self.output_path = output_path

    def generate(self, result: ScanResult) -> str:
        lines: List[str] = []

        lines.append("=" * 80)
        lines.append("  研发环境端口占用巡检报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {self._format_now()}")
        lines.append(f"扫描时间: {self._format_time(result.scanned_at)}")
        lines.append(f"检测时间: {self._format_time(result.checked_at)}")

        for project in result.projects.values():
            lines.extend(self._generate_project_section(project))

        lines.extend(self._generate_summary(result))

        report_content = "\n".join(lines)

        with open(self.output_path, "w", encoding="utf-8") as f:
            f.write(report_content)

        return self.output_path

    def _generate_project_section(self, project: Project) -> List[str]:
        lines: List[str] = []
        lines.append("\n" + "─" * 80)
        lines.append(f"项目: {project.name}")
        lines.append(f"路径: {project.path}")
        lines.append(f"配置文件: {', '.join(project.config_files)}")

        if not project.ports:
            lines.append("状态: 未发现端口配置")
            return lines

        available = project.get_available_ports()
        occupied = project.get_occupied_ports()
        conflicts = [p for p in project.ports if p.status == PortStatus.CONFLICT]
        invalid = [p for p in project.ports if p.status == PortStatus.INVALID]

        lines.append("")
        lines.append("端口详情:")
        lines.append(f"  {'状态':<8} {'端口':<8} {'服务':<25} {'来源'}")
        lines.append("  " + "-" * 70)

        for port_config in sorted(project.ports, key=lambda p: p.port):
            status_text = self._status_text(port_config.status)
            port_str = str(port_config.port) if port_config.status != PortStatus.INVALID else "?"
            lines.append(f"  {status_text:<8} {port_str:<8} {port_config.service:<25} {port_config.source}")

            if port_config.status == PortStatus.OCCUPIED and port_config.process_name:
                lines.append(f"           {'':<8} 进程: {port_config.process_name} (PID: {port_config.process_id})")
            if port_config.error:
                lines.append(f"           {'':<8} 说明: {port_config.error}")

        lines.append("")
        lines.append("建议:")

        if available and len(available) == len(project.ports):
            lines.append("  [可直接启动] 所有端口可用，可以直接启动项目。")
        elif available:
            lines.append(f"  [可直接启动] 可用端口 ({len(available)}): {', '.join(str(p.port) for p in available)}")

        if occupied:
            lines.append(f"  [需要处理] 被占用端口 ({len(occupied)}):")
            for p in occupied:
                if p.process_name:
                    lines.append(f"    - 端口 {p.port}: 被 '{p.process_name}' (PID: {p.process_id}) 占用")
                    lines.append(f"      建议选项:")
                    lines.append(f"        1. 使用 `kill {p.process_id}` 关闭占用进程")
                    lines.append(f"        2. 修改项目配置，使用其他可用端口")
                else:
                    lines.append(f"    - 端口 {p.port}: 被未知进程占用")
                    lines.append(f"      建议: 使用 `lsof -i :{p.port}` 手动检查")

        if conflicts:
            lines.append(f"  [需要处理] 配置冲突 ({len(conflicts)}):")
            for p in conflicts:
                lines.append(f"    - 端口 {p.port}: 与其他项目配置冲突")
                lines.append(f"      建议: 修改其中一个项目的端口配置")

        if invalid:
            lines.append(f"  [需要处理] 格式错误 ({len(invalid)}):")
            for p in invalid:
                lines.append(f"    - '{p.raw_value}' (服务: {p.service}): {p.error}")
                lines.append(f"      建议: 检查并修复配置文件")

        return lines

    def _generate_summary(self, result: ScanResult) -> List[str]:
        lines: List[str] = []
        all_ports = result.get_all_ports()

        if not all_ports:
            lines.append("\n" + "=" * 80)
            lines.append("总结: 未发现任何端口配置")
            return lines

        total = len(all_ports)
        available = [p for p in all_ports if p.status == PortStatus.AVAILABLE]
        occupied = [p for p in all_ports if p.status == PortStatus.OCCUPIED]
        conflicts = [p for p in all_ports if p.status == PortStatus.CONFLICT]
        invalid = [p for p in all_ports if p.status == PortStatus.INVALID]
        unknown = [p for p in all_ports if p.status == PortStatus.UNKNOWN_PROCESS]

        can_start_projects = []
        need_fix_projects = []

        for project in result.projects.values():
            proj_available = len(project.get_available_ports())
            proj_total = len(project.ports)
            if proj_available == proj_total and proj_total > 0:
                can_start_projects.append(project.name)
            else:
                need_fix_projects.append(project.name)

        lines.append("\n" + "=" * 80)
        lines.append("总结")
        lines.append("=" * 80)
        lines.append(f"项目数: {len(result.projects)}")
        lines.append(f"总端口配置: {total}")
        lines.append(f"  - 可用: {len(available)}")
        lines.append(f"  - 被占用: {len(occupied)}")
        lines.append(f"  - 配置冲突: {len(conflicts)}")
        lines.append(f"  - 格式错误: {len(invalid)}")
        lines.append(f"  - 未知进程占用: {len(unknown)}")

        lines.append("")
        if can_start_projects:
            lines.append("✅ 可以直接启动的项目:")
            for name in can_start_projects:
                lines.append(f"   - {name}")

        if need_fix_projects:
            lines.append("")
            lines.append("⚠️  需要处理后才能启动的项目:")
            for name in need_fix_projects:
                project = result.projects[name]
                issues = []
                if project.get_occupied_ports():
                    issues.append("端口被占用")
                if project.has_conflicts():
                    issues.append("端口冲突")
                if project.has_invalid():
                    issues.append("配置错误")
                lines.append(f"   - {name} ({', '.join(issues)})")

        return lines

    def _status_text(self, status: PortStatus) -> str:
        return {
            PortStatus.AVAILABLE: "可用",
            PortStatus.OCCUPIED: "占用",
            PortStatus.CONFLICT: "冲突",
            PortStatus.INVALID: "错误",
            PortStatus.UNKNOWN_PROCESS: "未知",
        }.get(status, "未知")

    def _format_time(self, dt) -> str:
        if dt is None:
            return "未执行"
        return dt.strftime("%Y-%m-%d %H:%M:%S")

    def _format_now(self) -> str:
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
