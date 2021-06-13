pragma solidity ^0.7.0;

/*
    ERC20 Standard Token interface
*/
abstract contract IERC20Token {
	// these functions aren't abstract since the compiler emits automatically generated getter functions as external
	function name() public virtual view returns (string memory) {
		this;
	}

	function symbol() public virtual view returns (string memory) {
		this;
	}

	function decimals() public virtual view returns (uint8) {
		this;
	}

	function totalSupply() public virtual view returns (uint256) {
		this;
	}

	function balanceOf(address _owner) public virtual view returns (uint256) {
		_owner;
		this;
	}

	function allowance(address _owner, address _spender) public virtual view returns (uint256) {
		_owner;
		_spender;
		this;
	}

	function transfer(address _to, uint256 _value) public virtual returns (bool success);

	function transferFrom(
		address _from,
		address _to,
		uint256 _value
	) public virtual returns (bool success);

	function approve(address _spender, uint256 _value) public virtual returns (bool success);
}
