#!/usr/bin/env node

const crypto = require('crypto');

/**
 * Attack Resistance Tester
 *
 * Tests the ZK system's resistance to various attack vectors including:
 * - Boundary value attacks
 * - Type confusion attacks
 * - Buffer overflow attempts
 * - Replay attacks
 * - Malformed input attacks
 */
class AttackResistanceTester {
 constructor(zkGenerator, dataProcessor) {
 this.zkGenerator = zkGenerator;
 this.dataProcessor = dataProcessor;
 this.attackResults = [];
    }

    /**
     * Run comprehensive attack resistance tests
     */
 async runAttackTests(testData) {
 console.log(' Running Attack Resistance Tests...');
 console.log('-'.repeat(40));

 const attackScenarios = [
            ...this.generateBoundaryValueAttacks(),
            ...this.generateTypeConfusionAttacks(),
            ...this.generateBufferOverflowAttacks(),
            ...this.generateReplayAttacks(testData),
            ...this.generateMalformedInputAttacks(testData),
            ...this.generateTimingAttacks(testData),
            ...this.generateMemoryExhaustionAttacks()
        ];

 for (let i = 0; i < attackScenarios.length; i++) {
 const scenario = attackScenarios[i];
 console.log(` Testing ${scenario.type} (${i + 1}/${attackScenarios.length})...`);

 const result = await this.executeAttackScenario(scenario);
 this.attackResults.push(result);
        }

 return this.analyzeAttackResults();
    }

    /**
     * Generate boundary value attack scenarios
     */
 generateBoundaryValueAttacks() {
 return [
            {
 type: 'boundary_negative_values',
 description: 'Negative values for positive-only fields',
 input: {
 valid_smiles: -1,
 safety_score: -1000000,
 qed_score: -500000,
 sas_score: -1000000,
 lipinski_violations: -1,
 similarity: -600000,
 salt: -12345,
 task_type: 0,
 safety_threshold: 0,
 qed_threshold: 500000,
 sas_threshold: 6000000,
 lipinski_threshold: 1,
 similarity_threshold: 400000
                }
            },
            {
 type: 'boundary_maximum_values',
 description: 'Maximum safe integer values',
 input: {
 valid_smiles: Number.MAX_SAFE_INTEGER,
 safety_score: Number.MAX_SAFE_INTEGER,
 qed_score: Number.MAX_SAFE_INTEGER,
 sas_score: Number.MAX_SAFE_INTEGER,
 lipinski_violations: Number.MAX_SAFE_INTEGER,
 similarity: Number.MAX_SAFE_INTEGER,
 salt: Number.MAX_SAFE_INTEGER,
 task_type: Number.MAX_SAFE_INTEGER,
 safety_threshold: Number.MAX_SAFE_INTEGER,
 qed_threshold: Number.MAX_SAFE_INTEGER,
 sas_threshold: Number.MAX_SAFE_INTEGER,
 lipinski_threshold: Number.MAX_SAFE_INTEGER,
 similarity_threshold: Number.MAX_SAFE_INTEGER
                }
            },
            {
 type: 'boundary_infinity_values',
 description: 'Infinity and NaN values',
 input: {
 valid_smiles: Infinity,
 safety_score: -Infinity,
 qed_score: NaN,
 sas_score: Infinity,
 lipinski_violations: NaN,
 similarity: -Infinity,
 salt: NaN,
 task_type: 0,
 safety_threshold: Infinity,
 qed_threshold: NaN,
 sas_threshold: -Infinity,
 lipinski_threshold: Infinity,
 similarity_threshold: NaN
                }
            }
        ];
    }

    /**
     * Generate type confusion attack scenarios
     */
 generateTypeConfusionAttacks() {
 return [
            {
 type: 'type_confusion_strings',
 description: 'String values instead of numbers',
 input: {
 valid_smiles: "true",
 safety_score: "1000000",
 qed_score: "invalid",
 sas_score: "null",
 lipinski_violations: "zero",
 similarity: "high",
 salt: "random",
 task_type: "binary",
 safety_threshold: "low",
 qed_threshold: "medium",
 sas_threshold: "high",
 lipinski_threshold: "one",
 similarity_threshold: "threshold"
                }
            },
            {
 type: 'type_confusion_objects',
 description: 'Object and array values',
 input: {
 valid_smiles: {},
 safety_score: [],
 qed_score: { value: 500000 },
 sas_score: [3, 0, 0, 0, 0, 0, 0],
 lipinski_violations: null,
 similarity: undefined,
 salt: { random: true },
 task_type: [],
 safety_threshold: {},
 qed_threshold: null,
 sas_threshold: undefined,
 lipinski_threshold: [],
 similarity_threshold: {}
                }
            },
            {
 type: 'type_confusion_functions',
 description: 'Function and symbol values',
 input: {
 valid_smiles: function() { return 1; },
 safety_score: Symbol('safety'),
 qed_score: () => 500000,
 sas_score: new Date(),
 lipinski_violations: /regex/,
 similarity: new Error('test'),
 salt: Buffer.from('test'),
 task_type: 0,
 safety_threshold: 0,
 qed_threshold: 500000,
 sas_threshold: 6000000,
 lipinski_threshold: 1,
 similarity_threshold: 400000
                }
            }
        ];
    }

    /**
     * Generate buffer overflow attack scenarios
     */
 generateBufferOverflowAttacks() {
 const largeString = 'A'.repeat(1000000); // 1MB string
 const largeArray = new Array(1000000).fill(1);

 return [
            {
 type: 'buffer_overflow_strings',
 description: 'Extremely large string inputs',
 input: {
 valid_smiles: largeString,
 safety_score: largeString,
 qed_score: largeString,
 sas_score: largeString,
 lipinski_violations: largeString,
 similarity: largeString,
 salt: largeString,
 task_type: 0,
 safety_threshold: 0,
 qed_threshold: 500000,
 sas_threshold: 6000000,
 lipinski_threshold: 1,
 similarity_threshold: 400000
                }
            },
            {
 type: 'buffer_overflow_arrays',
 description: 'Extremely large array inputs',
 input: {
 valid_smiles: largeArray,
 safety_score: largeArray,
 qed_score: largeArray,
 sas_score: largeArray,
 lipinski_violations: largeArray,
 similarity: largeArray,
 salt: largeArray,
 task_type: 0,
 safety_threshold: 0,
 qed_threshold: 500000,
 sas_threshold: 6000000,
 lipinski_threshold: 1,
 similarity_threshold: 400000
                }
            }
        ];
    }

    /**
     * Generate replay attack scenarios
     */
 generateReplayAttacks(testData) {
 if (!testData.successfulRepairs || testData.successfulRepairs.length === 0) {
 return [];
        }

 const sampleRepair = testData.successfulRepairs[0];
 const circuitInput = this.dataProcessor.convertToCircuitInput(sampleRepair);

 return [
            {
 type: 'replay_attack_identical',
 description: 'Identical input replay',
 input: circuitInput,
 metadata: { originalMolecule: sampleRepair.molecule_id }
            },
            {
 type: 'replay_attack_modified_salt',
 description: 'Modified salt replay',
 input: { ...circuitInput, salt: circuitInput.salt + 1 },
 metadata: { originalMolecule: sampleRepair.molecule_id }
            },
            {
 type: 'replay_attack_timestamp',
 description: 'Timestamp-based replay',
 input: { ...circuitInput, timestamp: Date.now() },
 metadata: { originalMolecule: sampleRepair.molecule_id }
            }
        ];
    }

    /**
     * Generate malformed input attacks based on invalid repairs
     */
 generateMalformedInputAttacks(testData) {
 const attacks = [];

 if (testData.invalidStructures && testData.invalidStructures.length > 0) {
            // Use actual invalid structures from the data
 const invalidSamples = testData.invalidStructures.slice(0, 5);

 for (const invalid of invalidSamples) {
 attacks.push({
 type: 'malformed_invalid_smiles',
 description: `Invalid SMILES: ${invalid.modified_smiles}`,
 input: {
 valid_smiles: 0, // Mark as invalid
 safety_score: 0,
 qed_score: 0,
 sas_score: 10000000, // Above threshold
 lipinski_violations: 10,
 similarity: 0,
 salt: 12345,
 task_type: 0,
 safety_threshold: 0,
 qed_threshold: 500000,
 sas_threshold: 6000000,
 lipinski_threshold: 1,
 similarity_threshold: 400000
                    },
 metadata: {
 originalSMILES: invalid.original_smiles,
 invalidSMILES: invalid.modified_smiles,
 error: invalid.error
                    }
                });
            }
        }

 return attacks;
    }

    /**
     * Generate timing attack scenarios
     */
 generateTimingAttacks(testData) {
 const attacks = [];

 if (testData.successfulRepairs && testData.successfulRepairs.length > 0) {
 const sampleRepair = testData.successfulRepairs[0];
 const baseInput = this.dataProcessor.convertToCircuitInput(sampleRepair);

            // Generate inputs with varying complexity
 for (let i = 0; i < 3; i++) {
 attacks.push({
 type: 'timing_attack_complexity',
 description: `Timing attack with complexity level ${i + 1}`,
 input: {
                        ...baseInput,
 salt: baseInput.salt + i * 1000000 // Vary salt for different computation paths
                    },
 metadata: { complexityLevel: i + 1 }
                });
            }
        }

 return attacks;
    }

    /**
     * Generate memory exhaustion attack scenarios
     */
 generateMemoryExhaustionAttacks() {
 return [
            {
 type: 'memory_exhaustion_recursive',
 description: 'Recursive object structure',
 input: this.createRecursiveObject(5),
 metadata: { recursionDepth: 5 }
            },
            {
 type: 'memory_exhaustion_circular',
 description: 'Circular reference structure',
 input: this.createCircularReference(),
 metadata: { circularRef: true }
            }
        ];
    }

    /**
     * Create recursive object for memory exhaustion test
     */
 createRecursiveObject(depth) {
 if (depth <= 0) {
 return {
 valid_smiles: 1,
 safety_score: 1000000,
 qed_score: 500000,
 sas_score: 3000000,
 lipinski_violations: 0,
 similarity: 600000,
 salt: 12345,
 task_type: 0,
 safety_threshold: 0,
 qed_threshold: 500000,
 sas_threshold: 6000000,
 lipinski_threshold: 1,
 similarity_threshold: 400000
            };
        }

 const obj = this.createRecursiveObject(depth - 1);
 obj.nested = this.createRecursiveObject(depth - 1);
 return obj;
    }

    /**
     * Create circular reference for memory exhaustion test
     */
 createCircularReference() {
 const obj = {
 valid_smiles: 1,
 safety_score: 1000000,
 qed_score: 500000,
 sas_score: 3000000,
 lipinski_violations: 0,
 similarity: 600000,
 salt: 12345,
 task_type: 0,
 safety_threshold: 0,
 qed_threshold: 500000,
 sas_threshold: 6000000,
 lipinski_threshold: 1,
 similarity_threshold: 400000
        };

 obj.self = obj; // Create circular reference
 return obj;
    }

    /**
     * Execute a single attack scenario
     */
 async executeAttackScenario(scenario) {
 const startTime = Date.now();
 const result = {
 type: scenario.type,
 description: scenario.description,
 startTime: new Date().toISOString(),
 metadata: scenario.metadata || {}
        };

 try {
            // Attempt to process the malicious input
 const proof = await this.zkGenerator.generateProof(scenario.input);
 const processingTime = Date.now() - startTime;

 if (proof) {
                // If proof was generated, try to verify it
 const verificationStart = Date.now();
 const isValid = await this.zkGenerator.verifyProof(proof, scenario.input);
 const verificationTime = Date.now() - verificationStart;

 result.proofGenerated = true;
 result.proofValid = isValid;
 result.processingTime = processingTime;
 result.verificationTime = verificationTime;
 result.securityBreach = isValid; // Valid proof from malicious input = security breach
 result.systemCrashed = false;
 result.errorHandled = false;
            } else {
 result.proofGenerated = false;
 result.proofValid = false;
 result.processingTime = processingTime;
 result.securityBreach = false;
 result.systemCrashed = false;
 result.errorHandled = true;
            }

        } catch (error) {
 const processingTime = Date.now() - startTime;

 result.proofGenerated = false;
 result.proofValid = false;
 result.processingTime = processingTime;
 result.error = error.message;
 result.errorType = error.constructor.name;
 result.securityBreach = false;
 result.systemCrashed = this.isSystemCrash(error);
 result.errorHandled = !this.isSystemCrash(error);
        }

        // Calculate security score for this attack
 result.securityScore = this.calculateAttackSecurityScore(result);
 result.passed = result.securityScore >= 0.7; // 70% threshold for passing

 return result;
    }

    /**
     * Determine if an error represents a system crash
     */
 isSystemCrash(error) {
 const crashIndicators = [
            'SIGKILL',
            'SIGTERM',
            'out of memory',
            'stack overflow',
            'segmentation fault',
            'fatal error'
        ];

 const errorMessage = error.message.toLowerCase();
 return crashIndicators.some(indicator =>
 errorMessage.includes(indicator.toLowerCase())
        );
    }

    /**
     * Calculate security score for an attack scenario
     */
 calculateAttackSecurityScore(result) {
 let score = 0;

        // System didn't crash (30 points)
 if (!result.systemCrashed) {
 score += 0.3;
        }

        // Error was handled gracefully (25 points)
 if (result.errorHandled) {
 score += 0.25;
        }

        // No security breach (35 points)
 if (!result.securityBreach) {
 score += 0.35;
        }

        // Processing time reasonable (< 10 seconds) (10 points)
 if (result.processingTime < 10000) {
 score += 0.1;
        }

 return Math.round(score * 100) / 100;
    }

    /**
     * Analyze overall attack resistance results
     */
 analyzeAttackResults() {
 const totalTests = this.attackResults.length;
 const passedTests = this.attackResults.filter(r => r.passed).length;
 const resistanceRate = (passedTests / totalTests) * 100;

 const attackTypeResults = {};
 const securityBreaches = [];
 const systemCrashes = [];

 for (const result of this.attackResults) {
            // Group by attack type
 if (!attackTypeResults[result.type]) {
 attackTypeResults[result.type] = {
 total: 0,
 passed: 0,
 avgSecurityScore: 0,
 avgProcessingTime: 0
                };
            }

 const typeResult = attackTypeResults[result.type];
 typeResult.total++;
 if (result.passed) typeResult.passed++;
 typeResult.avgSecurityScore += result.securityScore;
 typeResult.avgProcessingTime += result.processingTime;

            // Track security issues
 if (result.securityBreach) {
 securityBreaches.push(result);
            }
 if (result.systemCrashed) {
 systemCrashes.push(result);
            }
        }

        // Calculate averages
 Object.keys(attackTypeResults).forEach(type => {
 const typeResult = attackTypeResults[type];
 typeResult.avgSecurityScore /= typeResult.total;
 typeResult.avgProcessingTime /= typeResult.total;
 typeResult.passRate = (typeResult.passed / typeResult.total) * 100;
        });

 return {
 totalTests,
 passedTests,
 resistanceRate,
 attackTypeResults,
 securityBreaches,
 systemCrashes,
 overallSecurityScore: this.calculateOverallAttackScore(),
 details: this.attackResults
        };
    }

    /**
     * Calculate overall attack resistance score
     */
 calculateOverallAttackScore() {
 if (this.attackResults.length === 0) return 0;

 const totalScore = this.attackResults.reduce((sum, result) =>
 sum + result.securityScore, 0);

 return Math.round((totalScore / this.attackResults.length) * 100) / 100;
    }
}

module.exports = AttackResistanceTester;