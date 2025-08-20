export default class PerformanceSuggester {
  static suggest(issues) {
    return issues.map(issue => {
      let suggestion = '';
      switch (issue.type) {
        case 'loop-inefficiency':
          suggestion = `Replace inefficient loop on line ${issue.line} with a more optimized structure, such as using "map" instead of "forEach" if you're transforming arrays.`;
          break;
        case 'redundant-recalculation':
          suggestion = `Cache the result of expensive calculations performed multiple times on line ${issue.line}.`;
          break;
        case 'error':
          suggestion = issue.message;
          break;
        default:
          suggestion = `Review performance issue: ${issue.message}`;
      }
      return {
        ...issue,
        suggestion,
      };
    });
  }
}