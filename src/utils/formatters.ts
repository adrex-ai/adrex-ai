export interface MetricRow {
  [key: string]: string | number | undefined;
}

export function formatMetricsTable(
  rows: MetricRow[],
  columns: string[]
): string {
  if (rows.length === 0) return "No data available.";

  const headers = columns.map((col) =>
    col
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );

  const widths = columns.map((col, i) =>
    Math.max(
      headers[i].length,
      ...rows.map((r) => String(r[col] ?? "—").length)
    )
  );

  const headerLine = columns
    .map((_, i) => headers[i].padEnd(widths[i]))
    .join(" | ");
  const separator = widths.map((w) => "-".repeat(w)).join("-|-");
  const dataLines = rows.map((row) =>
    columns
      .map((col, i) => String(row[col] ?? "—").padEnd(widths[i]))
      .join(" | ")
  );

  return [headerLine, separator, ...dataLines].join("\n");
}

export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatCampaignStatus(status: string): string {
  const map: Record<string, string> = {
    ENABLED: "Active",
    PAUSED: "Paused",
    REMOVED: "Removed",
    ACTIVE: "Active",
  };
  return map[status] || status;
}

export function microsToCurrency(micros: number): number {
  return micros / 1_000_000;
}

export function formatDateRange(startDate: string, endDate: string): string {
  return `${startDate} to ${endDate}`;
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
