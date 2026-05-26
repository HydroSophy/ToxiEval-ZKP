# Experiments

This directory contains scripts to reproduce the three experiments reported
in Section 4 of the paper:

1. **Scalability test** (Table 1): wall-clock time, throughput, and peak
   memory at five molecule counts.
2. **Formal security verification** (Table 2): completeness, soundness,
   zero-knowledge, and attack-resistance properties.
3. **Circuit complexity analysis** (Figure 2): per-component constraint
   distribution and optimisation potential.

## Layout

```
experiments/
  README.md                             this file
  scripts/
    prepare_data.js                     merges per-task ToxiEval outputs
    scalability_test.js                 Experiment 1 (Table 1)
    security_verification.js            Experiment 2 (Table 2)
    attack_resistance.js                helper used by Experiment 2
    security_data_loader.js             helper used by Experiment 2
    circuit_complexity.js               Experiment 3 (Figure 2)
    run_experiments.sh                  one-shot driver for all three
```

## Data

The experiments operate on per-task ToxiEval evaluation outputs of the form
`{successful,failed,invalid}_repairs.json`. These files are produced by the
ToxiEval evaluation chain when applied to a Multimodal Large Language
Model's repaired molecules; they are **not** distributed with this
repository.

The paper's reported numbers were obtained on outputs of Claude-3.7-Sonnet
on the [ToxiMol benchmark](https://github.com/HydroSophy/ToxiMol). To
reproduce them:

1. Generate or obtain ToxiEval outputs for the eleven toxicity repair
   tasks (`ames`, `carcinogens_lagunin`, `clintox`, `dili`, `herg`,
   `herg_central`, `herg_karim`, `ld50_zhu`, `skin_reaction`, `tox21`,
   `toxcast`).
2. Place them at `experiments/data/security_test_data/<task>/` with the
   following structure for each task:

   ```
   experiments/data/security_test_data/ames/
     successful_repairs.json   passes every ToxiEval criterion
     failed_repairs.json       valid SMILES but at least one criterion missed
     invalid_repairs.json      SMILES that RDKit cannot parse
     summary.json              per-task counts and source statistics
   ```

   See the ToxiMol repository for the ToxiEval pipeline that produces these
   files.

## Running From a Clean Checkout

```bash
# From the repository root:
npm install
npm run build:circuit
curl -L -o keys/powersoftau28_hez_final_10.ptau \
  https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau
npm run setup

# After placing ToxiEval data under experiments/data/security_test_data/,
# reproduce all three experiments:
npm run prepare-data
npm run test:scalability
npm run test:security
npm run test:complexity

# Or, equivalently, the bundled driver:
bash experiments/scripts/run_experiments.sh all
```

## Reference Hardware

Experiments in the paper were run on an Apple M3 processor with 48 GB of
RAM, Node.js 18, and snarkjs 0.7.
