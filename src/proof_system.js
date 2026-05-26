/**
 * Groth16 proof generation and verification for the ToxiEval-ZKP
 * molecule verification circuit.
 *
 * Wraps snarkjs to provide:
 *   - one-shot trusted setup (powers of tau + zkey + vkey export)
 *   - per-molecule proof generation and verification
 *   - batch processing with per-task statistics
 *   - persistence of proofs and run summaries
 *
 * The trusted setup performed here is a single-contributor demonstration
 * ceremony. Production deployments should replace it with a multi-party
 * ceremony before relying on the proving key.
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ZKProofGenerator {
    constructor() {
        const here = __dirname;
        this.wasmPath = path.join(here, '..', 'build', 'molecule_verification_js', 'molecule_verification.wasm');
        this.zkeyPath = path.join(here, '..', 'keys', 'molecule_verification.zkey');
        this.vkeyPath = path.join(here, '..', 'keys', 'verification_key.json');
        this.r1csPath = path.join(here, '..', 'build', 'molecule_verification.r1cs');
        this.ptauPath = path.join(here, '..', 'keys', 'powersoftau28_hez_final_10.ptau');
    }

    /**
     * Run the demonstration trusted setup. Idempotent: regenerates only the
     * artifacts that are missing.
     */
    async setup() {
        const keysDir = path.dirname(this.zkeyPath);
        if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir, { recursive: true });

        if (!fs.existsSync(this.ptauPath) || fs.statSync(this.ptauPath).size === 0) {
            console.log('  generating powers-of-tau ceremony (demo)');
            await this.generatePowerOfTau();
        }

        if (!fs.existsSync(this.zkeyPath)) {
            console.log('  generating proving key');
            await snarkjs.zKey.newZKey(this.r1csPath, this.ptauPath, this.zkeyPath);
        }

        if (!fs.existsSync(this.vkeyPath)) {
            console.log('  exporting verification key');
            const vKey = await snarkjs.zKey.exportVerificationKey(this.zkeyPath);
            fs.writeFileSync(this.vkeyPath, JSON.stringify(vKey, null, 2));
        }
    }

    async generatePowerOfTau() {
        const tmp1 = path.join(path.dirname(this.ptauPath), 'pot_0000.ptau');
        const tmp2 = path.join(path.dirname(this.ptauPath), 'pot_0001.ptau');
        try {
            await execAsync(`npx snarkjs powersoftau new bn128 12 "${tmp1}"`);
            await execAsync(
                `npx snarkjs powersoftau contribute "${tmp1}" "${tmp2}" --name="ToxiEval-ZKP demo contribution" --entropy="demo entropy for toxieval-zkp"`,
            );
            await execAsync(`npx snarkjs powersoftau prepare phase2 "${tmp2}" "${this.ptauPath}"`);
            for (const p of [tmp1, tmp2]) if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch (err) {
            throw new Error(`powers-of-tau generation failed: ${err.message}`);
        }
    }

    async generateProof(moleculeData) {
        const input = moleculeData.circuit_input;
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            this.wasmPath,
            this.zkeyPath,
        );
        return {
            proof,
            publicSignals,
            moleculeId: moleculeData.molecule_id,
            task: moleculeData.task,
            timestamp: new Date().toISOString(),
        };
    }

    async verifyProof(proof, publicSignals) {
        try {
            const vKey = JSON.parse(fs.readFileSync(this.vkeyPath, 'utf8'));
            return await snarkjs.groth16.verify(vKey, publicSignals, proof);
        } catch (err) {
            console.error('verification error:', err.message);
            return false;
        }
    }

    async generateBatchProofs(moleculeArray) {
        console.log(`  processing ${moleculeArray.length} molecules`);
        const results = [];
        let successCount = 0;
        let failureCount = 0;
        const startTime = Date.now();

        for (let i = 0; i < moleculeArray.length; i += 1) {
            const m = moleculeArray[i];
            try {
                const proofResult = await this.generateProof(m);
                const ok = await this.verifyProof(proofResult.proof, proofResult.publicSignals);
                results.push({ ...proofResult, verified: ok, success: true });
                if (ok) successCount += 1;
                else failureCount += 1;
            } catch (err) {
                failureCount += 1;
                results.push({
                    moleculeId: m.molecule_id,
                    task: m.task,
                    success: false,
                    error: err.message,
                });
            }

            if ((i + 1) % 50 === 0 || i + 1 === moleculeArray.length) {
                const elapsed = (Date.now() - startTime) / 1000;
                console.log(
                    `  [${i + 1}/${moleculeArray.length}] ` +
                    `ok=${successCount} fail=${failureCount} elapsed=${elapsed.toFixed(1)}s`,
                );
            }
        }

        const total = (Date.now() - startTime) / 1000;
        console.log(
            `  done in ${total.toFixed(1)}s  ` +
            `(${(total / moleculeArray.length).toFixed(3)} s/molecule)`,
        );
        return results;
    }

    saveProofResults(results, filename) {
        const outDir = path.join(__dirname, '..', 'proofs');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const outPath = path.join(outDir, filename);
        fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
        console.log(`  wrote ${outPath}`);
    }

    getVerificationKey() {
        if (!fs.existsSync(this.vkeyPath)) {
            throw new Error('verification key not found; run setup() first');
        }
        return JSON.parse(fs.readFileSync(this.vkeyPath, 'utf8'));
    }

    getSystemStats() {
        return {
            circuit: 'molecule_verification.circom',
            constraints: 1774,
            linearConstraints: 994,
            nonLinearConstraints: 780,
            publicInputs: 6,
            privateInputs: 7,
            publicOutputs: 3,
            zkProtocol: 'Groth16',
            curve: 'BN128',
            hash: 'Poseidon',
            setupComplete: fs.existsSync(this.zkeyPath) && fs.existsSync(this.vkeyPath),
            powersOfTauAvailable: fs.existsSync(this.ptauPath),
        };
    }
}

module.exports = ZKProofGenerator;
