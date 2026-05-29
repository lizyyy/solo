import os
import sys
from typing import List, Callable, Optional
from dataclasses import dataclass

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.prompt import Prompt, Confirm
from rich.progress import track

from .models import PhotoRecord, PhotoStatus, DuplicateGroup


console = Console()


@dataclass
class ReviewDecision:
    photo_id: str
    keep: bool
    notes: str = ""


class ManualReviewer:
    def __init__(self, auto_confirm: bool = False, output_dir: str = "./output"):
        self.auto_confirm = auto_confirm
        self.output_dir = output_dir
        self.decisions: List[ReviewDecision] = []
    
    def _display_photo_info(self, photo: PhotoRecord, index: int, total: int):
        console.print(f"\n[bold cyan]照片 {index}/{total}[/bold cyan]")
        console.print(f"文件名: [yellow]{photo.metadata.file_name}[/yellow]")
        console.print(f"评分: [green]{photo.score:.1f}[/green]")
        
        if photo.score_reasons:
            console.print("评分原因:")
            for reason in photo.score_reasons:
                console.print(f"  - {reason}")
        
        if photo.status != PhotoStatus.PENDING:
            status_color = "red" if "remove" in photo.status.value else "green"
            console.print(f"当前状态: [{status_color}]{photo.status.value}[/{status_color}]")
            if photo.status_reason:
                console.print(f"状态原因: {photo.status_reason}")
        
        if photo.faces:
            console.print(f"检测到 [bold]{len(photo.faces)}[/bold] 张人脸:")
            for face in photo.faces:
                key_marker = "[bold yellow]★重点[/bold yellow]" if face.is_key_person else ""
                eye_status = "😐闭眼" if face.eyes_open is False else "😊睁眼"
                name = face.person_name or "未知人物"
                console.print(f"  - {name} {key_marker} {eye_status}")
        
        if photo.duplicate_group_id:
            console.print(f"重复组: [magenta]{photo.duplicate_group_id}[/magenta], 排名: {photo.duplicate_rank}")
    
    def review_single(self, photo: PhotoRecord, index: int, total: int) -> Optional[ReviewDecision]:
        self._display_photo_info(photo, index, total)
        
        if self.auto_confirm:
            keep = photo.status in [PhotoStatus.KEEP, PhotoStatus.PENDING]
            decision = ReviewDecision(photo_id=photo.photo_id, keep=keep)
            self.decisions.append(decision)
            return decision
        
        console.print("\n[bold]请选择操作:[/bold]")
        console.print("  k - 保留 (keep)")
        console.print("  r - 删除 (remove)")
        console.print("  s - 跳过 (skip)")
        console.print("  n - 添加备注 (note)")
        console.print("  q - 退出审核")
        
        while True:
            choice = Prompt.ask("选择操作", choices=["k", "r", "s", "n", "q"], default="s").lower()
            
            if choice == "q":
                return None
            elif choice == "s":
                return ReviewDecision(photo_id=photo.photo_id, keep=True, notes="跳过审核")
            elif choice == "n":
                note = Prompt.ask("请输入备注")
                photo.user_notes = note
                continue
            elif choice == "k":
                decision = ReviewDecision(photo_id=photo.photo_id, keep=True)
                self.decisions.append(decision)
                return decision
            elif choice == "r":
                reason = Prompt.ask("删除原因", default="手动删除")
                decision = ReviewDecision(photo_id=photo.photo_id, keep=False, notes=reason)
                self.decisions.append(decision)
                return decision
    
    def review_duplicates(self, group: DuplicateGroup) -> List[ReviewDecision]:
        group._select_best()
        
        console.print(f"\n[bold magenta]=== 重复组 {group.group_id} ===[/bold magenta]")
        console.print(f"共 {len(group.photos)} 张重复照片")
        
        table = Table(title="重复照片对比")
        table.add_column("序号", style="cyan")
        table.add_column("文件名", style="yellow")
        table.add_column("评分", style="green")
        table.add_column("人脸数", style="blue")
        table.add_column("重点人物", style="magenta")
        table.add_column("当前排名", style="red")
        
        for i, photo in enumerate(group.photos):
            key_persons = ", ".join([f.person_name for f in photo.faces if f.is_key_person]) or "-"
            is_best = "★" if photo.duplicate_rank == 0 else ""
            table.add_row(
                f"{i+1}{is_best}",
                photo.metadata.file_name,
                f"{photo.score:.1f}",
                str(len(photo.faces)),
                key_persons,
                str(photo.duplicate_rank)
            )
        
        console.print(table)
        
        if self.auto_confirm:
            decisions = []
            for photo in group.photos:
                keep = photo.duplicate_rank == 0
                if not keep:
                    photo.status = PhotoStatus.REMOVE_DUPLICATE
                    photo.status_reason = f"重复组{group.group_id}，保留第{photo.duplicate_rank}名"
                decisions.append(ReviewDecision(photo_id=photo.photo_id, keep=keep))
            return decisions
        
        console.print("\n[bold]默认保留排名第一的照片[/bold]")
        keep_all = Confirm.ask("是否保留全部照片?", default=False)
        
        if keep_all:
            return [ReviewDecision(photo_id=p.photo_id, keep=True) for p in group.photos]
        
        keep_index = Prompt.ask(
            "请输入要保留的照片序号 (1-{0})".format(len(group.photos)),
            default="1"
        )
        
        try:
            keep_idx = int(keep_index) - 1
        except ValueError:
            keep_idx = 0
        
        decisions = []
        for i, photo in enumerate(group.photos):
            keep = i == keep_idx
            decisions.append(ReviewDecision(photo_id=photo.photo_id, keep=keep))
        
        return decisions
    
    def apply_decisions(self, photos: List[PhotoRecord]) -> List[PhotoRecord]:
        photo_map = {p.photo_id: p for p in photos}
        
        for decision in self.decisions:
            photo = photo_map.get(decision.photo_id)
            if not photo:
                continue
            
            if decision.keep:
                photo.status = PhotoStatus.KEEP
                if decision.notes:
                    photo.user_notes = decision.notes
            else:
                if photo.status != PhotoStatus.REMOVE_DUPLICATE:
                    photo.status = PhotoStatus.REMOVE_MANUAL
                    photo.status_reason = decision.notes or "手动删除"
        
        for photo in photos:
            if photo.status == PhotoStatus.PENDING:
                photo.status = PhotoStatus.KEEP
                photo.status_reason = "自动保留"
        
        return photos
    
    def review_all(self, photos: List[PhotoRecord]) -> List[PhotoRecord]:
        console.print("\n[bold green]=== 开始人工审核 ===[/bold green]")
        console.print(f"共 {len(photos)} 张照片待审核")
        
        pending_photos = [p for p in photos if p.status != PhotoStatus.REMOVE_DUPLICATE]
        
        for i, photo in enumerate(track(pending_photos, description="审核进度"), 1):
            decision = self.review_single(photo, i, len(pending_photos))
            if decision is None:
                console.print("[yellow]用户中断审核[/yellow]")
                break
        
        return self.apply_decisions(photos)
    
    def batch_review_by_groups(self, duplicate_groups: List[DuplicateGroup]) -> List[ReviewDecision]:
        all_decisions = []
        
        for group in duplicate_groups:
            decisions = self.review_duplicates(group)
            all_decisions.extend(decisions)
        
        self.decisions.extend(all_decisions)
        return all_decisions
