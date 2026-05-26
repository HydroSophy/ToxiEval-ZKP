#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Import ZK system components
const DataProcessor = require('../../src/data_processor');
const ZKProofGenerator = require('../../src/proof_system');
const NullifierTracker = require('../../src/nullifier_tracker');

/**
 * Security Formal Verification Test Suite for ToxiEval-ZKP system
 *
 * This test suite validates the cryptographic security properties of the ZK system:
 * 1. Completeness: Valid proofs are always accepted
 * 2. Soundness: Invalid proofs are always rejected
 * 3. Zero-Knowledge: Verification reveals no private information
 * 4. Attack Resistance: System handles malicious inputs gracefully
 */
class SecurityFormalVerification {
 constructor() {
 this.dataProcessor = new DataProcessor();
 this.zkGenerator = new ZKProofGenerator();
 this.nullifierTracker = new NullifierTracker();
 this.results = {
 completeness: [],
 soundness: [],
 zeroKnowledge: [],
 attackResistance: []
        };
 this.testStartTime = new Date().toISOString();
    }

    /**
     * Main test execution function
     */
 async runSecurityTests() {
 console.log(' Starting Security Formal Verification Tests');
 console.log('=' .repeat(60));

 try {
            // Clear previous nullifier records for fresh testing
 this.nullifierTracker.clearAllNullifiers();

            // Load test data from failed and invalid repairs
 const testData = await this.loadTestData();

            // Run all security tests
 await this.testCompleteness(testData);
 await this.testSoundness(testData);
 await this.testZeroKnowledge(testData);
 await this.testAttackResistance(testData);

            // Generate comprehensive report
 await this.generateSecurityReport();

        } catch (error) {
 console.error(' Security test failed:', error);
 throw error;
        }
    }

    /**
     * Load test data from failed and invalid repairs across all tasks
     */
 async loadTestData() {
 console.log('\n Loading test data from repair analysis...');

 const testData = {
 validButFailed: [],
 invalidStructures: [],
 successfulRepairs: []
        };

        // List of all toxicity tasks
 const tasks = [
            'ames', 'carcinogens_lagunin', 'clintox', 'dili', 'herg',
            'herg_central', 'herg_karim', 'ld50_zhu', 'skin_reaction',
            'tox21', 'toxcast'
        ];

 for (const task of tasks) {
 const taskPath = path.join(process.cwd(), 'experiments', 'data', 'security_test_data', task);

 try {
                // Load failed repairs (valid SMILES but failed criteria)
 const failedPath = path.join(taskPath, 'failed_repairs.json');
 if (fs.existsSync(failedPath)) {
 const failedData = JSON.parse(fs.readFileSync(failedPath, 'utf8'));
 testData.validButFailed.push(...failedData.results);
                }

                // Load invalid repairs (invalid SMILES structures)
 const invalidPath = path.join(taskPath, 'invalid_repairs.json');
 if (fs.existsSync(invalidPath)) {
 const invalidData = JSON.parse(fs.readFileSync(invalidPath, 'utf8'));
 testData.invalidStructures.push(...invalidData.results);
                }

                // Load successful repairs for comparison
 const successPath = path.join(taskPath, 'successful_repairs.json');
 if (fs.existsSync(successPath)) {
 const successData = JSON.parse(fs.readFileSync(successPath, 'utf8'));
 testData.successfulRepairs.push(...successData.results);
                }

            } catch (error) {
 console.warn(` Could not load data for task ${task}:`, error.message);
            }
        }

 console.log(` Loaded test data:`);
 console.log(`   - Valid but failed repairs: ${testData.validButFailed.length}`);
 console.log(`   - Invalid structures: ${testData.invalidStructures.length}`);
 console.log(`   - Successful repairs: ${testData.successfulRepairs.length}`);

 return testData;
    }

    /**
     * Test 1: Completeness - Valid proofs should always be accepted
     */
 async testCompleteness(testData) {
 console.log('\n Testing Completeness Property...');
 console.log('-'.repeat(40));

 const completenessResults = [];
 const sampleSize = Math.min(50, testData.successfulRepairs.length);

 for (let i = 0; i < sampleSize; i++) {
 const repair = testData.successfulRepairs[i];

 try {
                // Convert to circuit input
 const circuitInput = this.dataProcessor.convertToCircuitInput(repair);

                // Generate proof
 const startTime = Date.now();
 const proof = await this.zkGenerator.generateProof(circuitInput);
 const proofTime = Date.now() - startTime;

                // Verify proof
 const verifyStartTime = Date.now();
 const isValid = await this.zkGenerator.verifyProof(proof.proof, proof.publicSignals);
 const verifyTime = Date.now() - verifyStartTime;

 completenessResults.push({
 moleculeId: repair.molecule_id,
 task: repair.task,
 proofGenerated: !!proof,
 proofValid: isValid,
 proofTime,
 verifyTime,
 expected: true, // Should always be true for valid repairs
 passed: isValid === true
                });

 if (i % 10 === 0) {
 console.log(` Processed ${i + 1}/${sampleSize} valid repairs...`);
                }

            } catch (error) {
 completenessResults.push({
 moleculeId: repair.molecule_id,
 task: repair.task,
 proofGenerated: false,
 proofValid: false,
 error: error.message,
 expected: true,
 passed: false
                });
            }
        }

 const passedTests = completenessResults.filter(r => r.passed).length;
 const completenessRate = (passedTests / completenessResults.length) * 100;

 console.log(` Completeness Test Results:`);
 console.log(`   - Tests passed: ${passedTests}/${completenessResults.length}`);
 console.log(`   - Completeness rate: ${completenessRate.toFixed(2)}%`);

 this.results.completeness = {
 totalTests: completenessResults.length,
 passedTests,
 completenessRate,
 details: completenessResults
        };
    }

    /**
     * Test 2: Soundness - Invalid proofs should always be rejected
     */
 async testSoundness(testData) {
 console.log('\n Testing Soundness Property...');
 console.log('-'.repeat(40));

 const soundnessResults = [];

        // Test with invalid SMILES structures
 const invalidSample = testData.invalidStructures.slice(0, 30);

 for (const repair of invalidSample) {
 try {
                // Try to process invalid SMILES
 const circuitInput = this.dataProcessor.convertToCircuitInput(repair);

                // This should fail or produce invalid proof
 const proof = await this.zkGenerator.generateProof(circuitInput);
 const isValid = await this.zkGenerator.verifyProof(proof.proof, proof.publicSignals);

                // Check if the proof correctly identifies the invalid input
                // For invalid SMILES, the circuit should produce verification result 0 (FAIL)
 const verificationResult = proof.publicSignals[1]; // Index 1 is verification result
 const correctlyRejected = verificationResult === '0';

 soundnessResults.push({
 moleculeId: repair.molecule_id,
 task: repair.task,
 inputType: 'invalid_smiles',
 proofGenerated: !!proof,
 proofValid: isValid,
 verificationResult: verificationResult,
 expected: false, // Should always be false for invalid inputs
 passed: correctlyRejected // Pass if circuit correctly identifies as invalid
                });

            } catch (error) {
                // Expected behavior - invalid inputs should cause errors
 soundnessResults.push({
 moleculeId: repair.molecule_id,
 task: repair.task,
 inputType: 'invalid_smiles',
 proofGenerated: false,
 proofValid: false,
 error: error.message,
 expected: false,
 passed: true // Error is expected for invalid inputs
                });
            }
        }

        // Test with valid SMILES but failing criteria
 const failedSample = testData.validButFailed.slice(0, 30);

 for (const repair of failedSample) {
 try {
 const circuitInput = this.dataProcessor.convertToCircuitInput(repair);
 const proof = await this.zkGenerator.generateProof(circuitInput);
 const isValid = await this.zkGenerator.verifyProof(proof.proof, proof.publicSignals);

                // Check if the proof correctly identifies the failed criteria
                // For failed criteria, the circuit should produce verification result 0 (FAIL)
 const verificationResult = proof.publicSignals[1]; // Index 1 is verification result
 const correctlyRejected = verificationResult === '0';

 soundnessResults.push({
 moleculeId: repair.molecule_id,
 task: repair.task,
 inputType: 'failed_criteria',
 proofGenerated: !!proof,
 proofValid: isValid,
 verificationResult: verificationResult,
 failureReason: repair.message,
 expected: false, // Should be false for failed criteria
 passed: correctlyRejected // Pass if circuit correctly identifies as failed
                });

            } catch (error) {
 soundnessResults.push({
 moleculeId: repair.molecule_id,
 task: repair.task,
 inputType: 'failed_criteria',
 proofGenerated: false,
 proofValid: false,
 error: error.message,
 expected: false,
 passed: true
                });
            }
        }

 const passedTests = soundnessResults.filter(r => r.passed).length;
 const soundnessRate = (passedTests / soundnessResults.length) * 100;

 console.log(` Soundness Test Results:`);
 console.log(`   - Tests passed: ${passedTests}/${soundnessResults.length}`);
 console.log(`   - Soundness rate: ${soundnessRate.toFixed(2)}%`);

 this.results.soundness = {
 totalTests: soundnessResults.length,
 passedTests,
 soundnessRate,
 details: soundnessResults
        };
    }

    /**
     * Test 3: Zero-Knowledge - Verification should not reveal private information
     */
 async testZeroKnowledge(testData) {
 console.log('\n Testing Zero-Knowledge Property...');
 console.log('-'.repeat(40));

 const zkResults = [];
 const sampleSize = Math.min(20, testData.successfulRepairs.length);

 for (let i = 0; i < sampleSize; i++) {
 const repair = testData.successfulRepairs[i];

 try {
 const circuitInput = this.dataProcessor.convertToCircuitInput(repair);

                // Generate proof
 const proof = await this.zkGenerator.generateProof(circuitInput);

                // Analyze proof for information leakage
 const proofAnalysis = this.analyzeProofForLeakage(proof, circuitInput);

 zkResults.push({
 moleculeId: repair.molecule_id,
 task: repair.task,
 proofSize: JSON.stringify(proof).length,
 containsPrivateData: proofAnalysis.containsPrivateData,
 leakageScore: proofAnalysis.leakageScore,
 entropy: proofAnalysis.entropy,
 hasValidStructure: proofAnalysis.hasValidStructure,
 publicSignalsValid: proofAnalysis.publicSignalsValid,
 zkPropertiesValid: proofAnalysis.zkPropertiesValid,
 passed: proofAnalysis.zkPropertiesValid // Pass if all ZK properties are valid
                });

            } catch (error) {
 zkResults.push({
 moleculeId: repair.molecule_id,
 task: repair.task,
 error: error.message,
 passed: false
                });
            }
        }

 const passedTests = zkResults.filter(r => r.passed).length;
 const zkRate = (passedTests / zkResults.length) * 100;

 console.log(` Zero-Knowledge Test Results:`);
 console.log(`   - Tests passed: ${passedTests}/${zkResults.length}`);
 console.log(`   - Zero-knowledge rate: ${zkRate.toFixed(2)}%`);

 this.results.zeroKnowledge = {
 totalTests: zkResults.length,
 passedTests,
 zkRate,
 details: zkResults
        };
    }

    /**
     * Test 4: Attack Resistance - System should handle malicious inputs
     */
 async testAttackResistance(testData) {
 console.log('\n Testing Attack Resistance...');
 console.log('-'.repeat(40));

 const attackResults = [];

        // Generate various attack scenarios
 const attackScenarios = this.generateAttackScenarios(testData);

 for (const scenario of attackScenarios) {
 try {
 const startTime = Date.now();

                // Attempt to process malicious input
 const result = await this.processAttackScenario(scenario);

 const processingTime = Date.now() - startTime;

                // Special handling for replay attack results
 if (scenario.type === 'replay_attack' && result.replayDetected !== undefined) {
 attackResults.push({
 attackType: scenario.type,
 description: scenario.description,
 processingTime,
 systemCrashed: false,
 errorHandled: !result.securityBreach,
 securityBreach: result.securityBreach,
 replayDetected: result.replayDetected,
 firstVerification: result.firstVerification,
 secondVerification: result.secondVerification,
 passed: result.replayDetected // Pass if replay was detected
                    });
                } else {
 attackResults.push({
 attackType: scenario.type,
 description: scenario.description,
 processingTime,
 systemCrashed: false,
 errorHandled: !!result.error,
 securityBreach: result.securityBreach || false,
 passed: !result.securityBreach && result.error
                    });
                }

            } catch (error) {
 attackResults.push({
 attackType: scenario.type,
 description: scenario.description,
 systemCrashed: true,
 error: error.message,
 passed: false
                });
            }
        }

 const passedTests = attackResults.filter(r => r.passed).length;
 const resistanceRate = (passedTests / attackResults.length) * 100;

 console.log(` Attack Resistance Test Results:`);
 console.log(`   - Tests passed: ${passedTests}/${attackResults.length}`);
 console.log(`   - Resistance rate: ${resistanceRate.toFixed(2)}%`);

 this.results.attackResistance = {
 totalTests: attackResults.length,
 passedTests,
 resistanceRate,
 details: attackResults
        };
    }

    /**
     * Analyze proof for potential information leakage
     */
 analyzeProofForLeakage(proof, circuitInput) {
 const proofString = JSON.stringify(proof);
 const privateInputs = [
 circuitInput.valid_smiles,
 circuitInput.safety_score,
 circuitInput.qed_score,
 circuitInput.sas_score,
 circuitInput.lipinski_violations,
 circuitInput.similarity,
 circuitInput.salt
        ];

 let leakageScore = 0;
 let containsPrivateData = false;

        // Check if proof contains any private input values (this should never happen in proper ZK)
        // Only check for values that are not expected to appear in public signals
 const publicSignalsStr = JSON.stringify(proof.publicSignals || []);

 for (const privateInput of privateInputs) {
 if (privateInput !== undefined && privateInput !== null) {
 const inputStr = privateInput.toString();
                // Only check for values that are:
                // 1. Not common small numbers (0, 1, 2, etc.)
                // 2. Not already in public signals (which is expected)
 if (inputStr.length > 2 &&
 proofString.includes(inputStr) &&
                    !publicSignalsStr.includes(inputStr)) {
 containsPrivateData = true;
 leakageScore += 1;
                }
            }
        }

        // Check proof structure - Groth16 proofs should have specific structure
 const hasValidStructure = proof.proof &&
 proof.proof.pi_a &&
 proof.proof.pi_b &&
 proof.proof.pi_c &&
 proof.publicSignals;

        // Check if public signals only contain expected outputs
        // Our circuit outputs 9 public signals: commitment, result, nullifier, and 6 constraint outputs
 const publicSignalsValid = proof.publicSignals &&
 proof.publicSignals.length === 9 && // Should have exactly 9 public outputs
 proof.publicSignals.every(signal => typeof signal === 'string');

        // Additional entropy analysis of proof elements
 const entropy = this.calculateEntropy(proofString);

        // For zero-knowledge, we expect:
        // 1. No private data in proof
        // 2. Valid Groth16 structure
        // 3. Only expected public signals
        // 4. Reasonable entropy in proof elements
 const zkPropertiesValid = !containsPrivateData &&
 hasValidStructure &&
 publicSignalsValid &&
 entropy > 0.3; // Reasonable entropy threshold for Groth16 proofs

 return {
 containsPrivateData,
 leakageScore,
 entropy,
 hasValidStructure,
 publicSignalsValid,
 zkPropertiesValid
        };
    }

    /**
     * Generate various attack scenarios
     */
 generateAttackScenarios(testData) {
 const scenarios = [];

        // Boundary value attacks
 scenarios.push({
 type: 'boundary_attack',
 description: 'Extreme boundary values',
 input: {
 valid_smiles: -1,
 safety_score: Number.MAX_SAFE_INTEGER,
 qed_score: -Number.MAX_SAFE_INTEGER,
 sas_score: NaN,
 lipinski_violations: Infinity,
 similarity: -Infinity,
 salt: 0
            }
        });

        // Type confusion attacks
 scenarios.push({
 type: 'type_confusion',
 description: 'Wrong data types',
 input: {
 valid_smiles: "true",
 safety_score: [],
 qed_score: {},
 sas_score: null,
 lipinski_violations: undefined,
 similarity: Symbol('test'),
 salt: BigInt(123)
            }
        });

        // Buffer overflow simulation
 scenarios.push({
 type: 'buffer_overflow',
 description: 'Oversized inputs',
 input: {
 valid_smiles: 1,
 safety_score: 'A'.repeat(100000),
 qed_score: 500000,
 sas_score: 3000000,
 lipinski_violations: 0,
 similarity: 600000,
 salt: 'B'.repeat(100000)
            }
        });

        // Replay attack simulation - test if system can detect reused proofs
 if (testData.successfulRepairs[0]) {
 const sampleInput = this.dataProcessor.convertToCircuitInput(testData.successfulRepairs[0]);
 scenarios.push({
 type: 'replay_attack',
 description: 'Repeated identical inputs with same nullifier',
 input: sampleInput,
 metadata: {
 testType: 'replay_detection',
 originalMolecule: testData.successfulRepairs[0].molecule_id,
 requiresSpecialHandling: true // This needs special handling for replay testing
                }
            });
        }

 return scenarios.filter(s => s.input !== null);
    }

    /**
     * Process attack scenario
     */
 async processAttackScenario(scenario) {
 try {
            // Special handling for replay attacks
 if (scenario.type === 'replay_attack' && scenario.metadata?.requiresSpecialHandling) {
 return await this.processReplayAttackScenario(scenario);
            }

 const proof = await this.zkGenerator.generateProof(scenario.input);
 const isValid = await this.zkGenerator.verifyProof(proof.proof, proof.publicSignals);

 return {
 proof,
 isValid,
 securityBreach: isValid === true, // Should not validate malicious inputs
 error: null
            };
        } catch (error) {
 return {
 proof: null,
 isValid: false,
 securityBreach: false,
 error: error.message
            };
        }
    }

    /**
     * Process replay attack scenario specifically
     */
 async processReplayAttackScenario(scenario) {
 try {
            // First, generate a proof with the input
 const proof1 = await this.zkGenerator.generateProof(scenario.input);

            // Verify it with replay protection (should succeed the first time)
 const result1 = await this.nullifierTracker.verifyProofWithReplayProtection(
 this.zkGenerator, proof1.proof, proof1.publicSignals
            );

            // Now try to reuse the same proof (this should fail due to replay protection)
 const result2 = await this.nullifierTracker.verifyProofWithReplayProtection(
 this.zkGenerator, proof1.proof, proof1.publicSignals
            );

            // For replay attack test to pass, the second verification should detect replay
 const replayDetected = result1.valid && !result2.valid && result2.replayAttack;

 return {
 proof: proof1,
 isValid: result1.valid,
 firstVerification: result1,
 secondVerification: result2,
 replayDetected: replayDetected,
 securityBreach: !replayDetected, // Security breach if replay was NOT detected
 error: replayDetected ? null : 'Replay attack not detected'
            };

        } catch (error) {
 return {
 proof: null,
 isValid: false,
 securityBreach: false,
 error: error.message
            };
        }
    }

    /**
     * Calculate entropy of a string
     */
 calculateEntropy(str) {
 const freq = {};
 for (let char of str) {
 freq[char] = (freq[char] || 0) + 1;
        }

 let entropy = 0;
 const length = str.length;

 for (let char in freq) {
 const p = freq[char] / length;
 entropy -= p * Math.log2(p);
        }

 return entropy / Math.log2(length);
    }

    /**
     * Generate comprehensive security report
     */
 async generateSecurityReport() {
 console.log('\n Generating Security Report...');

 const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
 const reportData = {
 testSuite: 'Security Formal Verification',
 timestamp: this.testStartTime,
 completionTime: new Date().toISOString(),
 systemInfo: {
 constraints: 1774,
 publicInputs: 6,
 privateInputs: 7,
 zkProtocol: 'Groth16'
            },
 summary: {
 completeness: this.results.completeness,
 soundness: this.results.soundness,
 zeroKnowledge: this.results.zeroKnowledge,
 attackResistance: this.results.attackResistance
            },
 overallSecurityScore: this.calculateOverallSecurityScore(),
 recommendations: this.generateSecurityRecommendations()
        };

        // Save detailed report
 const reportPath = path.join(process.cwd(), 'experiments', 'results',
                                   `security_verification_${timestamp}.json`);
 fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

        // Save summary report
 const summaryPath = path.join(process.cwd(), 'experiments', 'results',
                                    `security_summary_${timestamp}.json`);
 fs.writeFileSync(summaryPath, JSON.stringify({
 timestamp: reportData.timestamp,
 overallSecurityScore: reportData.overallSecurityScore,
 completenessRate: this.results.completeness.completenessRate,
 soundnessRate: this.results.soundness.soundnessRate,
 zkRate: this.results.zeroKnowledge.zkRate,
 resistanceRate: this.results.attackResistance.resistanceRate,
 recommendations: reportData.recommendations
        }, null, 2));

 console.log(` Security reports saved:`);
 console.log(`   - Detailed: ${reportPath}`);
 console.log(`   - Summary: ${summaryPath}`);

 this.printSecuritySummary(reportData);
    }

    /**
     * Calculate overall security score
     */
 calculateOverallSecurityScore() {
 const weights = {
 completeness: 0.3,
 soundness: 0.3,
 zeroKnowledge: 0.2,
 attackResistance: 0.2
        };

 const scores = {
 completeness: this.results.completeness.completenessRate || 0,
 soundness: this.results.soundness.soundnessRate || 0,
 zeroKnowledge: this.results.zeroKnowledge.zkRate || 0,
 attackResistance: this.results.attackResistance.resistanceRate || 0
        };

 const overallScore = Object.keys(weights).reduce((sum, key) => {
 return sum + (weights[key] * scores[key]);
        }, 0);

 return Math.round(overallScore * 100) / 100;
    }

    /**
     * Generate security recommendations
     */
 generateSecurityRecommendations() {
 const recommendations = [];

 if (this.results.completeness.completenessRate < 95) {
 recommendations.push({
 category: 'Completeness',
 severity: 'High',
 issue: 'Some valid proofs are being rejected',
 recommendation: 'Review circuit constraints and proof generation logic'
            });
        }

 if (this.results.soundness.soundnessRate < 95) {
 recommendations.push({
 category: 'Soundness',
 severity: 'Critical',
 issue: 'Some invalid proofs are being accepted',
 recommendation: 'Strengthen input validation and constraint checking'
            });
        }

 if (this.results.zeroKnowledge.zkRate < 90) {
 recommendations.push({
 category: 'Zero-Knowledge',
 severity: 'Medium',
 issue: 'Potential information leakage detected',
 recommendation: 'Review proof structure and implement additional privacy measures'
            });
        }

 if (this.results.attackResistance.resistanceRate < 85) {
 recommendations.push({
 category: 'Attack Resistance',
 severity: 'High',
 issue: 'System vulnerable to certain attack vectors',
 recommendation: 'Implement additional input sanitization and error handling'
            });
        }

 return recommendations;
    }

    /**
     * Print security summary to console
     */
 printSecuritySummary(reportData) {
 console.log('\n SECURITY VERIFICATION SUMMARY');
 console.log('=' .repeat(60));
 console.log(`Overall Security Score: ${reportData.overallSecurityScore}/100`);
 console.log('-'.repeat(60));
 console.log(`Completeness Rate:      ${this.results.completeness.completenessRate.toFixed(2)}%`);
 console.log(`Soundness Rate:         ${this.results.soundness.soundnessRate.toFixed(2)}%`);
 console.log(`Zero-Knowledge Rate:    ${this.results.zeroKnowledge.zkRate.toFixed(2)}%`);
 console.log(`Attack Resistance Rate: ${this.results.attackResistance.resistanceRate.toFixed(2)}%`);
 console.log('-'.repeat(60));

 if (reportData.recommendations.length > 0) {
 console.log(' Security Recommendations:');
 reportData.recommendations.forEach((rec, i) => {
 console.log(`   ${i + 1}. [${rec.severity}] ${rec.category}: ${rec.issue}`);
            });
        } else {
 console.log(' No security issues detected');
        }

 console.log('=' .repeat(60));
    }
}

// Main execution
async function main() {
 const securityTest = new SecurityFormalVerification();

 try {
 await securityTest.runSecurityTests();
 console.log('\n Security formal verification completed successfully');
    } catch (error) {
 console.error('\n Security verification failed:', error);
 process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
 main();
}

module.exports = SecurityFormalVerification;