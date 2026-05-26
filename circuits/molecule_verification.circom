pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/gates.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

// Main molecule verification circuit for ToxiEval-ZKP system
template MoleculeVerification() {
    // Private inputs - molecule properties (hidden from verifier)
 signal input valid_smiles;       // Structure validity (0=invalid, 1=valid)
 signal input safety_score;       // Safety score (0-1000000, represents 0.0-1.0)
 signal input qed_score;          // QED score (0-1000000, represents 0.0-1.0)
 signal input sas_score;          // SAS score (0-10000000, represents 0.0-10.0)
 signal input lipinski_violations; // Lipinski violations count (0-5)
 signal input similarity;         // Similarity score (0-1000000, represents 0.0-1.0)
 signal input salt;               // Random salt for commitment

    // Public inputs - verification criteria (visible to verifier)
 signal input task_type;                  // Task type (0=binary classification, 1=LD50)
 signal input safety_threshold;           // Safety threshold
 signal input qed_threshold;              // QED threshold (default 500000, represents 0.5)
 signal input sas_threshold;              // SAS threshold (default 6000000, represents 6.0)
 signal input lipinski_threshold;         // Lipinski threshold (default 1)
 signal input similarity_threshold;       // Similarity threshold (default 400000, represents 0.4)

    // Public outputs - only these values are revealed
 signal output commitment;                // Commitment to molecule properties
 signal output verification_result;       // Final verification result (0=fail, 1=pass)
 signal output nullifier;                 // Nullifier to prevent double-spending

    // Internal signals for computation
 signal validity_check_result;
 signal safety_check_result;
 signal qed_check_result;
 signal sas_check_result;
 signal lipinski_check_result;
 signal similarity_check_result;

    // Components for verification
 component validity_check = IsEqual();
 component safety_binary_check = IsEqual();
 component safety_ld50_check = GreaterEqThan(32);
 component task_type_check = IsEqual();
 component safety_mux = Mux1();

 component qed_check = GreaterEqThan(32);
 component sas_check = LessEqThan(32);
 component lipinski_check = LessEqThan(8);
 component similarity_check = GreaterEqThan(32);

    // AND gates for final result (now with 6 criteria)
 component and1 = AND();
 component and2 = AND();
 component and3 = AND();
 component and4 = AND();
 component and5 = AND();

    // Poseidon hash for commitment and nullifier (now with 7 inputs)
 component commitment_hash = Poseidon(7);
 component nullifier_hash = Poseidon(2);

    // 0. Structure Validity Check (FIRST AND MOST IMPORTANT)
    // SMILES must be valid (valid_smiles = 1) to proceed with other checks
 validity_check.in[0] <== valid_smiles;
 validity_check.in[1] <== 1;  // Must be valid (1)
 validity_check_result <== validity_check.out;

    // 1. Safety verification based on task type
    // For binary classification (task_type = 0): safety_score should be >= 500000 (class A)
    // For LD50 tasks (task_type = 1): safety_score should be >= safety_threshold

 task_type_check.in[0] <== task_type;
 task_type_check.in[1] <== 0;  // Check if binary classification

 safety_binary_check.in[0] <== safety_score;
 safety_binary_check.in[1] <== 1000000;  // Class A = 1.0

 safety_ld50_check.in[0] <== safety_score;
 safety_ld50_check.in[1] <== safety_threshold;

    // Use multiplexer to select appropriate safety check based on task type
 safety_mux.c[0] <== safety_ld50_check.out;      // LD50 check
 safety_mux.c[1] <== safety_binary_check.out;    // Binary check
 safety_mux.s <== task_type_check.out;

 safety_check_result <== safety_mux.out;

    // 2. QED score verification (>= threshold)
 qed_check.in[0] <== qed_score;
 qed_check.in[1] <== qed_threshold;
 qed_check_result <== qed_check.out;

    // 3. SAS score verification (<= threshold)
 sas_check.in[0] <== sas_score;
 sas_check.in[1] <== sas_threshold;
 sas_check_result <== sas_check.out;

    // 4. Lipinski violations verification (<= threshold)
 lipinski_check.in[0] <== lipinski_violations;
 lipinski_check.in[1] <== lipinski_threshold;
 lipinski_check_result <== lipinski_check.out;

    // 5. Similarity verification (>= threshold)
 similarity_check.in[0] <== similarity;
 similarity_check.in[1] <== similarity_threshold;
 similarity_check_result <== similarity_check.out;

    // Combine all checks with AND gates (ALL must pass, starting with validity)
 and1.a <== validity_check_result;     // FIRST: Structure validity
 and1.b <== safety_check_result;       // SECOND: Safety

 and2.a <== and1.out;
 and2.b <== qed_check_result;          // THIRD: QED

 and3.a <== and2.out;
 and3.b <== sas_check_result;          // FOURTH: SAS

 and4.a <== and3.out;
 and4.b <== lipinski_check_result;     // FIFTH: Lipinski

 and5.a <== and4.out;
 and5.b <== similarity_check_result;   // SIXTH: Similarity

 verification_result <== and5.out;

    // Generate commitment using Poseidon hash (now includes valid_smiles)
 commitment_hash.inputs[0] <== valid_smiles;
 commitment_hash.inputs[1] <== safety_score;
 commitment_hash.inputs[2] <== qed_score;
 commitment_hash.inputs[3] <== sas_score;
 commitment_hash.inputs[4] <== lipinski_violations;
 commitment_hash.inputs[5] <== similarity;
 commitment_hash.inputs[6] <== salt;
 commitment <== commitment_hash.out;

    // Generate nullifier to prevent double-spending
 nullifier_hash.inputs[0] <== commitment;
 nullifier_hash.inputs[1] <== task_type;
 nullifier <== nullifier_hash.out;
}

// Main component instantiation with public input specification
component main {public [task_type, safety_threshold, qed_threshold, sas_threshold, lipinski_threshold, similarity_threshold]} = MoleculeVerification();