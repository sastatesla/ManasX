import crypto from 'crypto';

export class OutputSchema {
  static createEvent(options = {}) {
    return {
      schemaVersion: "1.0",
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      identity: options.identity || { developer: null, team: null, branch: null, commit: null },
      trigger: options.trigger || "unknown", // watch, compliance, ci, pr-check
      file: options.file || null,
      analysis: {
        aiDetection: options.aiDetection || { isLikelyAI: false, confidence: 0, agentSignature: null },
        violations: options.violations ? this.formatViolations(options.violations, options.file) : [],
        driftScore: typeof options.driftScore === 'number' ? options.driftScore : null,
        complianceScore: typeof options.complianceScore === 'number' ? options.complianceScore : null
      },
      reviewStatus: options.reviewStatus || "pending", // pending, approved, flagged, waived
      reviewedBy: options.reviewedBy || null,
      waivedBy: options.waivedBy || null,
      waiverExpiry: options.waiverExpiry || null
    };
  }

  static formatViolation(violation, file) {
    // Generate stable ID for violation
    const ruleId = violation.ruleId || violation.rule || 'unknown';
    const line = violation.line || 0;
    const message = violation.message || '';
    
    const contentStr = `${file}-${ruleId}-${line}-${message}`;
    const contentHash = crypto.createHash('sha256').update(contentStr).digest('hex');
    
    return {
      id: contentHash,
      ruleId: ruleId,
      severity: violation.severity || 'info',
      line: line,
      message: message,
      category: violation.category || 'general',
      suggestion: violation.suggestion || null
    };
  }
  
  static formatViolations(violations, file) {
    return violations.map(v => this.formatViolation(v, file));
  }
}
