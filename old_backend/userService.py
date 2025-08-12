from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session, User
from schemas import UserCreate, UserRead

router = APIRouter(
    prefix="/users",
    tags=["Users"],
)

@router.post("/", response_model=UserRead)
def create_user(user: UserCreate, db: Session = Depends(get_session)):
    db_user = User.from_orm(user)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.get("/", response_model=list[UserRead])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_session)):
    users = db.exec(select(User).offset(skip).limit(limit)).all()
    return users
