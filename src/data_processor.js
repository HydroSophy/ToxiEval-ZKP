/**
 * Data processor for ToxiEval evaluation results.
 *
 * Reads per-task `successful_repairs.json` files produced by the ToxiEval
 * evaluation chain (see https://github.com/HydroSophy/ToxiMol), converts
 * each repair into the integer-valued circuit input vector expected by the
 * `molecule_verification` circuit, and provides utilities for offline
 * success-criterion checking.
 */

const fs = require('fs');
const path = require('path');

const TASK_FOLDERS = [
    'ames',
    'carcinogens_lagunin',
    'clintox',
    'dili',
    'herg',
    'herg_central',
    'herg_karim',
    'ld50_zhu',
    'skin_reaction',
    'tox21',
    'toxcast',
];

const LD50_TASKS = new Set(['ld50_zhu']);

const SCALE = 1_000_000;

class DataProcessor {
    constructor() {
        this.basePath = path.join(
            __dirname,
            '..',
            'experiments',
            'data',
            'security_test_data',
        );
        this.taskFolders = TASK_FOLDERS;
    }

    /** Read every per-task `successful_repairs.json` and merge them. */
    async readAllSuccessfulRepairs() {
        const all = [];
        for (const task of this.taskFolders) {
            const file = path.join(this.basePath, task, 'successful_repairs.json');
            if (!fs.existsSync(file)) {
                console.log(`  skip: ${file} (not found)`);
                continue;
            }
            try {
                const content = JSON.parse(fs.readFileSync(file, 'utf8'));
                const items = Array.isArray(content)
                    ? content
                    : Array.isArray(content.results)
                        ? content.results
                        : [];
                for (const r of items) {
                    r.task = task;
                    r.task_type = this.getTaskType(task);
                    all.push(r);
                }
                console.log(`  loaded ${items.length} repairs from ${task}`);
            } catch (err) {
                console.error(`  error reading ${file}: ${err.message}`);
            }
        }
        console.log(`  total repairs loaded: ${all.length}`);
        return all;
    }

    /** Binary classification tasks return 0; LD50-style regression returns 1. */
    getTaskType(task) {
        return LD50_TASKS.has(task) ? 1 : 0;
    }

    /**
     * Convert a single ToxiEval repair record into the circuit input format.
     * All floating-point metrics are scaled by 1e6 and rounded to integers.
     */
    convertToCircuitInput(repair) {
        let safetyScore;
        let toxicityValue = null;
        if (repair.toxicity) {
            const keys = Object.keys(repair.toxicity);
            if (keys.length > 0) toxicityValue = repair.toxicity[keys[0]];
        }

        if (repair.task_type === 0) {
            if (toxicityValue && toxicityValue.value) {
                safetyScore = toxicityValue.value === 'A' ? SCALE : 0;
            } else {
                safetyScore = repair.success ? SCALE : 0;
            }
        } else {
            if (toxicityValue && typeof toxicityValue.probability === 'number') {
                safetyScore = Math.floor(toxicityValue.probability * SCALE);
            } else {
                safetyScore = repair.success ? Math.floor(0.8 * SCALE) : Math.floor(0.2 * SCALE);
            }
        }

        const circuitInput = {
            // Private inputs
            valid_smiles: repair.valid_smiles === true ? 1 : 0,
            safety_score: safetyScore,
            qed_score: Math.floor((repair.qed ?? 0) * SCALE),
            sas_score: Math.floor((repair.sas_score ?? 0) * SCALE),
            lipinski_violations: repair.lipinski_violations ?? 0,
            similarity: Math.floor((repair.similarity ?? 0) * SCALE),
            salt: Math.floor(Math.random() * SCALE),
            // Public inputs
            task_type: repair.task_type ?? 0,
            safety_threshold: repair.task_type === 1 ? Math.floor(0.5 * SCALE) : 0,
            qed_threshold: Math.floor(0.5 * SCALE),
            sas_threshold: Math.floor(6.0 * SCALE),
            lipinski_threshold: 1,
            similarity_threshold: Math.floor(0.4 * SCALE),
        };

        return {
            molecule_id: repair.molecule_id,
            task: repair.task,
            original_data: repair,
            circuit_input: circuitInput,
        };
    }

    /** Offline reference implementation of the circuit acceptance predicate. */
    checkSuccessCriteria(repair) {
        const criteria = {
            valid_smiles: false,
            safety: false,
            qed: false,
            sas: false,
            lipinski: false,
            similarity: false,
        };

        let toxicityValue = null;
        if (repair.toxicity) {
            const keys = Object.keys(repair.toxicity);
            if (keys.length > 0) toxicityValue = repair.toxicity[keys[0]];
        }

        criteria.valid_smiles = repair.valid_smiles === true;

        if (repair.task_type === 0) {
            criteria.safety = toxicityValue && toxicityValue.value
                ? toxicityValue.value === 'A'
                : !!repair.success;
        } else {
            criteria.safety = toxicityValue && typeof toxicityValue.probability === 'number'
                ? toxicityValue.probability >= 0.5
                : !!repair.success;
        }

        criteria.qed = (repair.qed ?? 0) >= 0.5;
        criteria.sas = (repair.sas_score ?? 0) <= 6.0;
        criteria.lipinski = (repair.lipinski_violations ?? 0) <= 1;
        criteria.similarity = (repair.similarity ?? 0) >= 0.4;

        const allPassed = Object.values(criteria).every(Boolean);
        return {
            criteria,
            allPassed,
            passedCount: Object.values(criteria).filter(Boolean).length,
        };
    }

    /** A minimal hand-crafted record that passes every criterion. */
    generateSampleData() {
        return {
            molecule_id: 'SAMPLE_001',
            task: 'sample',
            circuit_input: {
                valid_smiles: 1,
                safety_score: SCALE,
                qed_score: Math.floor(0.7 * SCALE),
                sas_score: Math.floor(3.0 * SCALE),
                lipinski_violations: 0,
                similarity: Math.floor(0.6 * SCALE),
                salt: 12345,
                task_type: 0,
                safety_threshold: 0,
                qed_threshold: Math.floor(0.5 * SCALE),
                sas_threshold: Math.floor(6.0 * SCALE),
                lipinski_threshold: 1,
                similarity_threshold: Math.floor(0.4 * SCALE),
            },
        };
    }

    saveProcessedData(data, filename) {
        const outDir = path.join(__dirname, '..', 'examples');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const outPath = path.join(outDir, filename);
        fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
        console.log(`  wrote ${outPath}`);
    }
}

module.exports = DataProcessor;

if (require.main === module) {
    (async () => {
        const dp = new DataProcessor();
        const repairs = await dp.readAllSuccessfulRepairs();
        if (repairs.length === 0) {
            const sample = dp.generateSampleData();
            dp.saveProcessedData([sample], 'sample_input.json');
            return;
        }
        const examples = repairs.slice(0, 5).map((r) => dp.convertToCircuitInput(r));
        const stats = repairs.map((r) => ({
            molecule_id: r.molecule_id,
            task: r.task,
            ...dp.checkSuccessCriteria(r),
        }));
        dp.saveProcessedData(examples, 'circuit_inputs.json');
        dp.saveProcessedData(stats, 'success_stats.json');

        const passed = stats.filter((s) => s.allPassed).length;
        const total = stats.length;
        console.log(`  passed all criteria: ${passed} / ${total} (${
            ((passed / total) * 100).toFixed(2)
        } %)`);
    })().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
