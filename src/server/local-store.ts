import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Item, Store } from './store.ts';

export class LocalStore implements Store {
  private items = new Map<string, Item>();
  private queue: Promise<void>;
  private readonly path?: string;

  constructor(path?: string) {
    this.path = path;
    this.queue = this.load();
  }

  private async load() {
    if (!this.path) return;
    try {
      const items = JSON.parse(await readFile(this.path, 'utf8')) as Item[];
      this.items = new Map(items.map(item => [item.key, item]));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  private mutate(change: (next: Map<string, Item>) => boolean): Promise<boolean> {
    const operation = this.queue.then(async () => {
      const next = new Map(this.items);
      if (!change(next)) return false;
      if (this.path) {
        await mkdir(dirname(this.path), { recursive: true });
        const temporary = this.path + '.new';
        await writeFile(temporary, JSON.stringify([...next.values()], null, 2), 'utf8');
        await rename(temporary, this.path);
      }
      this.items = next;
      return true;
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async get(key: string) {
    await this.queue;
    return this.items.get(key);
  }

  async list(prefix: string) {
    await this.queue;
    return [...this.items.values()].filter(item => item.key.startsWith(prefix));
  }

  put(key: string, value: unknown, expected?: string | null) {
    return this.mutate(items => {
      if (expected !== undefined && (items.get(key)?.revision ?? null) !== expected) return false;
      items.set(key, { key, revision: randomUUID(), value });
      return true;
    });
  }

  remove(key: string, expected?: string) {
    return this.mutate(items => {
      if (expected !== undefined && items.get(key)?.revision !== expected) return false;
      items.delete(key);
      return true;
    });
  }
}
