import fs from 'fs';
import path from 'path';

export class LogFormatter {
  constructor(logDir = '.manasx') {
    this.logDir = logDir;
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  writeContextLog(eventData) {
    const formattedEntry = this.formatContextEntry(eventData);
    const logPath = path.join(this.logDir, 'context.log');
    
    const separator = '─'.repeat(80);
    const entry = `${separator}\n${formattedEntry}\n`;
    
    this.writeToFile(logPath, entry);
  }

  writeDailyLog(eventData) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const logPath = path.join(this.logDir, `monitor-${today}.log`);
    
    const formattedEntry = this.formatDailyEntry(eventData);
    this.writeToFile(logPath, formattedEntry + '\n');
  }

  writeViolationsLog(violations, filePath) {
    if (!violations || violations.length === 0) return;
    
    const today = new Date().toISOString().split('T')[0];
    const logPath = path.join(this.logDir, `violations-${today}.log`);
    
    const formattedEntry = this.formatViolationsEntry(violations, filePath);
    this.writeToFile(logPath, formattedEntry);
  }

  formatContextEntry(eventData) {
    const timestamp = new Date().toISOString();
    const lines = [];
    
    lines.push(`📅 TIMESTAMP: ${timestamp}`);
    lines.push(`🎯 EVENT: ${eventData.event || 'unknown'}`);
    
    if (eventData.file) {
      lines.push(`📁 FILE: ${eventData.file}`);
    }
    
    if (eventData.summary) {
      lines.push(`📊 SUMMARY:`);
      lines.push(`   • Violations: ${eventData.summary.totalIssues || 0}`);
      lines.push(`   • Severity: ${eventData.summary.severity || 'info'}`);
      lines.push(`   • AI Detected: ${eventData.summary.hasInsights ? 'YES' : 'NO'}`);
    }
    
    if (eventData.violations && eventData.violations.length > 0) {
      lines.push(`🚨 VIOLATIONS:`);
      eventData.violations.forEach((violation, index) => {
        const severityEmoji = this.getSeverityEmoji(violation.severity);
        lines.push(`   ${index + 1}. ${severityEmoji} [${violation.severity?.toUpperCase()}] ${violation.message}`);
        if (violation.line) {
          lines.push(`      📍 Line ${violation.line} | Rule: ${violation.rule || 'unknown'}`);
        }
      });
    }
    
    if (eventData.aiDetection && eventData.aiDetection.isLikelyAI) {
      lines.push(`🤖 AI CODE DETECTED:`);
      lines.push(`   • Confidence: ${(eventData.aiDetection.confidence * 100).toFixed(1)}%`);
      lines.push(`   • Recommendation: ${eventData.aiDetection.recommendation}`);
    }
    
    if (eventData.insights && eventData.insights.length > 0) {
      lines.push(`💡 INSIGHTS:`);
      eventData.insights.forEach((insight, index) => {
        lines.push(`   ${index + 1}. ${insight}`);
      });
    }
    
    return lines.join('\n');
  }

  formatDailyEntry(eventData) {
    const time = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS
    const file = eventData.file ? path.basename(eventData.file) : 'unknown';
    const violations = eventData.summary?.totalIssues || 0;
    const severity = eventData.summary?.severity || 'info';
    const ai = eventData.summary?.hasInsights ? '[AI]' : '';
    
    return `${time} | ${file.padEnd(25)} | ${violations.toString().padStart(3)} violations | ${severity.padEnd(8)} ${ai}`;
  }

  formatViolationsEntry(violations, filePath) {
    const timestamp = new Date().toISOString();
    const lines = [];
    
    lines.push(`\n${'='.repeat(100)}`);
    lines.push(`VIOLATIONS REPORT - ${timestamp}`);
    lines.push(`FILE: ${filePath}`);
    lines.push(`TOTAL VIOLATIONS: ${violations.length}`);
    lines.push(`${'='.repeat(100)}`);
    
    const grouped = violations.reduce((acc, violation) => {
      const severity = violation.severity || 'unknown';
      if (!acc[severity]) acc[severity] = [];
      acc[severity].push(violation);
      return acc;
    }, {});
    
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    
    severityOrder.forEach(severity => {
      if (grouped[severity] && grouped[severity].length > 0) {
        const emoji = this.getSeverityEmoji(severity);
        lines.push(`\n${emoji} ${severity.toUpperCase()} SEVERITY (${grouped[severity].length} issues):`);
        lines.push(`${'-'.repeat(50)}`);
        
        grouped[severity].forEach((violation, index) => {
          lines.push(`${index + 1}. ${violation.message}`);
          if (violation.line) {
            lines.push(`   📍 Line ${violation.line}, Column ${violation.column || 'N/A'}`);
          }
          if (violation.rule) {
            lines.push(`   📋 Rule: ${violation.rule} (${violation.category || 'general'})`);
          }
          if (violation.suggestion) {
            lines.push(`   💡 Suggestion: ${violation.suggestion}`);
          }
          lines.push(''); // Empty line between violations
        });
      }
    });
    
    lines.push(`${'='.repeat(100)}\n`);
    return lines.join('\n');
  }

  getSeverityEmoji(severity) {
    const emojis = {
      critical: '🔥',
      high: '🚨', 
      medium: '⚠️',
      low: '💡',
      info: 'ℹ️',
      unknown: '❓'
    };
    return emojis[severity?.toLowerCase()] || emojis.unknown;
  }

  writeSummaryReport(stats) {
    const logPath = path.join(this.logDir, 'summary.log');
    const lines = [];
    
    lines.push(`\n${'*'.repeat(80)}`);
    lines.push(`📊 MANASX MONITORING SUMMARY`);
    lines.push(`${'*'.repeat(80)}`);
    lines.push(`⏰ Generated: ${new Date().toISOString()}`);
    lines.push(`📁 Files Watched: ${stats.filesWatched || 0}`);
    lines.push(`🔄 Changes Detected: ${stats.changesDetected || 0}`);
    lines.push(`🚨 Violations Found: ${stats.violationsFound || 0}`);
    lines.push(`🤖 AI Code Detected: ${stats.aiCodeDetected || 0}`);
    
    if (stats.startTime) {
      const uptime = Math.round((new Date() - new Date(stats.startTime)) / 1000);
      lines.push(`⏳ Uptime: ${uptime} seconds`);
    }
    
    lines.push(`${'*'.repeat(80)}\n`);
    
    fs.writeFileSync(logPath, lines.join('\n'));
  }

  cleanOldLogs(daysToKeep = 7) {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      files.forEach(file => {
        if (file.startsWith('monitor-') || file.startsWith('violations-')) {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
            console.log(`Cleaned old log file: ${file}`);
          }
        }
      });
    } catch (error) {
      console.warn('Error cleaning old logs:', error.message);
    }
  }

  writeToFile(filePath, content) {
    try {
      fs.appendFileSync(filePath, content);
    } catch (error) {
      console.error(`Error writing to ${filePath}:`, error.message);
    }
  }
}