from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any, Tuple
from geopy.distance import geodesic
from ..models.grid import FarmGrid, GridStatus
from ..models.lesion import LesionRecord
from ..schemas.grid import FarmGridCreate, FarmGridUpdate, CoordinateSearchResponse
from ..schemas.common import PageResponse
from ..config import settings


class GridService:
    def __init__(self):
        self._grid_cache = {}
    
    def create_grid(self, db: Session, grid_data: FarmGridCreate) -> FarmGrid:
        existing = db.query(FarmGrid).filter(
            FarmGrid.grid_code == grid_data.grid_code
        ).first()
        if existing:
            raise ValueError(f"地块编号【{grid_data.grid_code}】已存在，请检查后重试")
        
        grid = FarmGrid(
            grid_code=grid_data.grid_code,
            grid_name=grid_data.grid_name,
            parent_grid_code=grid_data.parent_grid_code,
            crop_type=grid_data.crop_type,
            planting_date=grid_data.planting_date,
            area_mu=grid_data.area_mu,
            area_km2=grid_data.area_km2,
            center_longitude=grid_data.center_longitude,
            center_latitude=grid_data.center_latitude,
            boundary_coordinates=[p.model_dump() for p in grid_data.boundary_coordinates] if grid_data.boundary_coordinates else None,
            grid_level=grid_data.grid_level,
            grid_index_x=grid_data.grid_index_x,
            grid_index_y=grid_data.grid_index_y,
            region=grid_data.region,
            village=grid_data.village,
            farmer_name=grid_data.farmer_name,
            farmer_phone=grid_data.farmer_phone,
            status=GridStatus.ACTIVE,
            created_by=grid_data.created_by,
            remark=grid_data.remark
        )
        
        db.add(grid)
        db.commit()
        db.refresh(grid)
        
        return grid
    
    def get_grid_by_code(self, db: Session, grid_code: str) -> Optional[FarmGrid]:
        return db.query(FarmGrid).filter(FarmGrid.grid_code == grid_code).first()
    
    def get_grid_by_id(self, db: Session, grid_id: int) -> Optional[FarmGrid]:
        return db.query(FarmGrid).filter(FarmGrid.id == grid_id).first()
    
    def update_grid(self, db: Session, grid_code: str, update_data: FarmGridUpdate) -> Optional[FarmGrid]:
        grid = self.get_grid_by_code(db, grid_code)
        if not grid:
            return None
        
        update_dict = update_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            if value is not None:
                if key == "boundary_coordinates" and value:
                    value = [p.model_dump() for p in value]
                setattr(grid, key, value)
        
        db.commit()
        db.refresh(grid)
        
        return grid
    
    def delete_grid(self, db: Session, grid_code: str) -> bool:
        grid = self.get_grid_by_code(db, grid_code)
        if not grid:
            return False
        
        db.delete(grid)
        db.commit()
        
        return True
    
    def list_grids(
        self, 
        db: Session, 
        page: int = 1, 
        page_size: int = 20,
        status: Optional[GridStatus] = None,
        region: Optional[str] = None,
        crop_type: Optional[str] = None,
        keyword: Optional[str] = None
    ) -> PageResponse:
        query = db.query(FarmGrid)
        
        if status:
            query = query.filter(FarmGrid.status == status)
        
        if region:
            query = query.filter(FarmGrid.region.like(f"%{region}%"))
        
        if crop_type:
            query = query.filter(FarmGrid.crop_type.like(f"%{crop_type}%"))
        
        if keyword:
            query = query.filter(
                (FarmGrid.grid_code.like(f"%{keyword}%")) |
                (FarmGrid.grid_name.like(f"%{keyword}%")) |
                (FarmGrid.village.like(f"%{keyword}%"))
            )
        
        total = query.count()
        total_pages = (total + page_size - 1) // page_size
        
        items = query.order_by(FarmGrid.created_at.desc()).offset(
            (page - 1) * page_size
        ).limit(page_size).all()
        
        return PageResponse(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            items=items
        )
    
    def calculate_distance(
        self, 
        lon1: float, 
        lat1: float, 
        lon2: float, 
        lat2: float
    ) -> float:
        point1 = (lat1, lon1)
        point2 = (lat2, lon2)
        return geodesic(point1, point2).meters
    
    def is_point_in_polygon(
        self, 
        point_lon: float, 
        point_lat: float, 
        boundary_points: List[Dict[str, float]]
    ) -> bool:
        if not boundary_points or len(boundary_points) < 3:
            return False
        
        n = len(boundary_points)
        inside = False
        
        x, y = point_lon, point_lat
        
        p1 = boundary_points[0]
        x1, y1 = p1["longitude"], p1["latitude"]
        
        for i in range(n + 1):
            p2 = boundary_points[i % n]
            x2, y2 = p2["longitude"], p2["latitude"]
            
            if y > min(y1, y2):
                if y <= max(y1, y2):
                    if x <= max(x1, x2):
                        if y1 != y2:
                            xinters = (y - y1) * (x2 - x1) / (y2 - y1) + x1
                        if x1 == x2 or x <= xinters:
                            inside = not inside
            x1, y1 = x2, y2
        
        return inside
    
    def find_grid_by_coordinate(
        self, 
        db: Session, 
        longitude: float, 
        latitude: float,
        max_search_radius_meters: float = 100.0
    ) -> CoordinateSearchResponse:
        all_grids = db.query(FarmGrid).filter(
            FarmGrid.status == GridStatus.ACTIVE
        ).all()
        
        if not all_grids:
            return CoordinateSearchResponse(
                found=False,
                grid=None,
                distance_meters=None,
                message="未找到任何有效的地块数据"
            )
        
        matching_grid = None
        min_distance = float('inf')
        
        for grid in all_grids:
            if grid.boundary_coordinates:
                if self.is_point_in_polygon(longitude, latitude, grid.boundary_coordinates):
                    distance = self.calculate_distance(
                        longitude, latitude,
                        grid.center_longitude, grid.center_latitude
                    )
                    return CoordinateSearchResponse(
                        found=True,
                        grid=grid,
                        distance_meters=round(distance, 2),
                        message=f"精确匹配到地块【{grid.grid_code} - {grid.grid_name}】，坐标位于地块边界内"
                    )
            
            distance = self.calculate_distance(
                longitude, latitude,
                grid.center_longitude, grid.center_latitude
            )
            
            if distance < min_distance and distance <= max_search_radius_meters:
                min_distance = distance
                matching_grid = grid
        
        if matching_grid:
            return CoordinateSearchResponse(
                found=True,
                grid=matching_grid,
                distance_meters=round(min_distance, 2),
                message=f"最近匹配到地块【{matching_grid.grid_code} - {matching_grid.grid_name}】，距离地块中心点{round(min_distance, 2)}米"
            )
        
        return CoordinateSearchResponse(
            found=False,
            grid=None,
            distance_meters=None,
            message=f"在搜索半径{max_search_radius_meters}米内未找到匹配的地块，请检查坐标是否正确"
        )
    
    def match_lesion_to_grid(
        self,
        db: Session,
        lesion_record: LesionRecord,
        auto_save: bool = True
    ) -> Dict[str, Any]:
        search_result = self.find_grid_by_coordinate(
            db,
            lesion_record.longitude,
            lesion_record.latitude
        )
        
        match_info = {
            "found": search_result.found,
            "grid_id": search_result.grid.id if search_result.grid else None,
            "grid_code": search_result.grid.grid_code if search_result.grid else None,
            "grid_name": search_result.grid.grid_name if search_result.grid else None,
            "distance_meters": search_result.distance_meters,
            "match_method": "精确匹配" if "精确匹配" in search_result.message else "最近匹配" if search_result.found else "未匹配",
            "message": search_result.message
        }
        
        if auto_save and search_result.found and search_result.grid:
            lesion_record.grid_id = search_result.grid.id
            lesion_record.grid_code = search_result.grid.grid_code
            lesion_record.grid_name = search_result.grid.grid_name
            db.commit()
        
        return match_info
    
    def batch_match_lesions_to_grid(
        self,
        db: Session,
        batch_id: int
    ) -> Dict[str, Any]:
        from ..models.lesion import LesionRecord
        
        lesions = db.query(LesionRecord).filter(
            LesionRecord.batch_id == batch_id,
            LesionRecord.grid_id.is_(None)
        ).all()
        
        if not lesions:
            return {
                "total_processed": 0,
                "matched_count": 0,
                "unmatched_count": 0,
                "message": "该批次没有需要匹配地块的病斑记录"
            }
        
        matched_count = 0
        unmatched_count = 0
        match_details = []
        
        for lesion in lesions:
            match_info = self.match_lesion_to_grid(db, lesion, auto_save=True)
            
            if match_info["found"]:
                matched_count += 1
            else:
                unmatched_count += 1
            
            match_details.append({
                "lesion_code": lesion.lesion_code,
                "longitude": lesion.longitude,
                "latitude": lesion.latitude,
                **match_info
            })
        
        return {
            "total_processed": len(lesions),
            "matched_count": matched_count,
            "unmatched_count": unmatched_count,
            "match_rate": round(matched_count / len(lesions) * 100, 2) if lesions else 0,
            "message": f"批量匹配完成：共处理{len(lesions)}条记录，成功匹配{matched_count}条，未匹配{unmatched_count}条，匹配率{round(matched_count / len(lesions) * 100, 2) if lesions else 0}%",
            "details": match_details
        }


grid_service = GridService()
