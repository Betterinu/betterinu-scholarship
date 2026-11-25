// Shared by the apply form and the /api/apply route so the browser and the
// server agree on what a valid number is. The CRM normalizes again on its
// side (lib/lead-phone.ts there); this just avoids sending it junk.

/** Strip formatting and the +91 / 0 prefixes down to bare 10 digits. */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return digits
}

/** True for a normalized 10-digit Indian mobile number. */
export function isValidMobile(normalized: string): boolean {
  return /^[6-9]\d{9}$/.test(normalized)
}
