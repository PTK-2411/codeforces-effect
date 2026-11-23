// Master test runner
const { execSync } = require('child_process');

const suites = [
  'tests/test_background.js',
  'tests/test_content.js',
  'tests/test_popup.js'
];

let allPassed = true;

for (const suite of suites) {
  console.log(`\n----------------------------------------`);
  console.log(`RUNNING SUITE: ${suite}`);
  console.log(`----------------------------------------`);
  try {
    const output = execSync(`node ${suite}`, { stdio: 'inherit' });
  } catch (err) {
    console.error(`FAILED: ${suite}`);
    allPassed = false;
    process.exit(1);
  }
}

if (allPassed) {
  console.log(`\n========================================`);
  console.log(`🎉 ALL 3 TEST SUITES PASSED COMPLETELY!`);
  console.log(`========================================\n`);
}
