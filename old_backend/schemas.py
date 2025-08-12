from pydantic import BaseModel
from enum import Enum
from typing import Optional, List

# Using an Enum provides strong type-checking for our deal types.
class DealType(str, Enum):
    SALE = "sale"
    RENTAL = "rental"

# --- Property Schemas ---
class PropertyBase(BaseModel):
    address: str
    price: float

class PropertyCreate(PropertyBase):
    owner_id: int

class PropertyRead(PropertyBase):
    id: int
    owner_id: int

# --- User Schemas ---
class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    pass

class UserRead(UserBase):
    id: int
    properties: List[PropertyRead] = []

# This is the base Pydantic model. It contains fields common to
# both creating and reading deals.
class DealBase(BaseModel):
    property_id: int 
    deal_type: DealType
    # The user only needs to specify the seller. The buyer is the server.
    seller_address: str
    amount_xrp: float

# This model is used specifically for CREATING a new deal.
# It inherits the fields from DealBase.
class DealCreate(DealBase):
    pass

# This model is used for READING/RETURNING deal data from the API.
# It includes all the fields from the database model that we want to expose.
class DealRead(DealBase):
    id: int
    status: str
    # We add the buyer_address here so the client can see who the buyer was.
    buyer_address: str
    # condition_hex: str
    creation_tx_hash: Optional[str] = None
    finish_tx_hash: Optional[str] = None

    class Config:
        orm_mode = True
