import { fmtINR } from "../lib/utils";

export const AreaTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1C1C24", border: "1px solid #32323E", borderRadius: 10, padding: "8px 11px", fontSize: 11 }}>
      <div style={{ color: "#9A9590", marginBottom: 2 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color || "#EEEAE4", fontWeight: 600 }}>
          {p.name}: {fmtINR(Number(p.value || 0))}
        </div>
      ))}
    </div>
  );
};

export const PieTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1C1C24", border: "1px solid #32323E", borderRadius: 10, padding: "8px 11px", fontSize: 11 }}>
      <div style={{ color: "#EEEAE4", fontWeight: 600 }}>{payload[0].name}</div>
      <div style={{ color: "#C8A96E" }}>{fmtINR(payload[0].value)}</div>
    </div>
  );
};
