import { KeyringCredentialStore } from './credential-store.js';
import type { CredentialStore } from './credential-store.js';
import type { Dirent } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

export interface ProjectStore {
  list(): Promise<string[]>;
  forProject(name: string): CredentialStore;
}

export interface KeyringProjectStoreOptions {
  credentialFactory?: (account: string) => CredentialStore;
  directory?: string;
}

const service = 'hetzner-cloud-plugin';
const accountPrefix = 'project-v1-';

export function normalizeProjectName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const invalidUnicode = /[\p{Cc}\p{Cs}]/u.test(value);
  if (invalidUnicode) return null;
  const trimmed = value.trim();
  const name = trimmed.normalize('NFC');
  const characters = [...name];
  if (characters.length === 0 || characters.length > 30) return null;
  const lowerCase = name.toLowerCase();
  return lowerCase === 'default' ? 'Default' : name;
}

function createCredential(account: string): CredentialStore {
  return new KeyringCredentialStore(service, account);
}

function registryDirectory(): string {
  const home = homedir();
  if (process.platform === 'darwin') {
    return join(home, 'Library', 'Application Support', service, 'projects');
  }
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local');
    return join(base, service, 'projects');
  }
  if (process.platform === 'linux') {
    const base = process.env.XDG_CONFIG_HOME ?? join(home, '.config');
    const absolute = isAbsolute(base);
    if (absolute === false) {
      throw new Error('XDG_CONFIG_HOME must be an absolute path.');
    }
    return join(base, service, 'projects');
  }
  throw new Error('This operating system is not supported.');
}

function accountForProject(name: string): string {
  if (name === 'Default') return 'default-project';
  const bytes = Buffer.from(name, 'utf8');
  const encoded = bytes.toString('hex');
  return `${accountPrefix}${encoded}`;
}

function projectForAccount(account: string): string | null {
  if (account === 'default-project') return 'Default';
  const supported = account.startsWith(accountPrefix);
  if (supported === false) return null;
  const encoded = account.slice(accountPrefix.length);
  const bytes = Buffer.from(encoded, 'hex');
  const decoded = bytes.toString('utf8');
  const name = normalizeProjectName(decoded);
  if (name === null || name === 'Default' || name !== decoded) return null;
  const canonical = accountForProject(name);
  return canonical === account ? name : null;
}

export class KeyringProjectStore implements ProjectStore {
  private readonly credentialFactory: (account: string) => CredentialStore;
  private readonly directory: string;

  constructor(options: KeyringProjectStoreOptions = {}) {
    this.credentialFactory = options.credentialFactory ?? createCredential;
    this.directory = options.directory ?? registryDirectory();
  }

  private async candidates(): Promise<string[]> {
    let entries: Dirent[];
    try {
      entries = await readdir(this.directory, { withFileTypes: true });
    } catch (error) {
      const missing = error instanceof Error && 'code' in error && error.code === 'ENOENT';
      if (missing) return ['Default'];
      throw error;
    }
    const names = new Set<string>();
    for (const entry of entries) {
      const directory = entry.isDirectory();
      if (directory === false) continue;
      const name = projectForAccount(entry.name);
      if (name !== null && name !== 'Default') names.add(name);
    }
    const projects = [...names];
    projects.sort();
    projects.unshift('Default');
    return projects;
  }

  async list(): Promise<string[]> {
    const candidates = await this.candidates();
    const projects: string[] = [];
    for (const name of candidates) {
      const credential = this.forProject(name);
      const token = await credential.read();
      if (token !== null && token.length > 0) projects.push(name);
    }
    return projects;
  }

  forProject(name: string): CredentialStore {
    const normalized = normalizeProjectName(name);
    if (normalized === null) {
      throw new Error('Use a project name with 1–30 characters and no control characters.');
    }
    const account = accountForProject(normalized);
    const credential = this.credentialFactory(account);
    return {
      read: () => credential.read(),
      write: async token => {
        if (normalized !== 'Default') {
          const path = join(this.directory, account);
          await mkdir(path, { recursive: true, mode: 0o700 });
        }
        await credential.write(token);
      },
      remove: () => credential.remove(),
    };
  }
}
