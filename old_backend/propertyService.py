from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session, Property
from schemas import PropertyCreate, PropertyRead

router = APIRouter(
    prefix="/properties",
    tags=["Properties"],
)

@router.post("/", response_model=PropertyRead)
def create_property(prop: PropertyCreate, db: Session = Depends(get_session)):
    db_property = Property.from_orm(prop)
    db.add(db_property)
    db.commit()
    db.refresh(db_property)
    return db_property

@router.get("/", response_model=list[PropertyRead])
def read_properties(skip: int = 0, limit: int = 100, db: Session = Depends(get_session)):
    properties = db.exec(select(Property).offset(skip).limit(limit)).all()
    return properties
