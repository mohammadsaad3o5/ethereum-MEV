// Copyright 2014 The go-ethereum Authors
// This file is part of the go-ethereum library.
//
// The go-ethereum library is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// The go-ethereum library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with the go-ethereum library. If not, see <http://www.gnu.org/licenses/>.

package miner

import (
	"math/big"
	"math/rand"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/txpool"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/holiman/uint256"
)

// txWithMinerFee wraps a transaction with its gas price or effective miner gasTipCap
type txWithMinerFee struct {
	tx   *txpool.LazyTransaction
	from common.Address
	fees *uint256.Int
}

// newTxWithMinerFee creates a wrapped transaction, calculating the effective
// miner gasTipCap if a base fee is provided.
// Returns error in case of a negative effective miner gasTipCap.
func newTxWithMinerFee(tx *txpool.LazyTransaction, from common.Address, baseFee *uint256.Int) (*txWithMinerFee, error) {
	tip := new(uint256.Int).Set(tx.GasTipCap)
	if baseFee != nil {
		if tx.GasFeeCap.Cmp(baseFee) < 0 {
			return nil, types.ErrGasFeeCapTooLow
		}
		tip = new(uint256.Int).Sub(tx.GasFeeCap, baseFee)
		if tip.Gt(tx.GasTipCap) {
			tip = tx.GasTipCap
		}
	}
	return &txWithMinerFee{
		tx:   tx,
		from: from,
		fees: tip,
	}, nil
}

// txByRandomOrder is a slice of transactions that will be ordered randomly
type txByRandomOrder []*txWithMinerFee

// transactionsByPriceAndNonce represents a set of transactions that can return
// transactions in a random sorted order.
type transactionsByPriceAndNonce struct {
	heads   txByRandomOrder // Slice of all transactions, shuffled
	signer  types.Signer    // Signer for the set of transactions
	baseFee *uint256.Int    // Current base fee
}

// newTransactionsByPriceAndNonce creates a transaction set that can retrieve
// transactions in a random order.
func newTransactionsByPriceAndNonce(signer types.Signer, txs map[common.Address][]*txpool.LazyTransaction, baseFee *big.Int) *transactionsByPriceAndNonce {
	// Convert the basefee from header format to uint256 format
	var baseFeeUint *uint256.Int
	if baseFee != nil {
		baseFeeUint = uint256.MustFromBig(baseFee)
	}
	// Initialize a slice to hold all transactions
	allTxs := make(txByRandomOrder, 0)
	for from, accTxs := range txs {
		for _, tx := range accTxs {
			wrapped, err := newTxWithMinerFee(tx, from, baseFeeUint)
			if err != nil {
				continue
			}
			allTxs = append(allTxs, wrapped)
		}
	}
	// Shuffle the slice
	rand.Shuffle(len(allTxs), func(i, j int) { allTxs[i], allTxs[j] = allTxs[j], allTxs[i] })
	// Assemble and return the transaction set
	return &transactionsByPriceAndNonce{
		heads:   allTxs,
		signer:  signer,
		baseFee: baseFeeUint,
	}
}

// Peek returns the next transaction.
func (t *transactionsByPriceAndNonce) Peek() (*txpool.LazyTransaction, *uint256.Int) {
	if len(t.heads) == 0 {
		return nil, nil
	}
	return t.heads[0].tx, t.heads[0].fees
}

// Shift removes the current transaction.
func (t *transactionsByPriceAndNonce) Shift() {
	if len(t.heads) > 0 {
		t.heads = t.heads[1:]
	}
}

// Pop removes the current transaction.
func (t *transactionsByPriceAndNonce) Pop() {
	if len(t.heads) > 0 {
		t.heads = t.heads[1:]
	}
}

// Empty returns if the list is empty.
func (t *transactionsByPriceAndNonce) Empty() bool {
	return len(t.heads) == 0
}

// Clear removes the entire content of the list.
func (t *transactionsByPriceAndNonce) Clear() {
	t.heads = nil
}
