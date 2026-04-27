export interface Violation {
  ruleId?: string;
  rule?: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  line?: number;
  message: string;
  category?: string;
  suggestion?: string;
}

export interface SarifFormatOptions {
  format?: 'sarif' | 'json' | 'console';
  output?: string;
  mode?: 'observe' | 'warn' | 'enforce';
}

export interface AIDetectionResult {
  filePath: string;
  timestamp: string;
  isLikelyAI: boolean;
  confidence: number;
  indicators: Array<{ type: string; confidence: number; note: string; line?: number }>;
  sections: Array<{ startLine: number; endLine: number; confidence: number }>;
  recommendation: string;
}

export interface AIAuditResult {
  filePath: string;
  timestamp: string;
  isAIGenerated: boolean;
  confidence: number;
  overallScore: number;
  violations: Violation[];
  recommendations: string[];
  suggestedActions: Array<{ priority: string; action: string; reason: string }>;
}

export declare function runComplianceCheck(directory: string, options?: SarifFormatOptions): Promise<void>;
export declare function runAIAudit(files: string[], options?: object): Promise<void>;
export declare function runAIDetection(files: string[], options?: object): Promise<void>;
export declare function runContinuousWatch(directory: string, options?: object): Promise<void>;
export declare function runMCPServer(options?: object): Promise<void>;
