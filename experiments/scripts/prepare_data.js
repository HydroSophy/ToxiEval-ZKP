#!/usr/bin/env node
/**
 * Consolidate per-task ToxiEval `successful_repairs.json` files into the
 * artifacts consumed by the scalability, security, and complexity
 * experiments (see ../README.md).
 *
 * Outputs:
 *   experiments/data/all_successful_repairs.json   merged repairs
 *   experiments/data/task_breakdown.json           per-task counts
 *   experiments/data/circuit_inputs.json           integer-scaled inputs
 *   experiments/data/sample_{10,50,100}.json       quick sub-samples
 *   experiments/data/data_summary.json             aggregate metrics
 */

const fs = require('fs');
const path = require('path');

const DataProcessor = require('../../src/data_processor');

class ExperimentDataPreparator {
    constructor() {
        this.dataProcessor = new DataProcessor();
        this.experimentDataDir = path.join(__dirname, '..', 'data');
    }

    ensureDataDir() {
        if (!fs.existsSync(this.experimentDataDir)) {
            fs.mkdirSync(this.experimentDataDir, { recursive: true });
        }
    }

    async prepareExperimentData() {
        console.log('preparing ToxiEval-ZKP experiment data');
        this.ensureDataDir();

        const allRepairs = await this.dataProcessor.readAllSuccessfulRepairs();
        console.log(`loaded ${allRepairs.length} successful repairs`);

        const consolidatedFile = path.join(this.experimentDataDir, 'all_successful_repairs.json');
        fs.writeFileSync(
            consolidatedFile,
            JSON.stringify(
                {
                    metadata: {
                        totalRepairs: allRepairs.length,
                        timestamp: new Date().toISOString(),
                        source: 'ToxiEval/Claude-3.7-Sonnet output on the ToxiMol benchmark',
                        description: 'Consolidated successful molecular repairs from all tasks',
                    },
                    repairs: allRepairs,
                },
                null,
                2,
            ),
        );
        console.log(`wrote ${consolidatedFile}`);

        const taskBreakdown = {};
        for (const r of allRepairs) {
            const t = r.task || 'unknown';
            if (!taskBreakdown[t]) taskBreakdown[t] = [];
            taskBreakdown[t].push(r);
        }

        const breakdownFile = path.join(this.experimentDataDir, 'task_breakdown.json');
        fs.writeFileSync(
            breakdownFile,
            JSON.stringify(
                {
                    metadata: {
                        totalTasks: Object.keys(taskBreakdown).length,
                        totalRepairs: allRepairs.length,
                        timestamp: new Date().toISOString(),
                    },
                    tasks: Object.keys(taskBreakdown).map((task) => ({
                        task,
                        count: taskBreakdown[task].length,
                        percentage: (
                            (taskBreakdown[task].length / allRepairs.length) * 100
                        ).toFixed(1),
                    })),
                    breakdown: taskBreakdown,
                },
                null,
                2,
            ),
        );
        console.log(`wrote ${breakdownFile}`);

        const circuitInputs = allRepairs.map((r) => this.dataProcessor.convertToCircuitInput(r));
        const circuitInputFile = path.join(this.experimentDataDir, 'circuit_inputs.json');
        fs.writeFileSync(
            circuitInputFile,
            JSON.stringify(
                {
                    metadata: {
                        totalInputs: circuitInputs.length,
                        timestamp: new Date().toISOString(),
                        description: 'Circuit input format for ZK proof generation',
                    },
                    inputs: circuitInputs,
                },
                null,
                2,
            ),
        );
        console.log(`wrote ${circuitInputFile}`);

        for (const size of [10, 50, 100]) {
            if (allRepairs.length < size) continue;
            const sampleFile = path.join(this.experimentDataDir, `sample_${size}.json`);
            fs.writeFileSync(
                sampleFile,
                JSON.stringify(
                    {
                        metadata: {
                            sampleSize: size,
                            totalAvailable: allRepairs.length,
                            timestamp: new Date().toISOString(),
                            description: `Sample dataset of ${size} repairs for testing`,
                        },
                        repairs: allRepairs.slice(0, size),
                    },
                    null,
                    2,
                ),
            );
            console.log(`wrote ${sampleFile}`);
        }

        await this.generateDataSummary(allRepairs, taskBreakdown);
        console.log('experiment data preparation completed');
    }

    async generateDataSummary(allRepairs, taskBreakdown) {
        const summary = {
            overview: {
                totalRepairs: allRepairs.length,
                totalTasks: Object.keys(taskBreakdown).length,
                timestamp: new Date().toISOString(),
            },
            taskDistribution: Object.keys(taskBreakdown)
                .map((task) => ({
                    task,
                    count: taskBreakdown[task].length,
                    percentage: (
                        (taskBreakdown[task].length / allRepairs.length) * 100
                    ).toFixed(1),
                }))
                .sort((a, b) => b.count - a.count),
            qualityMetrics: {
                avgQED: (
                    allRepairs.reduce((s, r) => s + (r.qed || 0), 0) / allRepairs.length
                ).toFixed(3),
                avgSAS: (
                    allRepairs.reduce((s, r) => s + (r.sas_score || 0), 0) / allRepairs.length
                ).toFixed(3),
                avgSimilarity: (
                    allRepairs.reduce((s, r) => s + (r.similarity || 0), 0) / allRepairs.length
                ).toFixed(3),
                avgLipinskiViolations: (
                    allRepairs.reduce((s, r) => s + (r.lipinski_violations || 0), 0)
                    / allRepairs.length
                ).toFixed(3),
            },
            dataFiles: [
                'all_successful_repairs.json',
                'task_breakdown.json',
                'circuit_inputs.json',
                'sample_10.json',
                'sample_50.json',
                'sample_100.json',
            ],
        };

        const summaryFile = path.join(this.experimentDataDir, 'data_summary.json');
        fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
        console.log(`wrote ${summaryFile}`);

        console.log('');
        console.log('Data summary');
        console.log(`  total repairs              : ${summary.overview.totalRepairs}`);
        console.log(`  total tasks                : ${summary.overview.totalTasks}`);
        console.log(`  average QED                : ${summary.qualityMetrics.avgQED}`);
        console.log(`  average SAS                : ${summary.qualityMetrics.avgSAS}`);
        console.log(`  average similarity         : ${summary.qualityMetrics.avgSimilarity}`);
        console.log(`  average Lipinski violation : ${summary.qualityMetrics.avgLipinskiViolations}`);

        console.log('');
        console.log('Top 5 tasks by repair count');
        summary.taskDistribution.slice(0, 5).forEach((task) => {
            console.log(`  ${task.task}: ${task.count} (${task.percentage} %)`);
        });
    }
}

function showHelp() {
    console.log(
        [
            'ToxiEval-ZKP experiment data preparation',
            '',
            'Usage: node prepare_data.js [option]',
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
    new ExperimentDataPreparator().prepareExperimentData().catch((err) => {
        console.error('data preparation failed:', err.message);
        process.exit(1);
    });
}

module.exports = ExperimentDataPreparator;
