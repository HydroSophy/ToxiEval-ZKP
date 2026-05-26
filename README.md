<div align="center">

# ToxiEval-ZKP

**A Structure-Private Verification Framework for Molecular Toxicity Repair Tasks**

[![Paper](https://img.shields.io/badge/arXiv-2508.12035-b31b1b.svg?style=flat-square)](https://arxiv.org/abs/2508.12035)
[![Venue](https://img.shields.io/badge/IFAC_BIKA-2025_Best_Paper-gold.svg?style=flat-square)](https://arxiv.org/abs/2508.12035)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%E2%89%A516-339933.svg?style=flat-square)](https://nodejs.org/)

</div>

---

ToxiEval-ZKP is the official reference implementation of the IFAC BIKA 2025 paper
*ToxiEval-ZKP: A Structure-Private Verification Framework for Molecular
Toxicity Repair Tasks*. It introduces zero-knowledge proofs to the molecular
toxicity repair pipeline so that a model developer can convince a verifier
that a generated molecule satisfies every ToxiEval acceptance criterion
**without disclosing the molecule itself**.

The system is built on Circom and snarkjs, uses Groth16 over BN128, and is
fully compatible with the eleven toxicity repair tasks defined by the
[ToxiMol benchmark](https://github.com/HydroSophy/ToxiMol).

## Highlights

- **Structure-private verification.** Six toxicity / drug-likeness metrics
  are checked inside a Circom circuit; only a Boolean acceptance flag, a
  Poseidon commitment, and a replay-prevention nullifier are revealed.
- **General-purpose circuit.** A single circuit handles both binary
  classification tasks (e.g. AMES, ClinTox) and regression tasks (LD50),
  switched by a public `task_type` input.
- **Reproducible experiments.** Three experiment scripts reproduce the
  scalability table, formal security verification, and circuit complexity
  analysis reported in the paper.
- **Replay protection.** A Poseidon-derived nullifier is exposed as a public
  output and tracked across verifier sessions to reject duplicate
  submissions of the same repaired molecule.

## Repository Layout

```
ToxiEval-ZKP/
  circuits/
    molecule_verification.circom        Main verification circuit
  src/
    proof_system.js                     Groth16 setup, proving and verification
    data_processor.js                   ToxiEval result loader and circuit-input encoder
    nullifier_tracker.js                Persistent replay-prevention store
  keys/
    verification_key.json               Public verification key
    molecule_verification.zkey          Demo proving key (see Security Notes)
  examples/
    circuit_inputs.json                 Five hand-curated circuit inputs
  experiments/
    README.md                           Reproducibility guide
    scripts/                            Scalability, security and complexity tests
  cli.js                                End-to-end pipeline entry point
  package.json
  LICENSE
  CITATION.cff
```

## Verification Criteria

The circuit accepts a repaired molecule only if **all** of the following hold,
matching the ToxiEval evaluation chain:

| Metric  | Symbol           | Range  | Acceptance threshold                        |
| ------- | ---------------- | ------ | ------------------------------------------- |
| Validity | `v_valid`       | {0,1}  | `= 1` (RDKit-parseable SMILES)              |
| Safety   | `v_safe`        | scaled | `= 1.0` (binary) or `>= 0.5` (LD50)         |
| QED      | `v_QED`         | [0,1]  | `>= 0.5`                                    |
| SAS      | `v_SAS`         | [1,10] | `<= 6.0`                                    |
| Lipinski | `v_Lip`         | int    | `<= 1` violation                            |
| Similarity | `v_Sim`       | [0,1]  | `>= 0.4` (Tanimoto vs. the original)        |

All floating-point metrics are multiplied by 10^6 and rounded before being
fed into the circuit, preserving six decimal digits of precision.

## Installation

```bash
git clone https://github.com/HydroSophy/ToxiEval-ZKP.git
cd ToxiEval-ZKP
npm install
```

A working installation of [Circom 2](https://docs.circom.io/getting-started/installation/)
is required to rebuild the circuit. snarkjs is pulled in via npm.

## Quick Start

```bash
# 1. Compile the Circom circuit (R1CS, witness generator, symbol table)
npm run build:circuit

# 2. Download a powers-of-tau file (Hermez ceremony, public artifact)
curl -L -o keys/powersoftau28_hez_final_10.ptau \
  https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau

# 3. Run the trusted setup (single-contributor demo; see Security Notes)
npm run setup

# 4. Generate and verify a proof for a single hand-curated sample
node cli.js
```

When no per-task data is available the pipeline transparently falls back to
the bundled `examples/circuit_inputs.json`, so step 4 always produces a
verified proof.

## Reproducing the Paper

The three experiments reported in Section 4 of the paper operate on
per-task ToxiEval evaluation outputs produced by running the
[ToxiMol benchmark](https://github.com/HydroSophy/ToxiMol) pipeline on a
multimodal LLM (Claude-3.7-Sonnet in the paper). Place the resulting files
at `experiments/data/security_test_data/<task>/` and then run:

```bash
npm run prepare-data        # Consolidate per-task data
npm run test:scalability    # Table 1: scalability across 10..377 molecules
npm run test:security       # Table 2: completeness, soundness, ZK, attack
npm run test:complexity     # Figure 2: constraint distribution and bottleneck
```

The exact directory layout expected by these scripts is documented in
[`experiments/README.md`](experiments/README.md).

## Security Notes

The proving key shipped in `keys/molecule_verification.zkey` is generated by a
**single-contributor** powers-of-tau ceremony for ease of reproduction. It is
suitable for academic experimentation and the paper's evaluation but must
**not** be used to protect real assets. Production deployments should run a
multi-party ceremony and replace both `keys/molecule_verification.zkey` and
`keys/verification_key.json`.

## Data Source

The evaluation data consumed by the experiment scripts is produced by the
ToxiEval pipeline of the [ToxiMol benchmark](https://github.com/HydroSophy/ToxiMol)
and is not redistributed here. The numbers reported in the paper were
computed on Claude-3.7-Sonnet outputs; any other model evaluated through
ToxiEval can be plugged into the same pipeline.

## Citation

If you use this work, please cite:

```bibtex
@article{lin2025toxieval,
  title={ToxiEval-ZKP: A Structure-Private Verification Framework for Molecular Toxicity Repair Tasks},
  author={Lin, Fei and Zhang, Tengchao and Gong, Ziyang and Wang, Fei-Yue},
  journal={IFAC-PapersOnLine},
  volume={59},
  number={34},
  pages={36--41},
  year={2025},
  publisher={Elsevier},
  doi={10.1016/j.ifacol.2025.12.436}
}
```

## License

Released under the [MIT License](LICENSE).
