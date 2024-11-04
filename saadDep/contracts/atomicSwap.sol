// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IERC20.sol";
import "./UniV2Library.sol";

interface IWeth is IERC20 {
    function withdraw(uint256 wad) external;
}

contract AtomicSwap {
    address public WETH;
    address private owner;
    IWeth private weth;

    constructor(address _weth) {
        WETH = _weth;
        weth = IWeth(_weth);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not allowed");
        _;
    }
    
    receive() external payable {
        require(msg.value > 0, "Must send ETH");
    }

    fallback() external payable {
        revert("Function does not exist");
    }

    function liquidate() external onlyOwner {
        weth.transfer(owner, weth.balanceOf(address(this)));
    }

    // perform swap from sender's account
    function _swap(
        uint256 amount0Out, // param to pair.swap
        uint256 amount1Out, // param to pair.swap
        address tokenInAddress, // address of token that searcher sends to swap
        address pairAddress, // univ2 pair address to execute swap
        address recipient, // address that receives the tokens
        bool fromThis // flag to swap from this contract
    ) internal {
        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
        IERC20 tokenIn = IERC20(tokenInAddress);

        uint256 transferAmount = pair.token0() == tokenInAddress
            ? amount0Out
            : amount1Out;

        require(
            fromThis
                ? tokenIn.transfer(pairAddress, transferAmount)
                : tokenIn.transferFrom(msg.sender, pairAddress, transferAmount),
            "transfer failed"
        );
        pair.swap(
            amount0Out == transferAmount ? 0 : amount0Out,
            amount1Out == transferAmount ? 0 : amount1Out,
            recipient,
            new bytes(0)
        );
    }

    function swap(
        address[] memory path,
        uint256 amountIn,
        uint256 amountOutMin,
        address factory,
        address recipient,
        bool fromThis
    ) public {

        // Get reserves for the first pair in the path
        (uint256 reserveIn, uint256 reserveOut) = UniswapV2Library.getReserves(
            factory,
            path[0],
            path[1]
        );

        // Calculate the output amount using getAmountOut
        uint256 amountOut = UniswapV2Library.getAmountOut(
            amountIn,
            reserveIn,
            reserveOut
        );

        // Slippage protection
        require(
            amountOut >= amountOutMin,
            "AtomicSwap: INSUFFICIENT_OUTPUT_AMOUNT"
        );

        IUniswapV2Pair pair = IUniswapV2Pair(
            IUniswapV2Factory(factory).getPair(path[0], path[1])
        );
        // path-wise amounts
        uint256[] memory amounts = UniswapV2Library.getAmountsOut(
            factory,
            amountIn,
            path
        );
        _swap(
            pair.token0() == path[0] ? amounts[0] : amounts[1],
            pair.token0() == path[0] ? amounts[1] : amounts[0],
            path[0],
            address(pair),
            recipient,
            fromThis
        );
    }

}
