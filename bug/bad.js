// Example JS file with poor performance practices

// Inefficient: Repeatedly querying the DOM in a loop
for (let i = 0; i < 100; i++) {
  document.getElementById('my-element').innerText += i;
}

// Inefficient: Using synchronous blocking code
const fs = require('fs');
const data = fs.readFileSync('bigfile.txt'); // Should use async

// Inefficient: Nested loops (O(n^2)) where a map could be used
const arr = [1, 2, 3, 2, 1, 4];
let duplicates = [];
for (let i = 0; i < arr.length; i++) {
  for (let j = i + 1; j < arr.length; j++) {
    if (arr[i] === arr[j]) {
      duplicates.push(arr[i]);
    }
  }
}

// Inefficient: Unnecessary array copying in a loop
let numbers = [1, 2, 3, 4, 5];
for (let i = 0; i < numbers.length; i++) {
  let copy = numbers.slice(); // Copying array on each iteration
  copy[i] = 0;
}

// Inefficient: Not using memoization for heavy computation
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n-1) + fibonacci(n-2);
}
fibonacci(35); // Very slow

// Inefficient: Not batching DOM updates
let container = document.getElementById('container');
for (let i = 0; i < 1000; i++) {
  let div = document.createElement('div');
  div.innerText = i;
  container.appendChild(div); // Should use DocumentFragment or batch insert
}