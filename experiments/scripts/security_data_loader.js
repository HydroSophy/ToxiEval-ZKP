#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Security Test Data Loader
 *
 * Loads and processes test data from failed and invalid molecular repairs
 * for security verification experiments
 */
class SecurityDataLoader {
 constructor() {
 this.basePath = path.join(process.cwd(), 'experiments', 'data', 'security_test_data');
 this.tasks = [
            'ames', 'carcinogens_lagunin', 'clintox', 'dili', 'herg',
            'herg_central', 'herg_karim', 'ld50_zhu', 'skin_reaction',
            'tox21', 'toxcast'
        ];
    }

    /**
     * Load all test data for security verification
     */
 async loadAllTestData() {
 console.log(' Loading security test data...');

 const testData = {
 validButFailed: [],
 invalidStructures: [],
 successfulRepairs: [],
 taskSummaries: {}
        };

 for (const task of this.tasks) {
 const taskData = await this.loadTaskData(task);

 if (taskData) {
 testData.validButFailed.push(...taskData.failed);
 testData.invalidStructures.push(...taskData.invalid);
 testData.successfulRepairs.push(...taskData.successful);
 testData.taskSummaries[task] = taskData.summary;
            }
        }

        // Generate statistics
 const stats = this.generateDataStatistics(testData);

 console.log(' Test data loaded successfully:');
 console.log(`   - Valid but failed repairs: ${testData.validButFailed.length}`);
 console.log(`   - Invalid structures: ${testData.invalidStructures.length}`);
 console.log(`   - Successful repairs: ${testData.successfulRepairs.length}`);
 console.log(`   - Total tasks processed: ${Object.keys(testData.taskSummaries).length}`);

 return { testData, stats };
    }

    /**
     * Load data for a specific task
     */
 async loadTaskData(task) {
 const taskPath = path.join(this.basePath, task);

 if (!fs.existsSync(taskPath)) {
 console.warn(` Task directory not found: ${task}`);
 return null;
        }

 const taskData = {
 failed: [],
 invalid: [],
 successful: [],
 summary: null
        };

 try {
            // Load failed repairs
 const failedPath = path.join(taskPath, 'failed_repairs.json');
 if (fs.existsSync(failedPath)) {
 const failedData = JSON.parse(fs.readFileSync(failedPath, 'utf8'));
 taskData.failed = failedData.results || [];
            }

            // Load invalid repairs
 const invalidPath = path.join(taskPath, 'invalid_repairs.json');
 if (fs.existsSync(invalidPath)) {
 const invalidData = JSON.parse(fs.readFileSync(invalidPath, 'utf8'));
 taskData.invalid = invalidData.results || [];
            }

            // Load successful repairs
 const successPath = path.join(taskPath, 'successful_repairs.json');
 if (fs.existsSync(successPath)) {
 const successData = JSON.parse(fs.readFileSync(successPath, 'utf8'));
 taskData.successful = successData.results || [];
            }

            // Load summary
 const summaryPath = path.join(taskPath, 'summary.json');
 if (fs.existsSync(summaryPath)) {
 taskData.summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
            }

        } catch (error) {
 console.error(` Error loading data for task ${task}:`, error.message);
 return null;
        }

 return taskData;
    }

    /**
     * Generate comprehensive statistics about the test data
     */
 generateDataStatistics(testData) {
 const stats = {
 totalMolecules: testData.validButFailed.length + testData.invalidStructures.length + testData.successfulRepairs.length,
 failureAnalysis: this.analyzeFailureReasons(testData.validButFailed),
 invalidityAnalysis: this.analyzeInvalidityReasons(testData.invalidStructures),
 taskDistribution: this.analyzeTaskDistribution(testData),
 securityTestCandidates: this.identifySecurityTestCandidates(testData)
        };

 return stats;
    }

    /**
     * Analyze failure reasons for valid but failed repairs
     */
 analyzeFailureReasons(failedRepairs) {
 const reasonCounts = {};
 const reasonCategories = {
 toxicity: 0,
 drugLikeness: 0,
 similarity: 0,
 lipinski: 0,
 multiple: 0
        };

 for (const repair of failedRepairs) {
 const message = repair.message || '';

 if (!reasonCounts[message]) {
 reasonCounts[message] = 0;
            }
 reasonCounts[message]++;

            // Categorize failures
 if (message.includes('Toxicity not reduced')) {
 reasonCategories.toxicity++;
            }
 if (message.includes('Insufficient drug-likeness')) {
 reasonCategories.drugLikeness++;
            }
 if (message.includes('Low structural similarity')) {
 reasonCategories.similarity++;
            }
 if (message.includes('Lipinski violations')) {
 reasonCategories.lipinski++;
            }
 if (message.split(',').length > 1) {
 reasonCategories.multiple++;
            }
        }

 return {
 reasonCounts,
 reasonCategories,
 totalFailed: failedRepairs.length
        };
    }

    /**
     * Analyze invalidity reasons for invalid structures
     */
 analyzeInvalidityReasons(invalidRepairs) {
 const errorCounts = {};
 const errorTypes = {
 invalidSMILES: 0,
 noValidSMILES: 0,
 other: 0
        };

 for (const repair of invalidRepairs) {
 const error = repair.error || '';

 if (!errorCounts[error]) {
 errorCounts[error] = 0;
            }
 errorCounts[error]++;

            // Categorize errors
 if (error.includes('Invalid SMILES')) {
 errorTypes.invalidSMILES++;
            } else if (error.includes('No valid SMILES')) {
 errorTypes.noValidSMILES++;
            } else {
 errorTypes.other++;
            }
        }

 return {
 errorCounts,
 errorTypes,
 totalInvalid: invalidRepairs.length
        };
    }

    /**
     * Analyze distribution across tasks
     */
 analyzeTaskDistribution(testData) {
 const distribution = {};

        // Count by task for each category
        ['validButFailed', 'invalidStructures', 'successfulRepairs'].forEach(category => {
 distribution[category] = {};

 for (const item of testData[category]) {
 const task = item.task;
 if (!distribution[category][task]) {
 distribution[category][task] = 0;
                }
 distribution[category][task]++;
            }
        });

 return distribution;
    }

    /**
     * Identify best candidates for security testing
     */
 identifySecurityTestCandidates(testData) {
 const candidates = {
 completenessTest: [],
 soundnessTest: [],
 zkTest: [],
 attackTest: []
        };

        // Completeness test: use successful repairs
 candidates.completenessTest = testData.successfulRepairs
            .filter(repair => repair.qed >= 0.5 && repair.sas_score <= 6)
            .slice(0, 50);

        // Soundness test: use failed and invalid repairs
 candidates.soundnessTest = [
            ...testData.validButFailed.slice(0, 30),
            ...testData.invalidStructures.slice(0, 20)
        ];

        // Zero-knowledge test: use diverse successful repairs
 candidates.zkTest = testData.successfulRepairs
            .filter((repair, index) => index % 5 === 0) // Every 5th repair for diversity
            .slice(0, 20);

        // Attack test: use edge cases and invalid structures
 candidates.attackTest = [
            ...testData.invalidStructures.filter(repair =>
 repair.error && repair.error.includes('Invalid SMILES')
            ).slice(0, 15),
            ...testData.validButFailed.filter(repair =>
 repair.message && repair.message.includes('multiple')
            ).slice(0, 10)
        ];

 return candidates;
    }

    /**
     * Generate attack vectors from failed data
     */
 generateAttackVectors(testData) {
 const attackVectors = [];

        // Boundary value attacks from failed repairs
 const extremeValues = this.findExtremeValues(testData.validButFailed);
 attackVectors.push({
 type: 'boundary_values',
 description: 'Extreme boundary values found in failed repairs',
 vectors: extremeValues
        });

        // Malformed input attacks from invalid repairs
 const malformedInputs = this.extractMalformedInputs(testData.invalidStructures);
 attackVectors.push({
 type: 'malformed_inputs',
 description: 'Malformed inputs from invalid repairs',
 vectors: malformedInputs
        });

        // Edge case attacks from successful repairs
 const edgeCases = this.findEdgeCases(testData.successfulRepairs);
 attackVectors.push({
 type: 'edge_cases',
 description: 'Edge cases from successful repairs',
 vectors: edgeCases
        });

 return attackVectors;
    }

    /**
     * Find extreme values in failed repairs
     */
 findExtremeValues(failedRepairs) {
 const extremes = {
 qed: { min: Infinity, max: -Infinity },
 sas_score: { min: Infinity, max: -Infinity },
 similarity: { min: Infinity, max: -Infinity },
 lipinski_violations: { min: Infinity, max: -Infinity }
        };

 for (const repair of failedRepairs) {
            ['qed', 'sas_score', 'similarity', 'lipinski_violations'].forEach(field => {
 if (repair[field] !== undefined) {
 extremes[field].min = Math.min(extremes[field].min, repair[field]);
 extremes[field].max = Math.max(extremes[field].max, repair[field]);
                }
            });
        }

 return extremes;
    }

    /**
     * Extract malformed inputs from invalid repairs
     */
 extractMalformedInputs(invalidRepairs) {
 return invalidRepairs.map(repair => ({
 originalSMILES: repair.original_smiles,
 modifiedSMILES: repair.modified_smiles,
 error: repair.error,
 moleculeId: repair.molecule_id
        }));
    }

    /**
     * Find edge cases in successful repairs
     */
 findEdgeCases(successfulRepairs) {
 const edgeCases = [];

        // Find repairs with values close to thresholds
 for (const repair of successfulRepairs) {
 const isEdgeCase = (
                (repair.qed >= 0.49 && repair.qed <= 0.51) ||
                (repair.sas_score >= 5.8 && repair.sas_score <= 6.2) ||
                (repair.similarity >= 0.38 && repair.similarity <= 0.42) ||
 repair.lipinski_violations === 1
            );

 if (isEdgeCase) {
 edgeCases.push(repair);
            }
        }

 return edgeCases.slice(0, 20);
    }

    /**
     * Save processed test data for later use
     */
 async saveProcessedData(testData, stats, outputPath) {
 const processedData = {
 timestamp: new Date().toISOString(),
 testData,
 statistics: stats,
 attackVectors: this.generateAttackVectors(testData)
        };

 fs.writeFileSync(outputPath, JSON.stringify(processedData, null, 2));
 console.log(` Processed test data saved to: ${outputPath}`);

 return processedData;
    }
}

// Export for use in other modules
module.exports = SecurityDataLoader;

// Main execution if called directly
if (require.main === module) {
 async function main() {
 const loader = new SecurityDataLoader();

 try {
 const { testData, stats } = await loader.loadAllTestData();

            // Save processed data
 const outputPath = path.join(process.cwd(), 'experiments', 'data',
                                       `security_test_data_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
 await loader.saveProcessedData(testData, stats, outputPath);

 console.log('\n Data Loading Summary:');
 console.log('-'.repeat(40));
 console.log(`Total molecules processed: ${stats.totalMolecules}`);
 console.log(`Failure categories: ${Object.keys(stats.failureAnalysis.reasonCategories).length}`);
 console.log(`Invalid error types: ${Object.keys(stats.invalidityAnalysis.errorTypes).length}`);
 console.log(`Tasks processed: ${Object.keys(testData.taskSummaries).length}`);

        } catch (error) {
 console.error(' Data loading failed:', error);
 process.exit(1);
        }
    }

 main();
}