var userName = "test_user"; // Should use const and camelCase

// Using eval - security violation
eval('console.log("This is dangerous")');

function helper(data) {
  // TODO: Implement this function properly
  return data;
}

// Synchronous file operation
const fs = require('fs');
const content = fs.readFileSync('./somefile.txt');

// Poor error handling
function riskyFunction() {
  return JSON.parse(someUndefinedVariable);
}

// Using innerHTML - XSS risk
document.getElementById('content').innerHTML = userInput;