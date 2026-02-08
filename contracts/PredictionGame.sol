// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PredictionGame
 * @notice Price prediction game for Monexus on Monad
 * @dev Users bet UP or DOWN on MON/USD price in 5-minute rounds
 */
contract PredictionGame is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum Position { None, Up, Down }

    struct Round {
        uint256 epoch;
        uint256 startTimestamp;
        uint256 lockTimestamp;
        uint256 closeTimestamp;
        int256 lockPrice;
        int256 closePrice;
        uint256 totalAmount;
        uint256 upAmount;
        uint256 downAmount;
        bool resolved;
        bool cancelled;
    }

    struct BetInfo {
        Position position;
        uint256 amount;
        bool claimed;
    }

    uint256 public currentEpoch;
    uint256 public constant ROUND_DURATION = 300; // 5 minutes
    uint256 public constant LOCK_DURATION = 150;  // 2.5 min betting window
    uint256 public minBetAmount;
    uint256 public treasuryFee; // basis points, e.g. 300 = 3%
    uint256 public treasuryAmount;

    mapping(uint256 => Round) public rounds;
    mapping(uint256 => mapping(address => BetInfo)) public ledger;
    mapping(address => uint256[]) public userRounds;

    // Events
    event RoundStarted(uint256 indexed epoch, uint256 startTimestamp, uint256 lockTimestamp, uint256 closeTimestamp);
    event RoundLocked(uint256 indexed epoch, int256 lockPrice);
    event RoundResolved(uint256 indexed epoch, int256 closePrice);
    event RoundCancelled(uint256 indexed epoch);
    event BetPlaced(uint256 indexed epoch, address indexed sender, uint256 amount, Position position);
    event Claimed(uint256 indexed epoch, address indexed sender, uint256 amount);

    constructor(uint256 _minBetAmount, uint256 _treasuryFee) {
        require(_treasuryFee <= 1000, "Fee too high");
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        minBetAmount = _minBetAmount;
        treasuryFee = _treasuryFee;
    }

    /**
     * @notice Start a new round and lock the previous one
     * @param lockPrice The price to lock the previous round at (scaled 1e8)
     */
    function startRound(int256 lockPrice) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        // If there's an active round, lock it
        if (currentEpoch > 0) {
            Round storage prev = rounds[currentEpoch];
            require(block.timestamp >= prev.lockTimestamp, "Previous round not ready to lock");
            prev.lockPrice = lockPrice;
            emit RoundLocked(currentEpoch, lockPrice);
        }

        currentEpoch++;
        uint256 ts = block.timestamp;
        rounds[currentEpoch] = Round({
            epoch: currentEpoch,
            startTimestamp: ts,
            lockTimestamp: ts + LOCK_DURATION,
            closeTimestamp: ts + ROUND_DURATION,
            lockPrice: 0,
            closePrice: 0,
            totalAmount: 0,
            upAmount: 0,
            downAmount: 0,
            resolved: false,
            cancelled: false
        });
        emit RoundStarted(currentEpoch, ts, ts + LOCK_DURATION, ts + ROUND_DURATION);
    }

    function betUp(uint256 epoch) external payable nonReentrant whenNotPaused {
        _bet(epoch, Position.Up);
    }

    function betDown(uint256 epoch) external payable nonReentrant whenNotPaused {
        _bet(epoch, Position.Down);
    }

    function _bet(uint256 epoch, Position position) internal {
        require(msg.value >= minBetAmount, "Bet below minimum");
        require(epoch == currentEpoch, "Invalid epoch");
        Round storage round = rounds[epoch];
        require(block.timestamp < round.lockTimestamp, "Betting closed");
        require(!round.resolved && !round.cancelled, "Round not active");
        require(ledger[epoch][msg.sender].amount == 0, "Already bet");

        round.totalAmount += msg.value;
        if (position == Position.Up) {
            round.upAmount += msg.value;
        } else {
            round.downAmount += msg.value;
        }

        ledger[epoch][msg.sender] = BetInfo({
            position: position,
            amount: msg.value,
            claimed: false
        });
        userRounds[msg.sender].push(epoch);

        emit BetPlaced(epoch, msg.sender, msg.value, position);
    }

    /**
     * @notice Resolve a round with the final close price
     * @param epoch The round epoch to resolve
     * @param closePrice The closing price (scaled 1e8)
     */
    function resolveRound(uint256 epoch, int256 closePrice) external onlyRole(OPERATOR_ROLE) {
        Round storage round = rounds[epoch];
        require(!round.resolved && !round.cancelled, "Already finalized");
        require(block.timestamp >= round.closeTimestamp, "Round not ended");
        require(round.lockPrice != 0, "Round not locked");

        round.closePrice = closePrice;
        round.resolved = true;

        // Collect treasury fee
        uint256 fee = (round.totalAmount * treasuryFee) / 10000;
        treasuryAmount += fee;

        emit RoundResolved(epoch, closePrice);
    }

    /**
     * @notice Claim winnings for a resolved round
     * @param epoch The round epoch to claim
     */
    function claim(uint256 epoch) external nonReentrant {
        Round storage round = rounds[epoch];
        require(round.resolved, "Not resolved");
        BetInfo storage bet = ledger[epoch][msg.sender];
        require(bet.amount > 0, "No bet");
        require(!bet.claimed, "Already claimed");

        bet.claimed = true;

        uint256 reward = _calculateReward(epoch, msg.sender);
        require(reward > 0, "Not a winner");

        (bool success, ) = msg.sender.call{value: reward}("");
        require(success, "Transfer failed");

        emit Claimed(epoch, msg.sender, reward);
    }

    function _calculateReward(uint256 epoch, address user) internal view returns (uint256) {
        Round storage round = rounds[epoch];
        BetInfo storage bet = ledger[epoch][user];

        if (round.closePrice > round.lockPrice) {
            // UP wins
            if (bet.position != Position.Up) return 0;
            if (round.upAmount == 0) return 0;
            uint256 pool = round.totalAmount - (round.totalAmount * treasuryFee / 10000);
            return (bet.amount * pool) / round.upAmount;
        } else if (round.closePrice < round.lockPrice) {
            // DOWN wins
            if (bet.position != Position.Down) return 0;
            if (round.downAmount == 0) return 0;
            uint256 pool = round.totalAmount - (round.totalAmount * treasuryFee / 10000);
            return (bet.amount * pool) / round.downAmount;
        } else {
            // Tie — refund
            return bet.amount;
        }
    }

    function cancelRound(uint256 epoch) external onlyRole(OPERATOR_ROLE) {
        Round storage round = rounds[epoch];
        require(!round.resolved, "Already resolved");
        round.cancelled = true;
        emit RoundCancelled(epoch);
    }

    function claimRefund(uint256 epoch) external nonReentrant {
        Round storage round = rounds[epoch];
        require(round.cancelled, "Not cancelled");
        BetInfo storage bet = ledger[epoch][msg.sender];
        require(bet.amount > 0 && !bet.claimed, "No refund");
        bet.claimed = true;
        (bool success, ) = msg.sender.call{value: bet.amount}("");
        require(success, "Refund failed");
    }

    function claimTreasury() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 amount = treasuryAmount;
        treasuryAmount = 0;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }

    // ============================================
    // View Functions
    // ============================================

    function getRound(uint256 epoch) external view returns (Round memory) {
        return rounds[epoch];
    }

    function getUserBet(uint256 epoch, address user) external view returns (BetInfo memory) {
        return ledger[epoch][user];
    }

    function getUserRounds(address user) external view returns (uint256[] memory) {
        return userRounds[user];
    }

    function claimable(uint256 epoch, address user) external view returns (bool) {
        Round storage round = rounds[epoch];
        BetInfo storage bet = ledger[epoch][user];
        if (!round.resolved || bet.claimed || bet.amount == 0) return false;
        return _calculateReward(epoch, user) > 0;
    }

    function setMinBetAmount(uint256 _min) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minBetAmount = _min;
    }

    function setTreasuryFee(uint256 _fee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_fee <= 1000, "Fee too high");
        treasuryFee = _fee;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    receive() external payable {}
}
