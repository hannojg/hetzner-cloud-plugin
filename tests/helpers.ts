export class MemoryStore {
  value: string | null;
  reads = 0;
  writes: string[] = [];
  removals = 0;

  constructor(value: string | null = null) {
    this.value = value;
  }

  async read(): Promise<string | null> {
    this.reads += 1;
    return this.value;
  }

  async write(token: string): Promise<void> {
    this.writes.push(token);
    this.value = token;
  }

  async remove(): Promise<void> {
    this.removals += 1;
    this.value = null;
  }
}
