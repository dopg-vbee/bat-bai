export interface BlobStore {
  readonly description: string;
  /** Resolves null when the key does not exist; throws on any other failure. */
  get(key: string): Promise<Buffer | null>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  has(key: string): Promise<boolean>;
  /** Every key starting with `prefix` (recursive), sorted ascending. */
  list(prefix: string): Promise<string[]>;
  delete(key: string): Promise<void>;
}
