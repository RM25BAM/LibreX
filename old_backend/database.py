from typing import Optional, List
from sqlmodel import Field, SQLModel, create_engine, Session, Relationship
from schemas import DealType # Import the enum


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    # This creates a one-to-many relationship: one user can own many properties.
    properties: List["Property"] = Relationship(back_populates="owner")

class Property(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    address: str
    price: float
    
    # Foreign key to link to the User table
    owner_id: int = Field(foreign_key="user.id")
    # This creates the other side of the one-to-many relationship.
    owner: User = Relationship(back_populates="properties")
    
    # One property can be involved in many deals.
    deals: List["Deal"] = Relationship(back_populates="property")


class Deal(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Foreign key to link to the Property table
    property_id: int = Field(foreign_key="property.id")
    # This links a deal to one specific property.
    property: Property = Relationship(back_populates="deals")

    deal_type: DealType
    buyer_address: str # This is the XRPL address for payment
    seller_address: str # This is the XRPL address for receiving funds
    amount_xrp: float
    
    # Status tracking for our internal app
    status: str = Field(default="initiated") # e.g., initiated, created_on_chain, finished_on_chain
    
    # On-chain transaction details, filled in as they happen
    creation_tx_hash: Optional[str] = None
    offer_sequence: Optional[int] = None
    finish_tx_hash: Optional[str] = None


# The database file will be `database.db` in the same directory
sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

# The engine is the main entry point to our database
engine = create_engine(sqlite_url, echo=True)


def create_db_and_tables():
    # This function creates the database and the Deal table if they don't exist
    SQLModel.metadata.create_all(engine)


def get_session():
    # This function gives us a database session to use in our API endpoints
    with Session(engine) as session:
        yield session
