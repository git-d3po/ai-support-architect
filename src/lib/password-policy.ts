export const MIN_PASSWORD_LENGTH = 8;

/** Returns a user-facing problem, or null when the new password is acceptable client-side. */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password !== confirm) return "Passwords do not match.";
  return null;
}
