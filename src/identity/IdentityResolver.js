import { execSync } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';

export class IdentityResolver {
  static getIdentity() {
    let developer = os.userInfo().username || 'unknown';
    let team = process.env.MANASX_TEAM || 'unknown';
    let branch = 'unknown';
    let commit = 'unknown';
    let role = process.env.MANASX_ROLE || 'developer';
    let agentName = process.env.MANASX_AGENT || 'none';

    try {
      const gitName = execSync('git config user.name', { stdio: 'pipe' }).toString().trim();
      if (gitName) developer = gitName;
    } catch (e) {
      // Not a git repo or no git config
    }

    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', { stdio: 'pipe' }).toString().trim();
      commit = execSync('git rev-parse HEAD', { stdio: 'pipe' }).toString().trim();
    } catch (e) {
      // Git command failed
    }
    
    // Check local .manasx/identity.json if it exists
    try {
      const identityPath = path.join(process.cwd(), '.manasx', 'identity.json');
      if (fs.existsSync(identityPath)) {
        const localId = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
        if (localId.team) team = localId.team;
        if (localId.role) role = localId.role;
        if (localId.agentName) agentName = localId.agentName;
      }
    } catch (e) {
      // Ignored
    }

    return { developer, team, branch, commit, role, agentName };
  }

  static setIdentity(options) {
    const dirPath = path.join(process.cwd(), '.manasx');
    const identityPath = path.join(dirPath, 'identity.json');
    
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    let identity = {};
    if (fs.existsSync(identityPath)) {
      try {
        identity = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
      } catch (e) {
        // Ignore read/parse error, create fresh
      }
    }

    if (options.team) identity.team = options.team;
    if (options.role) identity.role = options.role;
    if (options.agent) identity.agentName = options.agent;

    fs.writeFileSync(identityPath, JSON.stringify(identity, null, 2));
    return identity;
  }
}
