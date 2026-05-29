from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Artist, ArtistAvailability
from app.schemas import ArtistCreate, ArtistRead, ArtistAvailabilityCreate, ArtistAvailabilityRead, ErrorResponse

router = APIRouter(prefix="/artists", tags=["artists"])


@router.get("/", response_model=List[ArtistRead])
def list_artists(db: Session = Depends(get_db)):
    return db.query(Artist).order_by(Artist.id).all()


@router.get("/{artist_id}", response_model=ArtistRead, responses={404: {"model": ErrorResponse}})
def get_artist(artist_id: int, db: Session = Depends(get_db)):
    artist = db.query(Artist).get(artist_id)
    if not artist:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "艺人不存在", "detail": f"artist_id={artist_id}"})
    return artist


@router.post("/", response_model=ArtistRead, status_code=201)
def create_artist(data: ArtistCreate, db: Session = Depends(get_db)):
    artist = Artist(**data.model_dump())
    db.add(artist)
    db.commit()
    db.refresh(artist)
    return artist


@router.put("/{artist_id}", response_model=ArtistRead, responses={404: {"model": ErrorResponse}})
def update_artist(artist_id: int, data: ArtistCreate, db: Session = Depends(get_db)):
    artist = db.query(Artist).get(artist_id)
    if not artist:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "艺人不存在", "detail": f"artist_id={artist_id}"})
    for k, v in data.model_dump().items():
        setattr(artist, k, v)
    db.commit()
    db.refresh(artist)
    return artist


@router.post("/{artist_id}/availability", response_model=ArtistAvailabilityRead, status_code=201, responses={404: {"model": ErrorResponse}})
def add_availability(artist_id: int, data: ArtistAvailabilityCreate, db: Session = Depends(get_db)):
    artist = db.query(Artist).get(artist_id)
    if not artist:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "艺人不存在", "detail": f"artist_id={artist_id}"})
    avail = ArtistAvailability(artist_id=artist_id, **data.model_dump())
    db.add(avail)
    db.commit()
    db.refresh(avail)
    return avail


@router.get("/{artist_id}/availability", response_model=List[ArtistAvailabilityRead], responses={404: {"model": ErrorResponse}})
def list_availability(artist_id: int, db: Session = Depends(get_db)):
    artist = db.query(Artist).get(artist_id)
    if not artist:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "艺人不存在", "detail": f"artist_id={artist_id}"})
    return artist.availability_windows
