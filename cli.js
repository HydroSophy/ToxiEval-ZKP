#!/usr/bin/env node
/**
 * ToxiEval-ZKP - end-to-end entry point.
 *
 * Loads ToxiEval evaluation results, generates a Groth16 zero-knowledge
 * proof for each molecule using the Circom verification circuit, verifies
 * each proof, and persists both per-molecule proofs and a run summary.
 *
 * Usage:
 *   node cli.js            run the full pipeline
 *   node cli.js --setup    only generate / load proving keys
 *   node cli.js --stats    only print circuit statistics
 *   node cli.js --help     show help
 */

const ZKProofGenerator = require('./src/proof_system');
const DataProcessor = require('./src/data_processor');

function formatTaskBreakdown(results) {
    const stats = {};
    for (const r of results) {
        const t = r.task || 'unknown';
        if (!stats[t]) stats[t] = { total: 0, success: 0, failed: 0 };
        stats[t].total += 1;
        if (r.success && r.verified) stats[t].success += 1;
        else stats[t].failed += 1;
    }
    return stats;
}

async function runDemo(zk) {
    const sample = new DataProcessor().generateSampleData();
    const proof = await zk.generateProof(sample);
    const ok = await zk.verifyProof(proof.proof, proof.publicSignals);
    zk.saveProofResults(
        [{ ...proof, verified: ok, success: true }],
        'sample_zk_proof.json',
    );
    console.log(ok ? '[demo] sample proof verified' : '[demo] sample proof FAILED');
    return ok;
}

async function main() {
    console.log('ToxiEval-ZKP');
    console.log('Structure-private verification for molecular toxicity repair');
    console.log('');

    const zk = new ZKProofGenerator();
    const dp = new DataProcessor();

    console.log('[1/4] system statistics');
    for (const [k, v] of Object.entries(zk.getSystemStats())) {
        console.log(`      ${k}: ${v}`);
    }
    console.log('');

    console.log('[2/4] proving / verification key setup');
    await zk.setup();
    console.log('');

    console.log('[3/4] loading ToxiEval results');
    const repairs = await dp.readAllSuccessfulRepairs();
    if (repairs.length === 0) {
        console.log('      no repair data found; running sample demo instead');
        await runDemo(zk);
        return;
    }
    const inputs = repairs.map((r) => dp.convertToCircuitInput(r));
    console.log(`      loaded ${repairs.length} molecules across ${
        new Set(repairs.map((r) => r.task)).size
    } tasks`);
    console.log('');

    console.log('[4/4] batch proof generation and verification');
    const results = await zk.generateBatchProofs(inputs);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    zk.saveProofResults(results, `zk_proofs_complete_${timestamp}.json`);

    const summary = {
        timestamp: new Date().toISOString(),
        totalMolecules: results.length,
        successfulProofs: results.filter((r) => r.success && r.verified).length,
        failedProofs: results.filter((r) => !r.success || !r.verified).length,
        taskBreakdown: formatTaskBreakdown(results),
        systemInfo: { ...zk.getSystemStats(), processingComplete: true },
    };
    zk.saveProofResults([summary], `processing_summary_${timestamp}.json`);

    const rate = (summary.successfulProofs / summary.totalMolecules) * 100;
    console.log('');
    console.log('Final summary');
    console.log(`  total molecules        : ${summary.totalMolecules}`);
    console.log(`  successfully verified  : ${summary.successfulProofs}`);
    console.log(`  failed verification    : ${summary.failedProofs}`);
    console.log(`  overall success rate   : ${rate.toFixed(2)} %`);
}

function showHelp() {
    console.log(
        [
            'ToxiEval-ZKP runtime',
            '',
            'Usage: node cli.js [option]',
            '',
            'Options:',
            '  --help, -h   show this help message',
            '  --stats      print circuit statistics and exit',
            '  --setup      run setup phase and exit',
            '',
            'No option runs the full pipeline (setup, load data, prove, verify, save).',
        ].join('\n'),
    );
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
} else if (process.argv.includes('--stats')) {
    const zk = new ZKProofGenerator();
    for (const [k, v] of Object.entries(zk.getSystemStats())) {
        console.log(`${k}: ${v}`);
    }
    process.exit(0);
} else if (process.argv.includes('--setup')) {
    new ZKProofGenerator()
        .setup()
        .then(() => {
            console.log('setup completed');
            process.exit(0);
        })
        .catch((err) => {
            console.error('setup failed:', err.message);
            process.exit(1);
        });
} else {
    main().catch((err) => {
        console.error('error:', err);
        process.exit(1);
    });
}
