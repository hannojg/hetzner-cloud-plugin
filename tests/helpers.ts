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

export class MemoryProjects {
  readonly entries = new Map<string, MemoryStore>();
  readonly selected: string[] = [];
  listCalls = 0;

  constructor(initial: Record<string, string> = {}) {
    const entries = Object.entries(initial);
    for (const [name, token] of entries) {
      const store = new MemoryStore(token);
      this.entries.set(name, store);
    }
  }

  async list(): Promise<string[]> {
    this.listCalls += 1;
    const names: string[] = [];
    for (const [name, store] of this.entries) {
      if (store.value !== null) names.push(name);
    }
    return names;
  }

  forProject(name: string): MemoryStore {
    this.selected.push(name);
    const existing = this.entries.get(name);
    if (existing) return existing;
    const store = new MemoryStore();
    this.entries.set(name, store);
    return store;
  }
}
