/**
 * 密码哈希：PBKDF2（Web Crypto crypto.subtle），100,000 次迭代 SHA-256，16 字节随机盐
 * 存储格式：pbkdf2$100000$<salt_hex>$<hash_hex>（hash 32 字节 → 64 hex）
 */

const ITERATIONS = 100000;
const KEY_LEN_BYTES = 32;
const SALT_LEN_BYTES = 16;

function toHex(buf: Uint8Array): string {
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function deriveBits(plain: string, salt: Uint8Array, iterations: number, bits: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(plain),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    bits,
  );
  return new Uint8Array(derived);
}

/** 生成 PBKDF2 哈希字符串 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN_BYTES));
  const hash = await deriveBits(plain, salt, ITERATIONS, KEY_LEN_BYTES * 8);
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

/** 校验明文与存储的哈希是否匹配（常数时间比较） */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  const salt = fromHex(parts[2]);
  const expected = fromHex(parts[3]);
  if (salt.length === 0 || expected.length === 0) return false;
  const actual = await deriveBits(plain, salt, iterations, expected.length * 8);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
