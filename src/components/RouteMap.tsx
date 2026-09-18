const STATIONS = [
  { code: "EW2", name: "Tampines", x: 328, y: 52 },
  { code: "EW3", name: "Simei", x: 300, y: 84 },
  { code: "EW4", name: "Tanah Merah", x: 266, y: 116 },
  { code: "EW5", name: "Bedok", x: 226, y: 142 },
  { code: "EW6", name: "Kembangan", x: 186, y: 164 },
  { code: "EW7", name: "Eunos", x: 150, y: 182 },
  { code: "EW8", name: "Paya Lebar", x: 118, y: 198 },
  { code: "EW11", name: "Lavender", x: 90, y: 218 },
  { code: "EW13", name: "City Hall", x: 66, y: 244 },
  { code: "EW14", name: "Raffles Place", x: 52, y: 276 },
];

const PATH = `M ${STATIONS.map((s) => `${s.x} ${s.y}`).join(" L ")}`;

/** Index of the station the train has most recently passed. */
const CURRENT = 3;

export function RouteMap() {
  const current = STATIONS[CURRENT]!;
  const travelled = STATIONS.slice(0, CURRENT + 1);

  return (
    <div className="glass-panel relative overflow-hidden rounded-3xl p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-brand-deep">Route map</h2>
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <span className="status-pulse size-2 rounded-full bg-primary" /> You are here
        </span>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-2xl bg-secondary/50">
        <svg viewBox="0 0 380 320" className="h-auto w-full" role="img" aria-label="East–West Line route from Tampines to Raffles Place, currently near Bedok">
          {/* land / water backdrop */}
          <rect x="0" y="0" width="380" height="320" className="fill-surface-strong" />
          <path d="M0 250 C 90 232, 170 268, 250 300 L 380 320 L 0 320 Z" className="fill-primary/8" />
          <path d="M0 0 L380 0 L380 40 C 280 70, 180 30, 0 70 Z" className="fill-success/8" />
          {/* faint road grid */}
          <g className="stroke-border" strokeWidth="1" opacity="0.5">
            <path d="M0 96 H380 M0 176 H380 M0 256 H380 M96 0 V320 M196 0 V320 M296 0 V320" />
          </g>

          {/* full line */}
          <path d={PATH} className="stroke-border" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d={PATH} className="stroke-primary/25" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* travelled portion */}
          <path
            d={`M ${travelled.map((s) => `${s.x} ${s.y}`).join(" L ")}`}
            className="stroke-primary"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {STATIONS.map((s, i) => {
            const isEnd = i === 0 || i === STATIONS.length - 1;
            const passed = i < CURRENT;
            return (
              <g key={s.code}>
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={isEnd ? 7 : 4.5}
                  className={
                    isEnd
                      ? "fill-surface-strong stroke-success"
                      : passed
                        ? "fill-surface-strong stroke-primary"
                        : "fill-surface-strong stroke-border"
                  }
                  strokeWidth={isEnd ? 4 : 3}
                />
                {isEnd && (
                  <text
                    x={s.x + 12}
                    y={s.y + 4}
                    className="fill-brand-deep font-semibold"
                    fontSize="12"
                    textAnchor={i === 0 ? "end" : "start"}
                    transform={i === 0 ? `translate(-24 0)` : undefined}
                  >
                    {s.name}
                  </text>
                )}
              </g>
            );
          })}

          {/* current position */}
          <circle cx={current.x} cy={current.y} r="16" className="fill-primary/20">
            <animate attributeName="r" values="12;20;12" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.55;0.1;0.55" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle cx={current.x} cy={current.y} r="8" className="fill-primary stroke-surface-strong" strokeWidth="3" />
          <text x={current.x - 22} y={current.y + 34} className="fill-primary font-semibold" fontSize="12">
            {current.name}
          </text>
        </svg>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Near {current.name} · {STATIONS.length - 1 - CURRENT} stops to Raffles Place
      </p>
    </div>
  );
}
