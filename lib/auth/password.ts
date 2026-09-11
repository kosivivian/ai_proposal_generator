export const PASSWORD_POLICY_HINT =
  "At least 12 characters, with an uppercase letter, a lowercase letter, a number, and a symbol.";

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 12 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function randomChar(pool: string): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Generates a random password that always satisfies isStrongPassword(). */
export function generateTempPassword(length = 16): string {
  const required = [randomChar(UPPER), randomChar(LOWER), randomChar(DIGITS), randomChar(SYMBOLS)];
  const rest = Array.from({ length: length - required.length }, () => randomChar(ALL));
  const chars = [...required, ...rest];
  // Shuffle so the required characters aren't always in the same positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
