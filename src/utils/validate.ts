/**
 * Input validation helpers.
 *
 * Google Ads IDs and customer IDs are always numeric. We validate them before
 * interpolating into GAQL queries or resource names to prevent query injection
 * (values originate from an LLM / end user and must never be trusted verbatim).
 */

/** Validate a numeric Google Ads ID (campaign, ad group, criterion, etc.). */
export function numericId(value: string | number, label = "id"): string {
  const str = String(value).trim();
  if (!/^\d+$/.test(str)) {
    throw new Error(`Invalid ${label}: expected a numeric ID, got "${value}".`);
  }
  return str;
}

/** Validate a customer/account ID, stripping dashes (e.g. "123-456-7890"). */
export function customerId(value: string | number): string {
  const str = String(value).replace(/-/g, "").trim();
  if (!/^\d+$/.test(str)) {
    throw new Error(`Invalid customer_id: expected digits (with optional dashes), got "${value}".`);
  }
  return str;
}

/** Validate a value against an allowlist of enum members (case-insensitive). */
export function enumValue(value: string, allowed: readonly string[], label = "value"): string {
  const upper = String(value).toUpperCase();
  if (!allowed.includes(upper)) {
    throw new Error(`Invalid ${label}: "${value}". Allowed: ${allowed.join(", ")}.`);
  }
  return upper;
}
