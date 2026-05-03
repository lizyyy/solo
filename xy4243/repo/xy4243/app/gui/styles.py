from tkinter import ttk
from typing import Dict, Any


class AppStyles:

    COLORS = {
        "primary": "#2196F3",
        "primary_dark": "#1976D2",
        "primary_light": "#BBDEFB",
        "accent": "#FF4081",
        "success": "#4CAF50",
        "warning": "#FF9800",
        "danger": "#F44336",
        "critical": "#D32F2F",
        "background": "#FAFAFA",
        "surface": "#FFFFFF",
        "text": "#212121",
        "text_secondary": "#757575",
        "divider": "#BDBDBD",
        "status_pending": "#9E9E9E",
        "status_ready": "#2196F3",
        "status_in_use": "#FF9800",
        "status_returned": "#4CAF50",
        "status_verified": "#8BC34A",
        "status_lost": "#F44336",
        "status_missing": "#FF5722",
    }

    @classmethod
    def configure_ttk_styles(cls):
        style = ttk.Style()

        style.configure(
            "Title.TLabel",
            font=("Microsoft YaHei UI", 16, "bold"),
            foreground=cls.COLORS["text"],
        )

        style.configure(
            "Header.TLabel",
            font=("Microsoft YaHei UI", 12, "bold"),
            foreground=cls.COLORS["text"],
        )

        style.configure(
            "Subheader.TLabel",
            font=("Microsoft YaHei UI", 10, "bold"),
            foreground=cls.COLORS["text_secondary"],
        )

        style.configure(
            "Success.TLabel",
            foreground=cls.COLORS["success"],
        )

        style.configure(
            "Warning.TLabel",
            foreground=cls.COLORS["warning"],
        )

        style.configure(
            "Danger.TLabel",
            foreground=cls.COLORS["danger"],
        )

        style.configure(
            "Critical.TLabel",
            foreground=cls.COLORS["critical"],
            font=("Microsoft YaHei UI", 9, "bold"),
        )

        style.configure(
            "Accent.TButton",
            font=("Microsoft YaHei UI", 10),
        )

        style.configure(
            "Danger.TButton",
            font=("Microsoft YaHei UI", 10),
        )

        style.configure(
            "Success.TButton",
            font=("Microsoft YaHei UI", 10),
        )

        style.configure(
            "Card.TFrame",
            background=cls.COLORS["surface"],
        )

        style.configure(
            "Status.TLabel",
            font=("Microsoft YaHei UI", 9),
            padding=(8, 2),
        )

        style.configure(
            "Treeview",
            font=("Microsoft YaHei UI", 9),
            rowheight=24,
        )

        style.configure(
            "Treeview.Heading",
            font=("Microsoft YaHei UI", 9, "bold"),
        )

    @classmethod
    def get_status_color(cls, status: str) -> str:
        status_map = {
            "PENDING": cls.COLORS["status_pending"],
            "READY": cls.COLORS["status_ready"],
            "IN_USE": cls.COLORS["status_in_use"],
            "RETURNED": cls.COLORS["status_returned"],
            "VERIFIED": cls.COLORS["status_verified"],
            "LOST": cls.COLORS["status_lost"],
            "MISSING": cls.COLORS["status_missing"],
        }
        return status_map.get(status.upper(), cls.COLORS["text_secondary"])

    @classmethod
    def get_severity_color(cls, severity: str) -> str:
        severity_map = {
            "critical": cls.COLORS["critical"],
            "high": cls.COLORS["danger"],
            "medium": cls.COLORS["warning"],
            "low": cls.COLORS["text_secondary"],
        }
        return severity_map.get(severity.lower(), cls.COLORS["text_secondary"])

    @classmethod
    def get_danger_level_color(cls, level: str) -> str:
        level_map = {
            "SAFE": cls.COLORS["success"],
            "LOW": cls.COLORS["warning"],
            "MEDIUM": cls.COLORS["warning"],
            "HIGH": cls.COLORS["danger"],
            "CRITICAL": cls.COLORS["critical"],
        }
        return level_map.get(level.upper(), cls.COLORS["text_secondary"])

    @classmethod
    def get_status_display(cls, status: str) -> str:
        display_map = {
            "PENDING": "待处理",
            "READY": "准备就绪",
            "IN_USE": "使用中",
            "RETURNED": "已归还",
            "VERIFIED": "已复核",
            "LOST": "遗失",
            "MISSING": "丢失",
        }
        return display_map.get(status.upper(), status)

    @classmethod
    def get_severity_display(cls, severity: str) -> str:
        display_map = {
            "critical": "严重",
            "high": "高",
            "medium": "中",
            "low": "低",
        }
        return display_map.get(severity.lower(), severity)

    @classmethod
    def get_danger_level_display(cls, level: str) -> str:
        display_map = {
            "SAFE": "安全",
            "LOW": "低危",
            "MEDIUM": "中危",
            "HIGH": "高危",
            "CRITICAL": "极危",
        }
        return display_map.get(level.upper(), level)
