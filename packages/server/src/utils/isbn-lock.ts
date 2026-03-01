const locks = new Map<string, Promise<void>>();

export async function withIsbnLock<T>(
  isbn: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = isbn.toLowerCase();

  while (locks.has(key)) {
    await locks.get(key);
  }

  let resolve: () => void;
  const lock = new Promise<void>((r) => {
    resolve = r;
  });
  locks.set(key, lock);

  try {
    return await fn();
  } finally {
    locks.delete(key);
    resolve!();
  }
}
