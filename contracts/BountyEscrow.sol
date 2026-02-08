// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BountyEscrow
 * @notice Escrow contract for the Monexus bounty system on Monad
 * @dev Handles bounty creation, winner selection, payouts, and dispute resolution
 */
contract BountyEscrow is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    enum BountyStatus {
        Active,
        Completed,
        Cancelled,
        Disputed
    }

    struct Bounty {
        address creator;
        uint256 amount;
        uint256 deadline;
        uint256 maxWinners;
        BountyStatus status;
        uint256 remainingAmount;
        bool splitEqually;
    }

    struct Winner {
        address winner;
        uint256 amount;
        bool paid;
    }

    // State variables
    uint256 public bountyCounter;
    uint256 public platformFee; // In basis points (100 = 1%)
    address public feeRecipient;
    uint256 public totalBountiesCreated;
    uint256 public totalPayouts;

    // Mappings
    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => Winner[]) public bountyWinners;
    mapping(uint256 => mapping(address => bool)) public hasSubmitted;
    mapping(uint256 => bool) public disputeResolved;
    mapping(address => uint256) public creatorBountyCount;
    mapping(address => uint256) public contributorEarnings;

    // Events
    event BountyCreated(
        uint256 indexed bountyId,
        address indexed creator,
        uint256 amount,
        uint256 deadline,
        uint256 maxWinners
    );
    event BountyFunded(uint256 indexed bountyId, uint256 amount);
    event SubmissionRegistered(uint256 indexed bountyId, address indexed contributor);
    event WinnerSelected(uint256 indexed bountyId, address indexed winner, uint256 amount);
    event PayoutExecuted(uint256 indexed bountyId, address indexed winner, uint256 amount);
    event BountyCancelled(uint256 indexed bountyId, uint256 refundAmount);
    event DisputeRaised(uint256 indexed bountyId, address indexed disputant);
    event DisputeResolved(uint256 indexed bountyId, bool inFavorOfContributor);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    /**
     * @notice Initialize the contract with platform fee and fee recipient
     * @param _platformFee Initial platform fee in basis points (e.g., 250 = 2.5%)
     * @param _feeRecipient Address to receive platform fees
     */
    constructor(uint256 _platformFee, address _feeRecipient) {
        require(_platformFee <= 1000, "Fee too high"); // Max 10%
        require(_feeRecipient != address(0), "Invalid fee recipient");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ARBITER_ROLE, msg.sender);

        platformFee = _platformFee;
        feeRecipient = _feeRecipient;
    }

    /**
     * @notice Create a new bounty with MON deposit
     * @param deadline Timestamp when the bounty expires
     * @param maxWinners Maximum number of winners allowed
     * @param splitEqually Whether to split the bounty equally among winners
     * @return bountyId The ID of the created bounty
     */
    function createBounty(
        uint256 deadline,
        uint256 maxWinners,
        bool splitEqually
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        require(msg.value > 0, "Must deposit MON");
        require(deadline > block.timestamp, "Invalid deadline");
        require(maxWinners > 0, "Must have at least 1 winner");

        uint256 bountyId = bountyCounter++;

        bounties[bountyId] = Bounty({
            creator: msg.sender,
            amount: msg.value,
            deadline: deadline,
            maxWinners: maxWinners,
            status: BountyStatus.Active,
            remainingAmount: msg.value,
            splitEqually: splitEqually
        });

        creatorBountyCount[msg.sender]++;
        totalBountiesCreated++;

        emit BountyCreated(bountyId, msg.sender, msg.value, deadline, maxWinners);
        return bountyId;
    }

    /**
     * @notice Add more funds to an existing bounty
     * @param bountyId The ID of the bounty to fund
     */
    function addFunds(uint256 bountyId) external payable nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        require(bounty.status == BountyStatus.Active, "Bounty not active");
        require(msg.value > 0, "Must deposit MON");

        bounty.amount += msg.value;
        bounty.remainingAmount += msg.value;

        emit BountyFunded(bountyId, msg.value);
    }

    /**
     * @notice Register a submission for a bounty (called by backend after off-chain storage)
     * @param bountyId The ID of the bounty
     * @param contributor The address of the contributor
     */
    function registerSubmission(
        uint256 bountyId,
        address contributor
    ) external onlyRole(ADMIN_ROLE) {
        Bounty storage bounty = bounties[bountyId];
        require(bounty.status == BountyStatus.Active, "Bounty not active");
        require(block.timestamp <= bounty.deadline, "Deadline passed");
        require(!hasSubmitted[bountyId][contributor], "Already submitted");
        require(contributor != address(0), "Invalid contributor");

        hasSubmitted[bountyId][contributor] = true;
        emit SubmissionRegistered(bountyId, contributor);
    }

    /**
     * @notice Select winners for a bounty (creator only)
     * @param bountyId The ID of the bounty
     * @param winners Array of winner addresses
     * @param amounts Array of amounts for each winner
     */
    function selectWinners(
        uint256 bountyId,
        address[] calldata winners,
        uint256[] calldata amounts
    ) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        require(msg.sender == bounty.creator, "Only creator");
        require(bounty.status == BountyStatus.Active, "Bounty not active");
        require(winners.length > 0 && winners.length <= bounty.maxWinners, "Invalid winners count");
        require(winners.length == amounts.length, "Length mismatch");

        uint256 totalPayout = 0;
        for (uint256 i = 0; i < winners.length; i++) {
            require(hasSubmitted[bountyId][winners[i]], "Not a contributor");
            require(amounts[i] > 0, "Invalid amount");
            require(winners[i] != address(0), "Invalid winner address");
            totalPayout += amounts[i];

            bountyWinners[bountyId].push(Winner({
                winner: winners[i],
                amount: amounts[i],
                paid: false
            }));

            emit WinnerSelected(bountyId, winners[i], amounts[i]);
        }

        require(totalPayout <= bounty.remainingAmount, "Insufficient funds");
        bounty.remainingAmount -= totalPayout;
        bounty.status = BountyStatus.Completed;
    }

    /**
     * @notice Execute payouts to all winners of a bounty
     * @param bountyId The ID of the bounty
     */
    function executePayout(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        require(
            bounty.status == BountyStatus.Completed ||
            (bounty.status == BountyStatus.Disputed && disputeResolved[bountyId]),
            "Cannot payout"
        );

        Winner[] storage winners = bountyWinners[bountyId];

        for (uint256 i = 0; i < winners.length; i++) {
            if (!winners[i].paid && winners[i].amount > 0) {
                winners[i].paid = true;

                // Calculate fee
                uint256 fee = (winners[i].amount * platformFee) / 10000;
                uint256 payout = winners[i].amount - fee;

                // Transfer fee
                if (fee > 0) {
                    (bool feeSuccess, ) = feeRecipient.call{value: fee}("");
                    require(feeSuccess, "Fee transfer failed");
                }

                // Transfer payout
                (bool success, ) = winners[i].winner.call{value: payout}("");
                require(success, "Payout failed");

                contributorEarnings[winners[i].winner] += payout;
                totalPayouts += payout;

                emit PayoutExecuted(bountyId, winners[i].winner, payout);
            }
        }
    }

    /**
     * @notice Cancel a bounty and refund the creator (only if no winners selected)
     * @param bountyId The ID of the bounty to cancel
     */
    function cancelBounty(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        require(
            msg.sender == bounty.creator || hasRole(ADMIN_ROLE, msg.sender),
            "Unauthorized"
        );
        require(bounty.status == BountyStatus.Active, "Cannot cancel");
        require(bountyWinners[bountyId].length == 0, "Winners already selected");

        bounty.status = BountyStatus.Cancelled;
        uint256 refundAmount = bounty.remainingAmount;
        bounty.remainingAmount = 0;

        (bool success, ) = bounty.creator.call{value: refundAmount}("");
        require(success, "Refund failed");

        emit BountyCancelled(bountyId, refundAmount);
    }

    /**
     * @notice Raise a dispute on a bounty (by contributor who submitted)
     * @param bountyId The ID of the bounty to dispute
     */
    function raiseDispute(uint256 bountyId) external {
        Bounty storage bounty = bounties[bountyId];
        require(hasSubmitted[bountyId][msg.sender], "Not a contributor");
        require(
            bounty.status == BountyStatus.Active ||
            bounty.status == BountyStatus.Completed,
            "Cannot dispute"
        );

        bounty.status = BountyStatus.Disputed;
        emit DisputeRaised(bountyId, msg.sender);
    }

    /**
     * @notice Resolve a dispute (arbiter only)
     * @param bountyId The ID of the disputed bounty
     * @param inFavorOfContributor Whether the dispute is resolved in favor of the contributor
     * @param contributor The contributor to compensate (if in their favor)
     * @param compensationAmount The amount to compensate the contributor
     */
    function resolveDispute(
        uint256 bountyId,
        bool inFavorOfContributor,
        address contributor,
        uint256 compensationAmount
    ) external onlyRole(ARBITER_ROLE) nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        require(bounty.status == BountyStatus.Disputed, "No dispute");

        disputeResolved[bountyId] = true;

        if (inFavorOfContributor && compensationAmount > 0) {
            require(hasSubmitted[bountyId][contributor], "Not a contributor");
            require(compensationAmount <= bounty.remainingAmount, "Insufficient funds");
            bounty.remainingAmount -= compensationAmount;

            bountyWinners[bountyId].push(Winner({
                winner: contributor,
                amount: compensationAmount,
                paid: false
            }));
        }

        bounty.status = BountyStatus.Completed;
        emit DisputeResolved(bountyId, inFavorOfContributor);
    }

    // ============================================
    // Admin Functions
    // ============================================

    /**
     * @notice Update the platform fee
     * @param _fee New fee in basis points (max 1000 = 10%)
     */
    function setPlatformFee(uint256 _fee) external onlyRole(ADMIN_ROLE) {
        require(_fee <= 1000, "Fee too high");
        uint256 oldFee = platformFee;
        platformFee = _fee;
        emit PlatformFeeUpdated(oldFee, _fee);
    }

    /**
     * @notice Update the fee recipient address
     * @param _recipient New fee recipient address
     */
    function setFeeRecipient(address _recipient) external onlyRole(ADMIN_ROLE) {
        require(_recipient != address(0), "Invalid address");
        address oldRecipient = feeRecipient;
        feeRecipient = _recipient;
        emit FeeRecipientUpdated(oldRecipient, _recipient);
    }

    /**
     * @notice Pause the contract (emergency)
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ============================================
    // View Functions
    // ============================================

    /**
     * @notice Get bounty details
     * @param bountyId The ID of the bounty
     * @return The bounty struct
     */
    function getBounty(uint256 bountyId) external view returns (Bounty memory) {
        return bounties[bountyId];
    }

    /**
     * @notice Get all winners for a bounty
     * @param bountyId The ID of the bounty
     * @return Array of Winner structs
     */
    function getWinners(uint256 bountyId) external view returns (Winner[] memory) {
        return bountyWinners[bountyId];
    }

    /**
     * @notice Get the number of winners for a bounty
     * @param bountyId The ID of the bounty
     * @return The number of winners
     */
    function getWinnerCount(uint256 bountyId) external view returns (uint256) {
        return bountyWinners[bountyId].length;
    }

    /**
     * @notice Check if an address has submitted to a bounty
     * @param bountyId The ID of the bounty
     * @param contributor The address to check
     * @return True if the address has submitted
     */
    function hasContributorSubmitted(
        uint256 bountyId,
        address contributor
    ) external view returns (bool) {
        return hasSubmitted[bountyId][contributor];
    }

    /**
     * @notice Get platform statistics
     * @return totalBounties Total bounties created
     * @return totalPaid Total amount paid out
     * @return currentFee Current platform fee in basis points
     */
    function getStats() external view returns (
        uint256 totalBounties,
        uint256 totalPaid,
        uint256 currentFee
    ) {
        return (totalBountiesCreated, totalPayouts, platformFee);
    }

    /**
     * @notice Receive function to accept MON
     */
    receive() external payable {}
}
