// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MinerCommitmentTracker {
    struct MinerCommitments {
        address miner;
        bytes32[] commitments;
    }

    struct CommitmentOpening {
        uint256 blockIndex; // i
        uint256 commitmentIndex; // j
        bytes opening; // σ_i,j
        address opener;
        uint256 blockNumber; // The block number when the opening was recorded
    }

    MinerCommitments[3] public minerCommitments;

    // Store the commitment openings
    CommitmentOpening[] public commitmentOpenings;

    /**
     * @dev Registers commitments for the current miner.
     * Shifts out the oldest miner and adds the new miner to the array.
     * @param newCommitments An array of new commitments provided by the miner.
     */
    function registerCommitments(bytes32[] memory newCommitments) public {
        // Shift the array to remove the oldest miner
        minerCommitments[0] = minerCommitments[1];
        minerCommitments[1] = minerCommitments[2];

        // Add the new miner
        minerCommitments[2] = MinerCommitments({
            miner: msg.sender,
            commitments: newCommitments
        });
    }

    /**
     * @dev Method for miners to open their commitments.
     * @param blockIndex The index of the block (i).
     * @param commitmentIndex The index of the commitment in the block (j).
     * @param opening The opening of the commitment (σ_i,j).
     */
    function open(uint256 blockIndex, uint256 commitmentIndex, bytes memory opening) public {
        require(blockIndex < 3, "Invalid block index");
        MinerCommitments storage minerCommit = minerCommitments[blockIndex];
        require(minerCommit.miner == msg.sender, "Only the miner can open commitments");
        require(commitmentIndex < minerCommit.commitments.length, "Invalid commitment index");

        // Record the opening
        commitmentOpenings.push(CommitmentOpening({
            blockIndex: blockIndex,
            commitmentIndex: commitmentIndex,
            opening: opening,
            opener: msg.sender,
            blockNumber: block.number
        }));

        // Emit an event for monitoring purposes
        emit CommitmentOpened(blockIndex, commitmentIndex, opening, msg.sender, block.number);
    }

    /**
     * @dev Retrieves the current seeds (commitments) from memory.
     * @return miners An array of miner addresses.
     * @return commitments A flattened array of all commitments.
     * @return commitmentLengths An array indicating the number of commitments per miner.
     */
    function getSeeds()
        public
        view
        returns (
            address[3] memory miners,
            bytes32[] memory commitments,
            uint256[3] memory commitmentLengths
        )
    {
        uint256 totalCommitments = 0;
        for (uint256 i = 0; i < 3; i++) {
            miners[i] = minerCommitments[i].miner;
            commitmentLengths[i] = minerCommitments[i].commitments.length;
            totalCommitments += commitmentLengths[i];
        }

        commitments = new bytes32[](totalCommitments);
        uint256 index = 0;
        for (uint256 i = 0; i < 3; i++) {
            for (uint256 j = 0; j < minerCommitments[i].commitments.length; j++) {
                commitments[index] = minerCommitments[i].commitments[j];
                index++;
            }
        }
    }

    /**
     * @dev Computes the final seed by hashing the concatenation of all commitments.
     * Uses SHA256 as the PRG to handle partial seeds.
     * @return A bytes32 value representing the final seed.
     */
    function computeFinalSeed() public view returns (bytes32) {
        bytes memory data;
        for (uint256 i = 0; i < 3; i++) {
            for (uint256 j = 0; j < minerCommitments[i].commitments.length; j++) {
                data = abi.encodePacked(data, minerCommitments[i].commitments[j]);
            }
        }
        return sha256(data);
    }

    /**
     * @dev Retrieves the commitment openings.
     * @return An array of CommitmentOpening structs.
     */
    function getCommitmentOpenings() public view returns (CommitmentOpening[] memory) {
        return commitmentOpenings;
    }

    // Event emitted when a commitment is opened
    event CommitmentOpened(
        uint256 indexed blockIndex,
        uint256 indexed commitmentIndex,
        bytes opening,
        address indexed opener,
        uint256 blockNumber
    );
}
