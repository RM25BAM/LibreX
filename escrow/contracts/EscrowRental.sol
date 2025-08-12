// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20R{function transferFrom(address from,address to,uint256 value)external returns(bool);function transfer(address to,uint256 value)external returns(bool);}

contract EscrowRental{
  address public tenant; address public landlord; address public arbiter; address public token;
  uint256 public deposit; uint256 public leaseEnd; bool public funded; bool public leaseSigned; bool public depositReleased; bool public depositReturned;

  event DepositFunded(address indexed from,uint256 value);
  event LeaseSignedSet(bool signed);
  event DepositReleasedToLandlord(address indexed to,uint256 value);
  event DepositReturnedToTenant(address indexed to,uint256 value);

  modifier onlyTenant(){require(msg.sender==tenant,"only tenant"); _;}
  modifier notFinal(){require(!depositReleased && !depositReturned,"finalized"); _;}

  constructor(address _tenant,address _landlord,address _arbiter,address _token,uint256 _deposit,uint256 _leaseEnd){
    require(_tenant!=address(0)&&_landlord!=address(0),"bad parties");
    tenant=_tenant; landlord=_landlord; arbiter=_arbiter; token=_token; deposit=_deposit; leaseEnd=_leaseEnd;
  }

  function fundDeposit() external payable onlyTenant notFinal{
    require(!funded,"already funded");
    if(token==address(0)){require(msg.value==deposit,"wrong native amount");}
    else{require(msg.value==0,"no native");require(IERC20R(token).transferFrom(msg.sender,address(this),deposit),"erc20 xferFrom failed");}
    funded=true; emit DepositFunded(msg.sender,deposit);
  }

  function setLeaseSigned(bool s) external{
    require(msg.sender==tenant||msg.sender==landlord||msg.sender==arbiter,"not allowed");
    leaseSigned=s; emit LeaseSignedSet(s);
  }

  function releaseDepositToLandlord() external notFinal{
    require(funded,"not funded"); require(block.timestamp>=leaseEnd,"too early"); require(leaseSigned,"lease not signed");
    depositReleased=true;
    if(token==address(0)){(bool ok,)=payable(landlord).call{value:deposit}(""); require(ok,"native xfer fail");}
    else{require(IERC20R(token).transfer(landlord,deposit),"erc20 xfer fail");}
    emit DepositReleasedToLandlord(landlord,deposit);
  }

  function returnDeposit() external notFinal{
    require(funded,"not funded"); require(block.timestamp>=leaseEnd,"too early");
    depositReturned=true;
    if(token==address(0)){(bool ok,)=payable(tenant).call{value:deposit}(""); require(ok,"native xfer fail");}
    else{require(IERC20R(token).transfer(tenant,deposit),"erc20 xfer fail");}
    emit DepositReturnedToTenant(tenant,deposit);
  }
}
