# Cryptographic Keys

This directory contains the trusted-setup artefacts for the ToxiEval-ZKP
circuit.

| File                              | Purpose                                                     | Tracked by git |
| --------------------------------- | ----------------------------------------------------------- | -------------- |
| `verification_key.json`           | Public verification key (Groth16).                          | yes            |
| `molecule_verification.zkey`      | Proving key produced by a demo single-contributor ceremony. | yes            |
| `powersoftau28_hez_final_10.ptau` | Public powers-of-tau ceremony output from the Hermez team.  | no (download)  |

## Obtaining the Powers-of-Tau File

The `.ptau` file is a large, freely redistributable public artefact and is
intentionally not committed to git. Download it once before running the
setup:

```bash
curl -L -o keys/powersoftau28_hez_final_10.ptau \
  https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau
```

This is the canonical Phase-1 transcript published by the iden3 / Hermez
ceremony and is sufficient for any circuit with up to 2^10 constraints.

## Regenerating the Proving Key

After changing `circuits/molecule_verification.circom`, the proving and
verification keys must be regenerated:

```bash
npm run build:circuit   # rebuild R1CS, wasm, sym
npm run setup           # rerun trusted setup; rewrites both keys above
```

## Production Use

The shipped `molecule_verification.zkey` is the output of a
**single-contributor** ceremony, intended only for academic reproduction of
the paper. Production deployments must replace it with the result of a
proper multi-party ceremony (for example, using
[`snarkjs zkey contribute`](https://github.com/iden3/snarkjs#21-contribute-to-the-phase-2-of-the-ceremony)
with multiple independent contributors and a public-randomness beacon).
