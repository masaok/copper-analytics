/**
 * The admin is whoever holds ADMIN_EMAIL, and only once a provider has verified it. Account
 * linking joins sign-ins by address, so an unverified match must not count.
 */
export function isAdmin(
  user: { email: string; emailVerified: boolean },
  adminEmail: string | undefined,
): boolean {
  return Boolean(adminEmail) && user.emailVerified && user.email.trim().toLowerCase() === adminEmail
}
