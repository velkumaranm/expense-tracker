export async function searchMarketInstruments(kind, query) {
  const url = new URL("/api/market/search", window.location.origin);
  url.searchParams.set("kind", kind);
  url.searchParams.set("q", query);
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Could not search instruments");
  return data.results || [];
}

export async function refreshMarketHoldings(holdings) {
  const res = await fetch("/api/market/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ holdings }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Could not refresh holdings");
  return data;
}
