import csv
from typing import List, Optional
from datetime import datetime

from models.project import Project
from models.piece import PiecePlacement
from nesting.algorithm import NestingResult


class CSVExporter:
    def __init__(self):
        self.delimiter = ','
        self.encoding = 'utf-8'

    def export_pieces_list(
        self,
        filepath: str,
        project: Project,
        nesting_result: NestingResult = None
    ) -> bool:
        try:
            rows = self._generate_pieces_csv(project, nesting_result)
            
            with open(filepath, 'w', encoding=self.encoding, newline='') as f:
                writer = csv.writer(f, delimiter=self.delimiter)
                writer.writerows(rows)
            
            return True
        except Exception as e:
            print(f"导出 CSV 裁片清单失败: {e}")
            return False

    def _generate_pieces_csv(
        self,
        project: Project,
        nesting_result: NestingResult = None
    ) -> List[List]:
        rows = []
        
        rows.append(["纸样排料用布预估台 - 裁片清单"])
        rows.append(["生成时间", datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
        rows.append(["项目名称", project.name])
        rows.append([])
        
        if nesting_result:
            rows.append(["排料统计"])
            rows.append(["布料宽度 (cm)", project.fabric_settings.width])
            rows.append(["用布长度 (cm)", f"{nesting_result.fabric_length:.2f}"])
            rows.append(["余料率 (%)", f"{nesting_result.waste_rate:.1f}"])
            rows.append([])
        
        header = [
            "序号",
            "裁片ID",
            "裁片名称",
            "数量",
            "宽度 (cm)",
            "高度 (cm)",
            "面积 (cm²)",
            "颜色",
            "可旋转",
            "格纹对齐",
            "纹向 (°)"
        ]
        
        if nesting_result:
            header.extend(["位置 X (cm)", "位置 Y (cm)", "旋转角度 (°)", "镜像", "已放置"])
        
        rows.append(header)
        
        for idx, piece in enumerate(project.pieces, 1):
            row = [
                idx,
                piece.id,
                piece.name or f"裁片{idx}",
                piece.quantity,
                f"{piece.get_width():.1f}",
                f"{piece.get_height():.1f}",
                f"{piece.get_area():.1f}",
                piece.color,
                "是" if piece.can_rotate else "否",
                "是" if piece.has_plaid_match else "否",
                piece.grain_direction
            ]
            
            if nesting_result:
                placement = None
                for p in nesting_result.placements:
                    if p.piece.id == piece.id:
                        placement = p
                        break
                
                if placement:
                    row.extend([
                        f"{placement.position.x:.1f}",
                        f"{placement.position.y:.1f}",
                        placement.rotation,
                        "是" if placement.mirror else "否",
                        "是" if placement.is_placed else "否"
                    ])
                else:
                    row.extend(["", "", "", "", "否"])
            
            rows.append(row)
        
        rows.append([])
        rows.append(["汇总"])
        total_pieces = len(project.pieces)
        total_quantity = sum(p.quantity for p in project.pieces)
        total_area = sum(p.get_area() * p.quantity for p in project.pieces)
        
        rows.append(["裁片种类数", total_pieces])
        rows.append(["总数量", total_quantity])
        rows.append(["总面积 (cm²)", f"{total_area:.1f}"])
        
        if project.notes:
            rows.append([])
            rows.append(["备注"])
            rows.append([project.notes])
        
        return rows

    def export_nesting_details(
        self,
        filepath: str,
        project: Project,
        nesting_result: NestingResult
    ) -> bool:
        try:
            rows = []
            
            rows.append(["纸样排料用布预估台 - 排料详情"])
            rows.append(["生成时间", datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
            rows.append([])
            
            rows.append(["布料设置"])
            rows.append(["宽度 (cm)", project.fabric_settings.width])
            rows.append(["缩水率 X (%)", project.fabric_settings.shrinkage_x])
            rows.append(["缩水率 Y (%)", project.fabric_settings.shrinkage_y])
            rows.append(["安全边距 (cm)", project.fabric_settings.safety_margin])
            rows.append([])
            
            rows.append(["排料结果"])
            rows.append(["用布长度 (cm)", f"{nesting_result.fabric_length:.2f}"])
            rows.append(["有效面积 (cm²)", f"{nesting_result.used_area:.1f}"])
            rows.append(["布料总面积 (cm²)", f"{nesting_result.total_area:.1f}"])
            rows.append(["余料率 (%)", f"{nesting_result.waste_rate:.1f}"])
            rows.append(["排料状态", "成功" if nesting_result.is_successful else "部分成功"])
            if nesting_result.message:
                rows.append(["排料信息", nesting_result.message])
            rows.append([])
            
            rows.append(["裁片放置详情"])
            header = [
                "序号",
                "裁片ID",
                "裁片名称",
                "位置 X (cm)",
                "位置 Y (cm)",
                "旋转角度 (°)",
                "镜像",
                "宽度 (cm)",
                "高度 (cm)",
                "面积 (cm²)",
                "已放置"
            ]
            rows.append(header)
            
            for idx, placement in enumerate(nesting_result.placements, 1):
                piece = placement.piece
                row = [
                    idx,
                    piece.id,
                    piece.name or f"裁片{idx}",
                    f"{placement.position.x:.1f}",
                    f"{placement.position.y:.1f}",
                    placement.rotation,
                    "是" if placement.mirror else "否",
                    f"{piece.get_width():.1f}",
                    f"{piece.get_height():.1f}",
                    f"{piece.get_area():.1f}",
                    "是" if placement.is_placed else "否"
                ]
                rows.append(row)
            
            with open(filepath, 'w', encoding=self.encoding, newline='') as f:
                writer = csv.writer(f, delimiter=self.delimiter)
                writer.writerows(rows)
            
            return True
        except Exception as e:
            print(f"导出 CSV 排料详情失败: {e}")
            return False
