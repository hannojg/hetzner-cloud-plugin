import type { AsyncEntry } from '@napi-rs/keyring';

export interface CredentialStore {
  read(): Promise<string | null>;
  write(token: string): Promise<void>;
  remove(): Promise<void>;
}

export class KeyringCredentialStore implements CredentialStore {
  private entry: AsyncEntry | undefined;

  constructor(
    private readonly service = 'hetzner-cloud-plugin',
    private readonly account = 'default-project',
  ) {}

  private async getEntry(): Promise<AsyncEntry> {
    if (this.entry !== undefined) {
      return this.entry;
    }
    const keyring = await import('@napi-rs/keyring');
    const entry = new keyring.AsyncEntry(this.service, this.account, {
      linux: { store: 'secret-service' },
    });
    this.entry = entry;
    return entry;
  }

  async read(): Promise<string | null> {
    const entry = await this.getEntry();
    return entry.getPassword();
  }

  async write(token: string): Promise<void> {
    const entry = await this.getEntry();
    await entry.setPassword(token);
  }

  async remove(): Promise<void> {
    const entry = await this.getEntry();
    await entry.deleteCredential();
  }
}
