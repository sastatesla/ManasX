import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { OutputSchema } from '../output/OutputSchema.js';
import { IdentityResolver } from '../identity/IdentityResolver.js';

export class ViolationTracker {
  constructor() {
    this.dbDir = path.join(process.cwd(), '.manasx', 'db');
    this.dbPath = path.join(this.dbDir, 'violations.json');
    this._ensureDb();
  }

  _ensureDb() {
    if (!fs.existsSync(this.dbDir)) {
      fs.mkdirSync(this.dbDir, { recursive: true });
    }
    if (!fs.existsSync(this.dbPath)) {
      fs.writeFileSync(this.dbPath, JSON.stringify({ violations: {} }, null, 2));
    }
  }

  _load() {
    try {
      const data = fs.readFileSync(this.dbPath, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return { violations: {} };
    }
  }

  _save(data) {
    fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
  }

  trackViolations(file, violations) {
    const data = this._load();
    const formatted = OutputSchema.formatViolations(violations, file);
    const identity = IdentityResolver.getIdentity();
    
    let addedCount = 0;
    formatted.forEach(v => {
      if (!data.violations[v.id]) {
        data.violations[v.id] = {
          ...v,
          file,
          developer: identity.developer,
          team: identity.team,
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          status: 'pending',
          history: [{ action: 'created', timestamp: new Date().toISOString() }]
        };
        addedCount++;
      } else {
        data.violations[v.id].lastSeen = new Date().toISOString();
        if (data.violations[v.id].status === 'pending') {
          // Keep it pending
        }
      }
    });

    this._save(data);
    return addedCount;
  }

  listViolations(filters = {}) {
    const data = this._load();
    let records = Object.values(data.violations);

    if (filters.status) {
      records = records.filter(v => v.status === filters.status);
    }
    if (filters.team) {
       records = records.filter(v => v.team === filters.team);
    }
    
    // Auto clear expired waivers before returning
    let changed = false;
    records.forEach(r => {
       if (r.status === 'waived' && r.waiverExpiry && new Date(r.waiverExpiry) < new Date()) {
           r.status = 'pending';
           r.history.push({ action: 'waiver_expired', timestamp: new Date().toISOString() });
           changed = true;
       }
    });
    
    if (changed) this._save(data);
    
    return records;
  }

  updateStatus(id, newStatus, options = {}) {
    const data = this._load();
    if (!data.violations[id]) {
      throw new Error(`Violation ${id} not found`);
    }

    const violation = data.violations[id];
    const identity = IdentityResolver.getIdentity();

    violation.status = newStatus;
    
    if (newStatus === 'approved') {
      violation.reviewedBy = identity.developer;
    } else if (newStatus === 'waived') {
      violation.waivedBy = identity.developer;
      if (options.expiry) {
        // e.g. 30d
        const days = parseInt(options.expiry) || 30;
        const d = new Date();
        d.setDate(d.getDate() + days);
        violation.waiverExpiry = d.toISOString();
      }
    }

    violation.history.push({
      action: newStatus,
      by: identity.developer,
      timestamp: new Date().toISOString(),
      reason: options.reason || options.comment || null
    });

    this._save(data);
    return violation;
  }
}
