export class SarifSchema {
  static create(entries) {
    const runs = [{
      tool: {
        driver: {
          name: "ManasX",
          version: "2.0.1",
          rules: []
        }
      },
      results: []
    }];
    
    const rules = new Set();
    
    entries.forEach(entry => {
      entry.violations.forEach(v => {
        const ruleId = v.ruleId || v.rule || 'unknown';
        rules.add(ruleId);
        
        runs[0].results.push({
          ruleId: ruleId,
          level: this.mapSeverity(v.severity),
          message: { text: v.message },
          locations: [{
            physicalLocation: {
              artifactLocation: { uri: entry.file },
              region: { startLine: v.line || 1 }
            }
          }]
        });
      });
    });
    
    runs[0].tool.driver.rules = Array.from(rules).map(id => ({ id }));
    
    return {
      $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
      version: "2.1.0",
      runs
    };
  }

  static mapSeverity(sev) {
    if (sev === 'critical' || sev === 'high') return 'error';
    if (sev === 'medium') return 'warning';
    return 'note';
  }
}
