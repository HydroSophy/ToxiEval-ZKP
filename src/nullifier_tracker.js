/**
 * Persistent nullifier tracker used to prevent replay of valid proofs.
 *
 * The molecule_verification circuit emits a Poseidon-based nullifier as a
 * public output (see Algorithm 1 in the paper). A verifier accepts a proof
 * only if the nullifier has never been seen before. This module stores the
 * set of consumed nullifiers on disk so verifier sessions are stateful
 * across runs.
 */

const fs = require('fs');
const path = require('path');

class NullifierTracker {
    constructor() {
        this.storageFile = path.join(__dirname, '..', 'data', 'used_nullifiers.json');
        this.usedNullifiers = new Set();
        this.loadUsedNullifiers();
    }

    loadUsedNullifiers() {
        try {
            if (fs.existsSync(this.storageFile)) {
                const data = JSON.parse(fs.readFileSync(this.storageFile, 'utf8'));
                this.usedNullifiers = new Set(data.nullifiers || []);
                console.log(`loaded ${this.usedNullifiers.size} used nullifiers`);
            } else {
                console.log('no previous nullifier records; starting fresh');
            }
        } catch (err) {
            console.warn(`error loading nullifier records: ${err.message}`);
            this.usedNullifiers = new Set();
        }
    }

    saveUsedNullifiers() {
        try {
            const dir = path.dirname(this.storageFile);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(
                this.storageFile,
                JSON.stringify(
                    {
                        nullifiers: Array.from(this.usedNullifiers),
                        lastUpdated: new Date().toISOString(),
                        totalCount: this.usedNullifiers.size,
                    },
                    null,
                    2,
                ),
            );
        } catch (err) {
            console.error(`error saving nullifier records: ${err.message}`);
        }
    }

    isNullifierUsed(nullifier) {
        return this.usedNullifiers.has(String(nullifier));
    }

    markNullifierAsUsed(nullifier) {
        const key = String(nullifier);
        if (this.usedNullifiers.has(key)) return false;
        this.usedNullifiers.add(key);
        this.saveUsedNullifiers();
        return true;
    }

    /**
     * Verify a proof and reject it if the nullifier has been seen before.
     * Returns `{ valid, replayAttack, reason, nullifier? }`.
     */
    async verifyProofWithReplayProtection(zkGenerator, proof, publicSignals) {
        const isValid = await zkGenerator.verifyProof(proof, publicSignals);
        if (!isValid) {
            return { valid: false, replayAttack: false, reason: 'invalid proof' };
        }
        const nullifier = publicSignals[2];
        if (this.isNullifierUsed(nullifier)) {
            return {
                valid: false,
                replayAttack: true,
                reason: 'replay attack detected: nullifier already used',
                nullifier,
            };
        }
        this.markNullifierAsUsed(nullifier);
        return {
            valid: true,
            replayAttack: false,
            reason: 'proof verified and nullifier is fresh',
            nullifier,
        };
    }

    getStats() {
        return {
            totalUsedNullifiers: this.usedNullifiers.size,
            storageFile: this.storageFile,
            lastLoaded: new Date().toISOString(),
        };
    }

    clearAllNullifiers() {
        this.usedNullifiers.clear();
        this.saveUsedNullifiers();
        console.log('all nullifier records cleared');
    }

    exportNullifiers() {
        return Array.from(this.usedNullifiers);
    }

    importNullifiers(nullifiers) {
        this.usedNullifiers = new Set(nullifiers);
        this.saveUsedNullifiers();
        console.log(`imported ${nullifiers.length} nullifiers`);
    }
}

module.exports = NullifierTracker;
