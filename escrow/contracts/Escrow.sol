// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20{function transferFrom(address from,address to,uint256 value)external returns(bool);function transfer(address to,uint256 value)external returns(bool);}

contract Escrow{
  address public buyer; address public seller; address public arbiter; address public token; // 0x0 => native XRP
  uint256 public amount; uint256 public deadline; bool public funded; bool public released; bool public refunded;
  bool public preApprovalOk; bool public inspectionOk;

  event Funded(address indexed from,uint256 value);
  event PreApprovalSet(bool ok);
  event InspectionSet(bool ok);
  event Released(address indexed to,uint256 value);
  event Refunded(address indexed to,uint256 value);

  modifier onlyBuyer(){require(msg.sender==buyer,"only buyer"); _;}
  modifier notDone(){require(!released && !refunded,"finalized"); _;}

  constructor(address _buyer,address _seller,address _arbiter,address _token,uint256 _amount,uint256 _deadline){
    require(_buyer!=address(0)&&_seller!=address(0),"bad parties");
    buyer=_buyer; seller=_seller; arbiter=_arbiter; token=_token; amount=_amount; deadline=_deadline;
  }

  function fund() external payable onlyBuyer notDone{
    require(!funded,"already funded");
    if(token==address(0)){require(msg.value==amount,"wrong native amount");}
    else{require(msg.value==0,"no native");require(IERC20(token).transferFrom(msg.sender,address(this),amount),"erc20 xferFrom failed");}
    funded=true; emit Funded(msg.sender,amount);
  }

  function setPreApproval(bool ok) external notDone{
    require(msg.sender==buyer||msg.sender==seller||msg.sender==arbiter,"not allowed");
    preApprovalOk=ok; emit PreApprovalSet(ok);
  }

  function setInspection(bool ok) external notDone{
    require(msg.sender==buyer||msg.sender==seller||msg.sender==arbiter,"not allowed");
    inspectionOk=ok; emit InspectionSet(ok);
  }

  function release() external notDone{
    require(funded,"not funded"); require(preApprovalOk && inspectionOk,"milestones not met");
    released=true;
    if(token==address(0)){(bool s,)=payable(seller).call{value:amount}(""); require(s,"native xfer fail");}
    else{require(IERC20(token).transfer(seller,amount),"erc20 xfer fail");}
    emit Released(seller,amount);
  }

  function refund() external notDone{
    require(funded,"not funded");
    require(block.timestamp>=deadline || (!preApprovalOk || !inspectionOk),"not refundable");
    refunded=true;
    if(token==address(0)){(bool s,)=payable(buyer).call{value:amount}(""); require(s,"native xfer fail");}
    else{require(IERC20(token).transfer(buyer,amount),"erc20 xfer fail");}
    emit Refunded(buyer,amount);
  }
}
