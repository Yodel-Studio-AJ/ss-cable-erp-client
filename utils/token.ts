export function isTokenExpired(token: string): boolean {
  try {
    const base64url = token.split(".")[1];
    // JWT uses base64url — convert to standard base64 before atob()
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}
