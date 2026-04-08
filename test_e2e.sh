#!/bin/bash
# MoraJunto API E2E Test Suite
BASE="http://localhost:3000/api"
PASS_COUNT=0
FAIL_COUNT=0
RESULTS=""

run_test() {
    local TEST_NAME="$1"
    local METHOD="$2"
    local URL="$3"
    local DATA="$4"
    local AUTH="$5"
    local EXPECT_STATUS="$6"

    local CMD=(curl -s -w '\n%{http_code}' -H 'Content-Type: application/json')
    if [ -n "$AUTH" ]; then
        CMD+=(-H "Authorization: Bearer $AUTH")
    fi

    case "$METHOD" in
        GET)    CMD+=("$URL") ;;
        DELETE) CMD+=(-X DELETE "$URL") ;;
        PUT)    CMD+=(-X PUT -d "$DATA" "$URL") ;;
        POST)   CMD+=(-X POST -d "$DATA" "$URL") ;;
    esac

    RESP=$("${CMD[@]}" 2>/dev/null)
    HTTP_CODE=$(echo "$RESP" | tail -1)
    BODY=$(echo "$RESP" | sed '$d')
    BODY_SHORT=$(echo "$BODY" | head -c 300)

    if [ "$HTTP_CODE" = "$EXPECT_STATUS" ]; then
        STATUS="PASS"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        STATUS="FAIL"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi

    echo "---"
    echo "TEST: $TEST_NAME"
    echo "  $METHOD $URL"
    echo "  HTTP Status: $HTTP_CODE (expected: $EXPECT_STATUS) -> $STATUS"
    echo "  Response: $BODY_SHORT"
    echo ""

    RESULTS="${RESULTS}| ${TEST_NAME} | ${METHOD} | ${HTTP_CODE} | ${EXPECT_STATUS} | ${STATUS} |\n"
    echo "$BODY" > /tmp/last_resp.json
}

jq_node() {
    node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{let j=JSON.parse(d);let r=eval('j.'+process.argv[1]);console.log(r||'')}catch(e){console.log('')}})" "$1" < /tmp/last_resp.json 2>/dev/null
}

echo "============================================="
echo "  MoraJunto API E2E Test Suite"
echo "  $(date)"
echo "============================================="
echo ""

# ===== SETUP =====
echo ">>> SETUP: Registering owner user..."
# Generate a valid CPF
VALID_CPF=$(node -e "
function g(){let d=[];for(let i=0;i<9;i++)d.push(Math.floor(Math.random()*10));
let s1=0;for(let i=0;i<9;i++)s1+=d[i]*(10-i);let r1=11-(s1%11);if(r1>=10)r1=0;d.push(r1);
let s2=0;for(let i=0;i<10;i++)s2+=d[i]*(11-i);let r2=11-(s2%11);if(r2>=10)r2=0;d.push(r2);
return d.join('')}console.log(g())")
TESTEMAIL="agente_e2e_$(date +%s)@imob.com"

run_test "Register Owner User" "POST" "$BASE/auth/register" \
  "{\"name\":\"Agente Imob\",\"email\":\"$TESTEMAIL\",\"password\":\"Agente@123456\",\"role\":\"owner\",\"cpf\":\"$VALID_CPF\",\"birthDate\":\"1990-05-15\",\"phone\":\"16999990000\"}" \
  "" "201"

TOKEN=$(jq_node "token")

if [ -z "$TOKEN" ]; then
    echo ">>> Registration failed. Trying login with pre-existing user..."
    run_test "Login Owner User" "POST" "$BASE/auth/login" \
      '{"email":"agente@imob.com","password":"Agente@123456"}' "" "200"
    TOKEN=$(jq_node "token")
fi

if [ -z "$TOKEN" ]; then
    echo "FATAL: Could not obtain auth token. Aborting."
    exit 1
fi

echo "TOKEN obtained: ${TOKEN:0:40}..."
echo ""

# ===== 1. PROPERTIES CRUD =====
echo "============================================="
echo "  1. PROPERTIES CRUD (Owner)"
echo "============================================="

run_test "Create Property 1 (Apto Centro)" "POST" "$BASE/owner/properties" \
  '{"title":"Apartamento Centro RP","type":"apartamento","price":1500,"address":"Rua Sao Sebastiao 500","neighborhood":"Centro","bedrooms":2,"bathrooms":1,"area":65,"description":"Apartamento mobiliado no centro","features":["mobiliado","ar-condicionado"]}' \
  "$TOKEN" "201"
PROP1_ID=$(jq_node "property._id")
echo "  -> Property 1 ID: $PROP1_ID"

run_test "Create Property 2 (Kitnet)" "POST" "$BASE/owner/properties" \
  '{"title":"Kitnet Lagoinha","type":"kitnet","price":800,"address":"Rua Tibirica 200","neighborhood":"Lagoinha","bedrooms":1,"bathrooms":1,"area":30}' \
  "$TOKEN" "201"
PROP2_ID=$(jq_node "property._id")
echo "  -> Property 2 ID: $PROP2_ID"

run_test "Create Property 3 (Casa)" "POST" "$BASE/owner/properties" \
  '{"title":"Casa Jd Sumare","type":"casa","price":2500,"address":"Rua das Palmeiras 100","neighborhood":"Jardim Sumare","bedrooms":3,"bathrooms":2,"area":120}' \
  "$TOKEN" "201"
PROP3_ID=$(jq_node "property._id")
echo "  -> Property 3 ID: $PROP3_ID"

echo ""
echo ">>> Testing POST /api/properties (agency-only endpoint with owner token)..."
run_test "POST /api/properties (owner=403)" "POST" "$BASE/properties" \
  '{"title":"Test","price":1000,"address":"Rua X","neighborhood":"Y","type":"apartamento"}' \
  "$TOKEN" "403"

# ===== 2. LIST PROPERTIES =====
echo ""
echo "============================================="
echo "  2. LIST PROPERTIES"
echo "============================================="

run_test "List all (public)" "GET" "$BASE/properties" "" "" "200"
run_test "Filter neighborhood=Centro" "GET" "$BASE/properties?neighborhood=Centro" "" "" "200"
run_test "Filter type=kitnet" "GET" "$BASE/properties?type=kitnet" "" "" "200"
run_test "Filter price 1000-2000" "GET" "$BASE/properties?minPrice=1000&maxPrice=2000" "" "" "200"
run_test "Owner properties (auth)" "GET" "$BASE/owner/properties" "" "$TOKEN" "200"

# ===== 3. PROPERTY DETAIL =====
echo ""
echo "============================================="
echo "  3. PROPERTY DETAIL"
echo "============================================="

if [ -n "$PROP1_ID" ]; then
    run_test "Get property by ID" "GET" "$BASE/properties/$PROP1_ID" "" "" "200"
fi
run_test "Non-existent property (404)" "GET" "$BASE/properties/000000000000000000000000" "" "" "404"

# ===== 4. SEARCH =====
echo ""
echo "============================================="
echo "  4. SEARCH (AI-powered)"
echo "============================================="

run_test "Search: apto barato centro" "POST" "$BASE/search" '{"query":"apartamento barato no centro"}' "" "200"
run_test "Search: casa 3 quartos" "POST" "$BASE/search" '{"query":"casa com 3 quartos"}' "" "200"
run_test "Search: kitnet USP" "POST" "$BASE/search" '{"query":"kitnet perto da USP"}' "" "200"

# ===== 5. LEADS =====
echo ""
echo "============================================="
echo "  5. LEADS"
echo "============================================="

if [ -n "$PROP1_ID" ]; then
    run_test "Create lead for property" "POST" "$BASE/properties/$PROP1_ID/lead" \
      '{"name":"Interessado","email":"interesse@teste.com","phone":"16999990000","message":"Tenho interesse"}' "" "201"
fi

# ===== 6. OWNER LEAD =====
echo ""
echo "============================================="
echo "  6. OWNER LEAD (Public)"
echo "============================================="

run_test "Create owner lead" "POST" "$BASE/owner/lead" \
  '{"name":"Novo Proprietario","email":"novo2@prop.com","phone":"16988880000","neighborhood":"Centro","propertyType":"apartamento","price":2000}' "" "201"

# ===== 7. EDIT & DELETE =====
echo ""
echo "============================================="
echo "  7. EDIT & DELETE PROPERTY"
echo "============================================="

if [ -n "$PROP1_ID" ]; then
    run_test "Update price to 1600" "PUT" "$BASE/owner/properties/$PROP1_ID" '{"price":1600}' "$TOKEN" "200"
    # Verify update
    run_test "Verify updated price" "GET" "$BASE/properties/$PROP1_ID" "" "" "200"
fi

if [ -n "$PROP3_ID" ]; then
    run_test "Delete property 3" "DELETE" "$BASE/owner/properties/$PROP3_ID" "" "$TOKEN" "200"
    run_test "Verify deleted (404)" "GET" "$BASE/properties/$PROP3_ID" "" "" "404"
fi

# ===== 8. VALIDATION =====
echo ""
echo "============================================="
echo "  8. VALIDATION TESTS"
echo "============================================="

run_test "Missing title (400)" "POST" "$BASE/owner/properties" \
  '{"price":1000,"address":"Rua X","neighborhood":"Centro"}' "$TOKEN" "400"

run_test "Missing price (400)" "POST" "$BASE/owner/properties" \
  '{"title":"Test","address":"Rua X","neighborhood":"Centro"}' "$TOKEN" "400"

run_test "Negative price (400)" "POST" "$BASE/owner/properties" \
  '{"title":"Test","price":-100,"address":"Rua X","neighborhood":"Centro"}' "$TOKEN" "400"

run_test "Zero price (400)" "POST" "$BASE/owner/properties" \
  '{"title":"Test","price":0,"address":"Rua X","neighborhood":"Centro"}' "$TOKEN" "400"

run_test "No token on owner list (401)" "GET" "$BASE/owner/properties" "" "" "401"

run_test "No token on create (401)" "POST" "$BASE/owner/properties" \
  '{"title":"Test","price":1000,"address":"Rua X","neighborhood":"Centro"}' "" "401"

# ===== CLEANUP =====
echo ""
echo "============================================="
echo "  CLEANUP"
echo "============================================="
if [ -n "$PROP1_ID" ]; then
    run_test "Cleanup: delete prop 1" "DELETE" "$BASE/owner/properties/$PROP1_ID" "" "$TOKEN" "200"
fi
if [ -n "$PROP2_ID" ]; then
    run_test "Cleanup: delete prop 2" "DELETE" "$BASE/owner/properties/$PROP2_ID" "" "$TOKEN" "200"
fi

# ===== FINAL SUMMARY =====
echo ""
echo "============================================="
echo "  FINAL TEST SUMMARY"
echo "============================================="
echo ""
TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo "Total: $TOTAL | PASS: $PASS_COUNT | FAIL: $FAIL_COUNT"
echo ""
printf "%-45s | %-6s | %-4s | %-4s | %-6s\n" "Test" "Method" "Got" "Exp" "Result"
echo "----------------------------------------------|--------|------|------|-------"
echo -e "$RESULTS" | while IFS='|' read -r _ name method got exp result _; do
    if [ -n "$name" ]; then
        printf "%-45s | %-6s | %-4s | %-4s | %s\n" "$(echo $name | xargs)" "$(echo $method | xargs)" "$(echo $got | xargs)" "$(echo $exp | xargs)" "$(echo $result | xargs)"
    fi
done
echo ""
if [ "$FAIL_COUNT" -eq 0 ]; then
    echo "ALL TESTS PASSED!"
else
    echo "$FAIL_COUNT TEST(S) FAILED - see details above."
fi
