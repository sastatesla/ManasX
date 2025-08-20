
export default class BestPracticesSuggester {
  static suggest(issues) {
    return issues.map(issue => {
      let suggestion = '';
      switch (issue.type) {
        case 'no-var':
          suggestion = `Replace 'var' with 'let' or 'const' on line ${issue.line} for better variable scoping.`;
          break;
        case 'missing-semicolon':
          suggestion = `Add a semicolon at the end of line ${issue.line}.`;
          break;
        case 'long-line':
          suggestion = `Break line ${issue.line} into shorter lines for readability.`;
          break;
        case 'error':
          suggestion = issue.message;
          break;
        default:
          suggestion = `Review: ${issue.message}`;
      }
      return {
        ...issue,
        suggestion,
      };
    });
  }
}