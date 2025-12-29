#!/usr/bin/env bash
# TESTING_CHECKLIST.sh - Run through all tests systematically

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     FAULT-TOLERANT DATA PROCESSING - TESTING CHECKLIST        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function
check_test() {
    local test_num=$1
    local test_name=$2
    local steps=$3
    
    echo -e "${YELLOW}TEST ${test_num}: ${test_name}${NC}"
    echo "Steps: $steps"
    echo -n "Did this test PASS? (y/n): "
    read -r response
    
    if [ "$response" = "y" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        return 1
    fi
}

echo "═══════════════════════════════════════════════════════════════"
echo "🚀 SETUP"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Before starting:"
echo "1. Run: npm install && npm run dev"
echo "2. Open: http://localhost:5173"
echo "3. Take your time with each test"
echo ""

pass_count=0
fail_count=0

echo "═══════════════════════════════════════════════════════════════"
echo "🎯 CORE TESTS (Complete these first)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Test 1
if check_test 1 "Valid Event Ingestion" \
    "1. Click 'valid' preset
     2. Click Submit Event
     3. See ✅ Success response
     4. Go to Events tab → see 1 event"; then
    ((pass_count++))
else
    ((fail_count++))
fi
echo ""

# Test 2
if check_test 2 "Duplicate Detection (IDEMPOTENCY)" \
    "1. Click 'valid' preset
     2. Submit Event → Success
     3. Submit SAME event again
     4. See ❌ Duplicate rejected
     5. Go to Aggregation → Count = 1 (not 2)"; then
    ((pass_count++))
else
    ((fail_count++))
fi
echo ""

# Test 3
if check_test 3 "Schema Tolerance: Wrong Types" \
    "1. Click 'wrong_types' preset (client_id=123, amount='5.5')
     2. Submit Event → Success
     3. See normalization warnings
     4. Expand event → see type coercion"; then
    ((pass_count++))
else
    ((fail_count++))
fi
echo ""

# Test 4
if check_test 4 "Schema Tolerance: Missing Fields" \
    "1. Click 'missing_amount' preset
     2. Submit Event → Success
     3. See warning about amount
     4. Expand event → amount = 0 in normalized form"; then
    ((pass_count++))
else
    ((fail_count++))
fi
echo ""

# Test 5
if check_test 5 "Schema Tolerance: Bad Timestamp" \
    "1. Click 'bad_timestamp' preset
     2. Submit Event → Success
     3. See warning about timestamp
     4. Timestamp in normalized = current time"; then
    ((pass_count++))
else
    ((fail_count++))
fi
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "💥 FAILURE RESILIENCE TESTS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Test 6
if check_test 6 "Failure Simulation Works" \
    "1. Find 'Simulate Database Failures' box
     2. Click toggle ON (becomes red)
     3. Box shows warning text
     4. Failures are now enabled"; then
    ((pass_count++))
else
    ((fail_count++))
fi
echo ""

# Test 7
if check_test 7 "Failures Don't Cause Data Loss" \
    "1. With failures ON, submit 10 different valid events
     2. Watch: ~50% fail (❌), ~50% succeed (✅)
     3. Disable failures toggle OFF
     4. Go to Aggregation → Count ≈ 10 (or 5-10 depending on luck)
     5. All data retained despite failures"; then
    ((pass_count++))
else
    ((fail_count++))
fi
echo ""

# Test 8
if check_test 8 "Safe Retry Semantics" \
    "1. With failures ON, submit valid event
     2. Get ❌ Failed response
     3. Copy the exact JSON
     4. Resubmit same event
     5. Eventually succeeds (try up to 5 times)"; then
    ((pass_count++))
else
    ((fail_count++))
fi
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "📊 AGGREGATION & ACCURACY TESTS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Test 9
if check_test 9 "Aggregation Counts Correctly" \
    "1. Clear data (close dev server, restart)
     2. Submit 3 unique valid events
     3. Go to Aggregation tab
     4. Count = 3, Total = 3 (if each amount=1)"; then
    ((pass_count++))
else
    ((fail_count++))
fi
echo ""

# Test 10
if check_test 10 "Aggregation Math Correct" \
    "1. Submit events with amounts: 1, 5, 9
     2. Go to Aggregation
     3. Count = 3 ✓
     4. Total = 15 ✓
     5. Average = 5.0 ✓
     6. Min = 1 ✓
     7. Max = 9 ✓"; then
    ((pass_count++))
else
    ((fail_count++))
fi
echo ""

# Test 11
if check_test 11 "Grouping by Client Works" \
    "1. Submit events from different clients:
        - client_id: 'user1', amount: 1
        - client_id: 'user2', amount: 5
        - client_id: 'user1', amount: 3
     2. Go to Aggregation → By Client section
     3. See: user1: count=2, total=4
           user2: count=1, total=5"; then
    ((pass_count++))
else
    ((fail_count++))
fi
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "🎯 EDGE CASE TESTS (Optional but recommended)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Test 12
if check_test 12 "Extra Fields Are Ignored" \
    "1. Click 'extra_fields' preset
     2. Submit Event
     3. Expand event → Raw has extra fields
     4. Normalized doesn't have them"; then
    ((pass_count++))
else
    ((fail_count++))
fi
echo ""

# Test 13
if check_test 13 "Zero and Negative Amounts" \
    "1. Manually enter: amount: 0
     2. Submit → Success
     3. Manually enter: amount: -50
     4. Submit → Success"; then
    ((pass_count++))
else
    ((fail_count++))
fi
echo ""

# Test 14
if check_test 14 "Status Tracking Works" \
    "1. Submit several events (mix of successes/failures)
     2. Go to Status tab
     3. Check: 'Total Events Received' increments
     4. Check: 'Successfully Processed' accurate
     5. Check: 'Duplicates Rejected' shows correct count"; then
    ((pass_count++))
else
    ((fail_count++))
fi
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "📈 FINAL RESULTS"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo -e "Tests Passed:  ${GREEN}$pass_count${NC}"
echo -e "Tests Failed:  ${RED}$fail_count${NC}"
echo -e "Total Tests:   $((pass_count + fail_count))"
echo ""

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  🎉 ALL TESTS PASSED! 🎉                 ║${NC}"
    echo -e "${GREEN}║                                            ║${NC}"
    echo -e "${GREEN}║  System is fault-tolerant and working!    ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
else
    echo -e "${RED}Some tests failed. Review the steps above.${NC}"
fi
echo ""

# Summary
echo "═══════════════════════════════════════════════════════════════"
echo "✅ What You've Verified"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "If all core tests passed, you've proven:"
echo "  ✓ Idempotency (duplicate detection via fingerprinting)"
echo "  ✓ Schema tolerance (malformed data handling)"
echo "  ✓ Failure resilience (50% failure rate doesn't break system)"
echo "  ✓ Data consistency (no double-counting)"
echo "  ✓ Aggregation accuracy (math correct)"
echo ""
echo "The system is production-ready for this demo!"
echo ""
