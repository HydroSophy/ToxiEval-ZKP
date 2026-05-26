#!/usr/bin/env node
/**
 * Scalability test for the ToxiEval-ZKP system.
 *
 * Measures wall-clock time, throughput, and peak memory at five molecule
 * counts (10, 50, 100, 200, 377), repeating each scale three times to
 * report mean and standard deviation. Reproduces Table 1 in the paper.
 */

const fs = require('fs');
const path = require('path');

const ZKProofGenerator = require('../../src/proof_system');
const DataProcessor = require('../../src/data_processor');

class ScalabilityTester {
    constructor() {
        this.zkGenerator = new ZKProofGenerator();
        this.dataProcessor = new DataProcessor();
        this.resultsDir = path.join(__dirname, '..', 'results');
        this.testSizes = [10, 50, 100, 200, 377];
        this.testRuns = 3;
    }

    ensureResultsDir() {
        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        }
    }

    getMemoryUsage() {
        const m = process.memoryUsage();
        return {
            rss: Math.round((m.rss / 1024 / 1024) * 100) / 100,
            heapUsed: Math.round((m.heapUsed / 1024 / 1024) * 100) / 100,
            heapTotal: Math.round((m.heapTotal / 1024 / 1024) * 100) / 100,
            external: Math.round((m.external / 1024 / 1024) * 100) / 100,
        };
    }

    async runSingleTest(moleculeCount, runIndex) {
        console.log(`\nrun ${runIndex + 1}/${this.testRuns} at scale ${moleculeCount}`);

        const dataPath = path.join(__dirname, '..', 'data', 'all_successful_repairs.json');
        if (!fs.existsSync(dataPath)) {
            throw new Error(
                `${dataPath} not found. Run prepare_data.js first.`,
            );
        }
        const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const allRepairs = rawData.repairs || rawData;
        if (allRepairs.length < moleculeCount) {
            throw new Error(
                `Not enough molecules. Requested ${moleculeCount}, available ${allRepairs.length}.`,
            );
        }

        const selected = allRepairs
            .slice(0, moleculeCount)
            .map((r) => this.dataProcessor.convertToCircuitInput(r));

        const initialMemory = this.getMemoryUsage();
        const startTime = Date.now();
        const results = await this.zkGenerator.generateBatchProofs(selected);
        const totalTime = (Date.now() - startTime) / 1000;
        const finalMemory = this.getMemoryUsage();
        const peakMemory = Math.max(finalMemory.rss, finalMemory.heapTotal);

        const successfulProofs = results.filter((r) => r.success && r.verified).length;
        const successRate = (successfulProofs / moleculeCount) * 100;
        const avgTimePerMolecule = totalTime / moleculeCount;
        const throughput = moleculeCount / totalTime;

        const summary = {
            moleculeCount,
            runIndex: runIndex + 1,
            totalTime,
            avgTimePerMolecule,
            throughput,
            successfulProofs,
            successRate,
            initialMemory,
            finalMemory,
            peakMemory,
            timestamp: new Date().toISOString(),
        };

        console.log(`  total time      : ${totalTime.toFixed(2)} s`);
        console.log(`  per molecule    : ${avgTimePerMolecule.toFixed(4)} s`);
        console.log(`  throughput      : ${throughput.toFixed(2)} mol/s`);
        console.log(`  success rate    : ${successRate.toFixed(1)} %`);
        console.log(`  peak memory     : ${peakMemory.toFixed(2)} MB`);
        return summary;
    }

    async runScalabilityTests() {
        console.log('ToxiEval-ZKP scalability test');
        console.log(`  scales : ${this.testSizes.join(', ')}`);
        console.log(`  runs   : ${this.testRuns} per scale`);
        this.ensureResultsDir();

        console.log('\nsetup');
        await this.zkGenerator.setup();

        const allResults = [];
        for (const moleculeCount of this.testSizes) {
            console.log(`\n--- scale ${moleculeCount} ---`);
            const scaleResults = [];
            for (let run = 0; run < this.testRuns; run += 1) {
                try {
                    const r = await this.runSingleTest(moleculeCount, run);
                    scaleResults.push(r);
                    allResults.push(r);
                    if (run < this.testRuns - 1) {
                        await new Promise((resolve) => setTimeout(resolve, 5000));
                    }
                } catch (err) {
                    console.error(`run ${run + 1} failed: ${err.message}`);
                    break;
                }
            }
            if (scaleResults.length > 0) {
                const avg = this.calculateAverages(scaleResults);
                console.log(
                    `\n  mean total time  : ${avg.avgTotalTime.toFixed(2)} +/- ${avg.stdTotalTime.toFixed(2)} s`,
                );
                console.log(
                    `  mean per-mol time: ${avg.avgTimePerMolecule.toFixed(4)} +/- ${avg.stdTimePerMolecule.toFixed(4)} s`,
                );
                console.log(
                    `  mean throughput  : ${avg.avgThroughput.toFixed(2)} +/- ${avg.stdThroughput.toFixed(2)} mol/s`,
                );
                console.log(
                    `  mean peak memory : ${avg.avgPeakMemory.toFixed(2)} +/- ${avg.stdPeakMemory.toFixed(2)} MB`,
                );
            }
        }

        await this.saveResults(allResults);
        await this.generateSummary(allResults);
        console.log(`\nresults saved to ${this.resultsDir}`);
    }

    calculateAverages(results) {
        const totalTimes = results.map((r) => r.totalTime);
        const timesPerMol = results.map((r) => r.avgTimePerMolecule);
        const throughputs = results.map((r) => r.throughput);
        const peakMemories = results.map((r) => r.peakMemory);

        const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
        const std = (arr) => {
            const mean = avg(arr);
            const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
            return Math.sqrt(variance);
        };

        return {
            avgTotalTime: avg(totalTimes),
            stdTotalTime: std(totalTimes),
            avgTimePerMolecule: avg(timesPerMol),
            stdTimePerMolecule: std(timesPerMol),
            avgThroughput: avg(throughputs),
            stdThroughput: std(throughputs),
            avgPeakMemory: avg(peakMemories),
            stdPeakMemory: std(peakMemories),
        };
    }

    async saveResults(allResults) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filepath = path.join(this.resultsDir, `scalability_results_${timestamp}.json`);
        fs.writeFileSync(
            filepath,
            JSON.stringify(
                {
                    testInfo: {
                        testSizes: this.testSizes,
                        testRuns: this.testRuns,
                        timestamp: new Date().toISOString(),
                        totalTests: allResults.length,
                    },
                    results: allResults,
                },
                null,
                2,
            ),
        );
        console.log(`  wrote ${filepath}`);
    }

    async generateSummary(allResults) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filepath = path.join(this.resultsDir, `scalability_summary_${timestamp}.json`);
        const summary = {
            testInfo: {
                testSizes: this.testSizes,
                testRuns: this.testRuns,
                timestamp: new Date().toISOString(),
            },
            summary: [],
        };

        for (const size of this.testSizes) {
            const sizeResults = allResults.filter((r) => r.moleculeCount === size);
            if (sizeResults.length > 0) {
                const avg = this.calculateAverages(sizeResults);
                summary.summary.push({
                    moleculeCount: size,
                    runs: sizeResults.length,
                    ...avg,
                    avgSuccessRate:
                        sizeResults.reduce((s, r) => s + r.successRate, 0) / sizeResults.length,
                });
            }
        }

        fs.writeFileSync(filepath, JSON.stringify(summary, null, 2));
        console.log(`  wrote ${filepath}`);

        console.log('\nSummary table');
        console.log('  scale | total(s) | per-mol(s) | throughput | memory(MB) | success(%)');
        for (const item of summary.summary) {
            console.log(
                `  ${String(item.moleculeCount).padStart(5)} | ` +
                `${item.avgTotalTime.toFixed(2).padStart(8)} | ` +
                `${item.avgTimePerMolecule.toFixed(4).padStart(10)} | ` +
                `${item.avgThroughput.toFixed(2).padStart(10)} | ` +
                `${item.avgPeakMemory.toFixed(2).padStart(10)} | ` +
                `${item.avgSuccessRate.toFixed(1).padStart(10)}`,
            );
        }
    }
}

function showHelp() {
    console.log(
        [
            'ToxiEval-ZKP scalability test',
            '',
            'Usage: node scalability_test.js [option]',
            '',
            'Options:',
            '  --help, -h   show this help message',
        ].join('\n'),
    );
}

if (require.main === module) {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        showHelp();
        process.exit(0);
    }
    new ScalabilityTester().runScalabilityTests().catch((err) => {
        console.error('scalability test failed:', err.message);
        process.exit(1);
    });
}

module.exports = ScalabilityTester;
