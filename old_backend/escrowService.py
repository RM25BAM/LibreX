from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session
import asyncio
import os
import hashlib
import datetime as dt

from xrpl.models import EscrowCreate, EscrowFinish, EscrowCancel
from xrpl.utils import xrp_to_drops, datetime_to_ripple_time
from xrpl.wallet import Wallet
# Correctly import async and sync functions from their specific modules
from xrpl.transaction import sign_and_submit
from database import Property, Deal

from config import client
from database import get_session, Deal
from schemas import DealCreate, DealRead

# This will be our dependency. It will be set by the main app on startup.
wallet: Wallet = None

router = APIRouter(prefix="/escrow", tags=["Escrow"])

@router.post("/initiate_escrow", response_model=DealRead)
def initiate_deal(deal_data: DealCreate, db: Session = Depends(get_session)):
    """
    Create a new deal in the database (off-chain).
    linked to a specific property.
    """
    if not wallet:
        raise HTTPException(status_code=503, detail="Server wallet not available for initiation.")

    # Look up the property to ensure it exists
    prop = db.get(Property, deal_data.property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # For this simplified flow, we generate the preimage but only store the condition.
    # A more advanced implementation might store the preimage securely.
    try:
        preimage = os.urandom(32)
        condition = hashlib.sha256(preimage).digest()

        deal = Deal(
            property_id=deal_data.property_id,
            deal_type=deal_data.deal_type,
            # ENFORCE that the buyer is the server's wallet
            buyer_address=wallet.classic_address,
            seller_address=deal_data.seller_address,
            amount_xrp=deal_data.amount_xrp,
            condition_hex=condition.hex().upper(),
            status="initiated"
        )
        db.add(deal)
        db.commit()
        db.refresh(deal)
        return deal
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{deal_id}/create-on-chain", response_model=DealRead)
def create_escrow_on_chain(deal_id: int, db: Session = Depends(get_session)):
    """
    Create the actual escrow on the XRP Ledger.
    Uses the condition generated in the initiation step.
    """
    if not wallet:
        raise HTTPException(status_code=503, detail="Server wallet not available.")
    
    deal = db.get(Deal, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found.")
    
    if deal.status != "initiated":
        raise HTTPException(status_code=400, detail="Deal is not in 'initiated' state.")

    try:
        # Step 0: Construct the transaction with the core details
        # cancel_time = datetime.now() + timedelta(days=1)
        escrow_tx = EscrowCreate(
            account=wallet.classic_address,
            amount=xrp_to_drops(deal.amount_xrp),
            destination=deal.seller_address,
            # condition=deal.condition_hex,
            finish_after=datetime_to_ripple_time(dt.datetime.utcnow() + dt.timedelta(hours=1)),
        )

        response = sign_and_submit(escrow_tx, client, wallet)
        tx_result = response.result

        print(f"SUBMIT RESPONSE ON CREATE: {tx_result}")
        
        if tx_result["engine_result"] == "tesSUCCESS":
            deal.creation_tx_hash = tx_result["tx_json"]["hash"]
            deal.offer_sequence = tx_result["tx_json"]["Sequence"]
            deal.status = "created_on_chain"
            db.add(deal)
            db.commit()
            db.refresh(deal)
        else:
            raise HTTPException(status_code=400, detail=f"XRPL transaction failed: {tx_result}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
    return deal


@router.post("/{deal_id}/finish-on-chain", response_model=DealRead)
def finish_escrow_on_chain(deal_id: int, db: Session = Depends(get_session)):
    """
    Step 3: Finish the escrow on the XRP Ledger by providing the secret fulfillment (preimage).
    """
    if not wallet:
        raise HTTPException(status_code=503, detail="Server wallet not available.")
        
    deal = db.get(Deal, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found.")

    if deal.status != "created_on_chain":
        raise HTTPException(status_code=400, detail="Escrow not created on-chain yet.")

    try:
        escrow_finish_tx = EscrowFinish(
            account=wallet.classic_address,
            owner=deal.buyer_address,
            offer_sequence=deal.offer_sequence,
            # condition=deal.condition_hex,
            # fulfillment=fulfillment_hex,
        )

        response = sign_and_submit(escrow_finish_tx, client, wallet)
        tx_result = response.result

        print("tx_result On Finish: ", tx_result)
        
        if tx_result["engine_result"] == "tesSUCCESS":
            deal.finish_tx_hash = tx_result["tx_json"]["hash"]
            deal.status = "finished_on_chain"
            db.add(deal)
            db.commit()
            db.refresh(deal)
        else:
            raise HTTPException(status_code=400, detail=f"XRPL transaction failed: {tx_result['engine_result_message']}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    return deal


@router.get("/cancel_escrow/{deal_id}", response_model=DealRead)
def cancel_escrow(deal_id: int, db: Session = Depends(get_session)):
    """
    Cancel the escrow on the XRP Ledger.
    """
    if not wallet:
        raise HTTPException(status_code=503, detail="Server wallet not available.")
        
    deal = db.get(Deal, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found.")
    
    if deal.status != "created_on_chain":
        raise HTTPException(status_code=400, detail="Escrow not created on-chain yet.")
    
    try:
        escrow_cancel_tx = EscrowCancel(
            account=wallet.classic_address,
            owner=wallet.classic_address,
            offer_sequence=deal.offer_sequence,
        )

        response = sign_and_submit(escrow_cancel_tx, client, wallet)
        tx_result = response.result

        print("tx_result On Cancel: ", tx_result)
        
        if tx_result["engine_result"] == "tesSUCCESS":
            deal.status = "cancelled_on_chain"
            db.add(deal)
            db.commit()
            db.refresh(deal)
        else:
            raise HTTPException(status_code=400, detail=f"XRPL transaction failed: {tx_result['engine_result_message']}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        