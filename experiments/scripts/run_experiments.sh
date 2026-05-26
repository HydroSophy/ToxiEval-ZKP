#!/bin/bash

# ToxiEval-ZKP system Experiment Runner
# This script runs various experiments for the zero-knowledge proof system

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
 echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
 echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
 echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
 echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "cli.js" ]; then
 print_error "Please run this script from the toxieval-zkp directory"
 exit 1
fi

# Create necessary directories
print_status "Creating experiment directories..."
mkdir -p experiments/results
mkdir -p experiments/data
mkdir -p experiments/logs

# Function to prepare experiment data
prepare_data() {
 print_status "Preparing experiment data..."

 if [ ! -f "experiments/data/all_successful_repairs.json" ]; then
 print_status "Data not found. Preparing experiment data..."
 if node experiments/scripts/prepare_data.js; then
 print_success "Experiment data prepared successfully!"
 else
 print_error "Failed to prepare experiment data."
 exit 1
 fi
 else
 print_status "Experiment data already exists."
 fi
}

# Function to run scalability test
run_scalability_test() {
 print_status "Starting Scalability Test..."
 echo "=========================================="
 echo "This test will evaluate system performance"
 echo "across different molecule counts:"
 echo "- 10, 50, 100, 200, 377 molecules"
 echo "- 3 runs per scale for averaging"
 echo "- Expected duration: 15-30 minutes"
 echo "=========================================="

    # Prepare data first
 prepare_data

    # Log file for this test
 LOG_FILE="experiments/logs/scalability_test_$(date +%Y%m%d_%H%M%S).log"

 print_status "Logging to: $LOG_FILE"

    # Run the test and capture output
 if timeout 600 node experiments/scripts/scalability_test.js 2>&1 | tee "$LOG_FILE"; then
 print_success "Scalability test completed successfully!"
 print_status "Results saved to experiments/results/"
 print_status "Log saved to $LOG_FILE"
 else
 print_error "Scalability test failed or timed out. Check $LOG_FILE for details."
 exit 1
 fi
}

# Function to show help
show_help() {
 echo "ToxiEval-ZKP system Experiment Runner"
 echo ""
 echo "Usage: $0 [OPTION]"
 echo ""
 echo "Options:"
 echo " prepare Prepare experiment data only"
 echo " scalability Run scalability test (recommended first test)"
 echo " security Run security formal verification test"
 echo " complexity Run circuit complexity depth analysis"
 echo " all Run all available experiments"
 echo " help Show this help message"
 echo ""
 echo "Examples:"
 echo "  $0 prepare        # Prepare experiment data"
 echo "  $0 scalability    # Run only scalability test"
 echo "  $0 security       # Run only security verification test"
 echo "  $0 complexity     # Run only circuit complexity analysis"
 echo "  $0 all           # Run all experiments"
 echo ""
}

# Function to check system requirements
check_requirements() {
 print_status "Checking system requirements..."

    # Check Node.js
 if ! command -v node &> /dev/null; then
 print_error "Node.js is not installed"
 exit 1
 fi

    # Check if ZK system files exist
 if [ ! -f "src/proof_system.js" ]; then
 print_error "ZK proof generator not found"
 exit 1
 fi

 if [ ! -f "src/data_processor.js" ]; then
 print_error "Data processor not found"
 exit 1
 fi

    # Check if keys exist
 if [ ! -f "keys/molecule_verification.zkey" ]; then
 print_warning "ZK keys not found. They will be generated during setup."
 fi

 print_success "System requirements check passed"
}

# Function to run security formal verification test
run_security_test() {
 print_status "Starting Security Formal Verification Test..."
 echo "=============================================="
 echo "This test will evaluate ZK system security:"
 echo "- Completeness: Valid proofs are accepted"
 echo "- Soundness: Invalid proofs are rejected"
 echo "- Zero-Knowledge: No private info leaked"
 echo "- Attack Resistance: System handles attacks"
 echo "- Expected duration: 20-40 minutes"
 echo "=============================================="

    # Prepare data first
 prepare_data

    # Log file for this test
 LOG_FILE="experiments/logs/security_test_$(date +%Y%m%d_%H%M%S).log"

 print_status "Logging to: $LOG_FILE"

    # Run the test and capture output
 if timeout 600 node experiments/scripts/security_verification.js 2>&1 | tee "$LOG_FILE"; then
 print_success "Security verification test completed successfully!"
 print_status "Results saved to experiments/results/"
 print_status "Log saved to $LOG_FILE"
 else
 print_error "Security verification test failed or timed out. Check $LOG_FILE for details."
 exit 1
 fi
}

# Function to run circuit complexity analysis
run_complexity_analysis() {
 print_status "Starting Circuit Complexity Depth Analysis..."
 echo "================================================="
 echo "This test will analyze circuit design optimality:"
 echo "- Constraint density analysis"
 echo "- Critical path depth analysis"
 echo "- Parallelization potential analysis"
 echo "- Memory access pattern analysis"
 echo "- Theoretical bounds comparison"
 echo "- Expected duration: 10-20 minutes"
 echo "================================================="

    # Prepare data first
 prepare_data

    # Log file for this test
 LOG_FILE="experiments/logs/complexity_analysis_$(date +%Y%m%d_%H%M%S).log"

 print_status "Logging to: $LOG_FILE"

    # Run the test and capture output
 if timeout 600 node experiments/scripts/circuit_complexity.js 2>&1 | tee "$LOG_FILE"; then
 print_success "Circuit complexity analysis completed successfully!"
 print_status "Results saved to experiments/results/"
 print_status "Log saved to $LOG_FILE"
 else
 print_error "Circuit complexity analysis failed or timed out. Check $LOG_FILE for details."
 exit 1
 fi
}

# Function to run all experiments
run_all_experiments() {
 print_status "Running all experiments..."

    # Run scalability test first
 run_scalability_test

    # Then run security verification test
 run_security_test

    # Finally run circuit complexity analysis
 run_complexity_analysis

 print_success "All experiments completed!"
}

# Main script logic
main() {
 echo " ToxiEval-ZKP system Experiment Suite"
 echo "========================================"

    # Check requirements first
 check_requirements

 case "${1:-help}" in
        "prepare")
 prepare_data
            ;;
        "scalability")
 run_scalability_test
            ;;
        "security")
 run_security_test
            ;;
        "complexity")
 run_complexity_analysis
            ;;
        "all")
 run_all_experiments
            ;;
        "help"|"--help"|"-h")
 show_help
            ;;
        *)
 print_error "Unknown option: $1"
 echo ""
 show_help
 exit 1
            ;;
 esac
}

# Run main function with all arguments
main "$@"