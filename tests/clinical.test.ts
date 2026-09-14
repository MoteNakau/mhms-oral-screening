/**
 * MHMS Oral Screening - Clinical Calculation Tests
 * WHO 5th Edition DMFT/dmft validation
 *
 * Run with: node --experimental-vm-modules tests/clinical.test.js
 * Or import and run in browser console
 */

import { calculateDMFT, calculatedmft, calculateAge, checkDuplicateTeeth, isValidToothCode } from '../src/lib/clinical';
import type { ToothFinding, DMFTResult } from '../src/lib/types';

interface TestCase {
  name: string;
  findings: ToothFinding[];
  age: number;
  expected: Partial<DMFTResult>;
  dentition: 'permanent' | 'primary';
}

// ============================================================
// TEST CASES - PERMANENT DENTITION (DMFT)
// ============================================================

const permanentTestCases: TestCase[] = [
  {
    name: 'All sound teeth',
    dentition: 'permanent',
    age: 25,
    findings: [
      { toothCode: '11', status: 'sound', dentition: 'permanent' },
      { toothCode: '12', status: 'sound', dentition: 'permanent' },
    ],
    expected: { D: 0, M: 0, F: 0, T: 0 },
  },
  {
    name: '3 decayed teeth, age 15',
    dentition: 'permanent',
    age: 15,
    findings: [
      { toothCode: '11', status: 'decayed', dentition: 'permanent' },
      { toothCode: '21', status: 'decayed', dentition: 'permanent' },
      { toothCode: '31', status: 'decayed', dentition: 'permanent' },
    ],
    expected: { D: 3, M: 0, F: 0, T: 3 },
  },
  {
    name: '2 filled teeth, age 20',
    dentition: 'permanent',
    age: 20,
    findings: [
      { toothCode: '11', status: 'filled', dentition: 'permanent' },
      { toothCode: '21', status: 'filled', dentition: 'permanent' },
    ],
    expected: { D: 0, M: 0, F: 2, T: 2 },
  },
  {
    name: '1 missing due to caries, age 25 (should count as M)',
    dentition: 'permanent',
    age: 25,
    findings: [
      { toothCode: '16', status: 'missing_caries', dentition: 'permanent' },
    ],
    expected: { D: 0, M: 1, F: 0, T: 1 },
  },
  {
    name: '1 missing due to caries, age 8 (should NOT count as M - under threshold)',
    dentition: 'permanent',
    age: 8,
    findings: [
      { toothCode: '16', status: 'missing_caries', dentition: 'permanent' },
    ],
    expected: { D: 0, M: 0, F: 0, T: 0 },
  },
  {
    name: '1 missing due to caries, age 10 (should count as M - at threshold)',
    dentition: 'permanent',
    age: 10,
    findings: [
      { toothCode: '16', status: 'missing_caries', dentition: 'permanent' },
    ],
    expected: { D: 0, M: 1, F: 0, T: 1 },
  },
  {
    name: 'Missing for other reason (not counted in M)',
    dentition: 'permanent',
    age: 30,
    findings: [
      { toothCode: '14', status: 'missing_other', dentition: 'permanent' },
    ],
    expected: { D: 0, M: 0, F: 0, T: 0 },
  },
  {
    name: 'Mixed findings: 2D + 1M + 3F, age 20',
    dentition: 'permanent',
    age: 20,
    findings: [
      { toothCode: '11', status: 'decayed', dentition: 'permanent' },
      { toothCode: '12', status: 'decayed', dentition: 'permanent' },
      { toothCode: '16', status: 'missing_caries', dentition: 'permanent' },
      { toothCode: '21', status: 'filled', dentition: 'permanent' },
      { toothCode: '22', status: 'filled', dentition: 'permanent' },
      { toothCode: '23', status: 'filled', dentition: 'permanent' },
    ],
    expected: { D: 2, M: 1, F: 3, T: 6 },
  },
  {
    name: 'Filled with decay counts as D',
    dentition: 'permanent',
    age: 30,
    findings: [
      { toothCode: '11', status: 'filled_decay', dentition: 'permanent' },
    ],
    expected: { D: 1, M: 0, F: 0, T: 1 },
  },
  {
    name: 'Excluded teeth not counted',
    dentition: 'permanent',
    age: 25,
    findings: [
      { toothCode: '18', status: 'excluded', dentition: 'permanent' },
      { toothCode: '28', status: 'excluded', dentition: 'permanent' },
    ],
    expected: { D: 0, M: 0, F: 0, T: 0 },
  },
  {
    name: 'Not recorded teeth not counted',
    dentition: 'permanent',
    age: 25,
    findings: [
      { toothCode: '11', status: 'not_recorded', dentition: 'permanent' },
    ],
    expected: { D: 0, M: 0, F: 0, T: 0 },
  },
];

// ============================================================
// TEST CASES - PRIMARY DENTITION (dmft)
// ============================================================

const primaryTestCases: TestCase[] = [
  {
    name: 'Primary: all sound',
    dentition: 'primary',
    age: 5,
    findings: [
      { toothCode: '51', status: 'sound', dentition: 'primary' },
      { toothCode: '61', status: 'sound', dentition: 'primary' },
    ],
    expected: { D: 0, M: 0, F: 0, T: 0 },
  },
  {
    name: 'Primary: 2 decayed',
    dentition: 'primary',
    age: 5,
    findings: [
      { toothCode: '51', status: 'decayed', dentition: 'primary' },
      { toothCode: '61', status: 'decayed', dentition: 'primary' },
    ],
    expected: { D: 2, M: 0, F: 0, T: 2 },
  },
  {
    name: 'Primary: extracted due to caries (e component)',
    dentition: 'primary',
    age: 6,
    findings: [
      { toothCode: '51', status: 'extracted_caries', dentition: 'primary' },
    ],
    expected: { D: 0, M: 1, F: 0, T: 1 },
  },
  {
    name: 'Primary: missing due to caries',
    dentition: 'primary',
    age: 6,
    findings: [
      { toothCode: '51', status: 'missing_caries', dentition: 'primary' },
    ],
    expected: { D: 0, M: 1, F: 0, T: 1 },
  },
  {
    name: 'Primary: filled (f component)',
    dentition: 'primary',
    age: 6,
    findings: [
      { toothCode: '51', status: 'filled', dentition: 'primary' },
      { toothCode: '61', status: 'filled', dentition: 'primary' },
    ],
    expected: { D: 0, M: 0, F: 2, T: 2 },
  },
  {
    name: 'Primary: mixed 1d + 1e + 1f',
    dentition: 'primary',
    age: 6,
    findings: [
      { toothCode: '51', status: 'decayed', dentition: 'primary' },
      { toothCode: '61', status: 'extracted_caries', dentition: 'primary' },
      { toothCode: '71', status: 'filled', dentition: 'primary' },
    ],
    expected: { D: 1, M: 1, F: 1, T: 3 },
  },
  {
    name: 'Primary: missing for other reason (not counted)',
    dentition: 'primary',
    age: 6,
    findings: [
      { toothCode: '51', status: 'missing_other', dentition: 'primary' },
    ],
    expected: { D: 0, M: 0, F: 0, T: 0 },
  },
];

// ============================================================
// TEST RUNNER
// ============================================================

function runTests() {
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  function assertEqual(actual: number, expected: number, label: string) {
    if (actual !== expected) {
      return `${label}: expected ${expected}, got ${actual}`;
    }
    return null;
  }

  // Run permanent tests
  for (const tc of permanentTestCases) {
    const result = calculateDMFT(tc.findings, tc.age);
    const errors: string[] = [];

    errors.push(assertEqual(result.D, tc.expected.D!, 'D') || '');
    errors.push(assertEqual(result.M, tc.expected.M!, 'M') || '');
    errors.push(assertEqual(result.F, tc.expected.F!, 'F') || '');
    errors.push(assertEqual(result.T, tc.expected.T!, 'T') || '');

    const filteredErrors = errors.filter(e => e);
    if (filteredErrors.length === 0) {
      passed++;
      console.log(`  ✅ ${tc.name}`);
    } else {
      failed++;
      failures.push(`  ❌ ${tc.name}: ${filteredErrors.join(', ')}`);
      console.log(`  ❌ ${tc.name}: ${filteredErrors.join(', ')}`);
    }
  }

  // Run primary tests
  for (const tc of primaryTestCases) {
    const result = calculatedmft(tc.findings);
    const errors: string[] = [];

    errors.push(assertEqual(result.D, tc.expected.D!, 'd') || '');
    errors.push(assertEqual(result.M, tc.expected.M!, 'e/m') || '');
    errors.push(assertEqual(result.F, tc.expected.F!, 'f') || '');
    errors.push(assertEqual(result.T, tc.expected.T!, 'dmft') || '');

    const filteredErrors = errors.filter(e => e);
    if (filteredErrors.length === 0) {
      passed++;
      console.log(`  ✅ ${tc.name}`);
    } else {
      failed++;
      failures.push(`  ❌ ${tc.name}: ${filteredErrors.join(', ')}`);
      console.log(`  ❌ ${tc.name}: ${filteredErrors.join(', ')}`);
    }
  }

  // Additional validation tests
  console.log('\n--- Validation Tests ---');

  // Duplicate detection
  const dupFindings: ToothFinding[] = [
    { toothCode: '11', status: 'sound', dentition: 'permanent' },
    { toothCode: '11', status: 'decayed', dentition: 'permanent' },
  ];
  const dups = checkDuplicateTeeth(dupFindings);
  if (dups.length === 1 && dups[0] === '11') {
    passed++;
    console.log('  ✅ Duplicate tooth detection works');
  } else {
    failed++;
    console.log('  ❌ Duplicate tooth detection failed');
  }

  // Valid tooth codes
  if (isValidToothCode('11', 'permanent') && !isValidToothCode('99', 'permanent')) {
    passed++;
    console.log('  ✅ Tooth code validation works');
  } else {
    failed++;
    console.log('  ❌ Tooth code validation failed');
  }

  // Age calculation
  const age = calculateAge('2000-01-15', '2026-06-15');
  if (age === 26) {
    passed++;
    console.log('  ✅ Age calculation works');
  } else {
    failed++;
    console.log(`  ❌ Age calculation: expected 26, got ${age}`);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}`);

  if (failed > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(f));
    process.exit(1);
  }
}

// Run tests
console.log('MHMS Oral Screening - Clinical Calculation Tests');
console.log('WHO 5th Edition DMFT/dmft Validation\n');
console.log('--- Permanent Dentition (DMFT) ---');
runTests();
