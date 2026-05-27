import { useState, useEffect, useCallback } from "react";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SUPABASE_URL  = "https://wapvjbfuwbcxgowhzsbd.supabase.co";
const SUPABASE_KEY  = "sb_publishable_bMKF8MRT-hdsDz-GL0CnPA_H1s_gpSk";

const sb = (path, opts = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    ...opts,
  }).then(r => r.json());

// ─── STORAGE ──────────────────────────────────────────────────────────────────

async function saveEntry(name, pin, picks) {
  await sb("picks", {
    method: "POST",
    body: JSON.stringify({ name, pin, data: picks, updated_at: new Date().toISOString() }),
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
  });
}

async function loadAllEntries() {
  const rows = await sb("picks?select=name,data");
  return Array.isArray(rows) ? rows.map(r => ({ name: r.name, picks: r.data })) : [];
}

async function loadMyEntry(name) {
  const rows = await sb(`picks?name=eq.${encodeURIComponent(name)}&select=name,pin,data`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function getFullAdminState() {
  const rows = await sb("admin_state?id=eq.1&select=phase,actual_advancers,actual_ff,live_standings");
  if (!Array.isArray(rows) || !rows[0]) return null;
  return {
    phase: rows[0].phase,
    actualAdvancers: rows[0].actual_advancers,
    actualFF: rows[0].actual_ff,
    liveStandings: rows[0].live_standings,
  };
}

async function saveAdminState(phase, actualAdvancers, actualFF, liveStandings) {
  await sb("admin_state?id=eq.1", {
    method: "PATCH",
    body: JSON.stringify({
      phase,
      actual_advancers: actualAdvancers || null,
      actual_ff: actualFF || null,
      live_standings: liveStandings || null,
    }),
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  });
}

// ─── DATA ─────────────────────────────────────────────────────────────────────

const GROUPS = [
  { id:"A", teams:["Mexico",     "South Korea",  "South Africa", "Czechia"] },
  { id:"B", teams:["Canada",     "Switzerland",  "Qatar",        "Bosnia & Herzegovina"] },
  { id:"C", teams:["Brazil",     "Morocco",      "Scotland",     "Haiti"] },
  { id:"D", teams:["USA",        "Paraguay",     "Australia",    "Turkey"] },
  { id:"E", teams:["Germany",    "Ecuador",      "Ivory Coast",  "Curaçao"] },
  { id:"F", teams:["Netherlands","Japan",        "Tunisia",      "Sweden"] },
  { id:"G", teams:["Belgium",    "Iran",         "Egypt",        "New Zealand"] },
  { id:"H", teams:["Spain",      "Uruguay",      "Saudi Arabia", "Cape Verde"] },
  { id:"I", teams:["France",     "Senegal",      "Norway",       "Iraq"] },
  { id:"J", teams:["Argentina",  "Austria",      "Algeria",      "Jordan"] },
  { id:"K", teams:["Portugal",   "Colombia",     "Uzbekistan",   "DR Congo"] },
  { id:"L", teams:["England",    "Croatia",      "Panama",       "Ghana"] },
];

const ALL_TEAMS = GROUPS.flatMap(g => g.teams);

const CONFEDERATION = {
  "Mexico":"CONCACAF","Canada":"CONCACAF","USA":"CONCACAF","Panama":"CONCACAF","Haiti":"CONCACAF","Curaçao":"CONCACAF",
  "England":"UEFA","France":"UEFA","Germany":"UEFA","Spain":"UEFA","Portugal":"UEFA","Netherlands":"UEFA",
  "Belgium":"UEFA","Croatia":"UEFA","Switzerland":"UEFA","Scotland":"UEFA","Norway":"UEFA","Austria":"UEFA",
  "Sweden":"UEFA","Turkey":"UEFA","Czechia":"UEFA","Bosnia & Herzegovina":"UEFA",
  "Brazil":"CONMEBOL","Argentina":"CONMEBOL","Uruguay":"CONMEBOL","Colombia":"CONMEBOL","Ecuador":"CONMEBOL","Paraguay":"CONMEBOL",
  "Morocco":"CAF","Senegal":"CAF","Egypt":"CAF","Ivory Coast":"CAF","South Africa":"CAF",
  "Algeria":"CAF","Tunisia":"CAF","Ghana":"CAF","Cape Verde":"CAF","DR Congo":"CAF",
  "Japan":"AFC","South Korea":"AFC","Saudi Arabia":"AFC","Australia":"AFC","Iran":"AFC",
  "Qatar":"AFC","Jordan":"AFC","Uzbekistan":"AFC","Iraq":"AFC",
  "New Zealand":"OFC",
};

const TEAM_COLORS = {
  "Mexico":"#006847","Canada":"#FF0000","USA":"#002868","Panama":"#005293","Haiti":"#00209F","Curaçao":"#003DA5",
  "England":"#012169","France":"#002395","Germany":"#3a3a3a","Spain":"#c60b1e","Portugal":"#006600",
  "Netherlands":"#FF4F00","Belgium":"#EF3340","Croatia":"#cc0000","Switzerland":"#cc0000","Scotland":"#003F87",
  "Norway":"#EF2B2D","Austria":"#ED2939","Sweden":"#006AA7","Turkey":"#E30A17","Czechia":"#cc0000",
  "Bosnia & Herzegovina":"#002395",
  "Brazil":"#009C3B","Argentina":"#74ACDF","Uruguay":"#5EB6E4","Colombia":"#FCD116","Ecuador":"#FFD100","Paraguay":"#D52B1E",
  "Morocco":"#006233","Senegal":"#00853F","Egypt":"#C8102E","Ivory Coast":"#F77F00","South Africa":"#007A4D",
  "Algeria":"#006233","Tunisia":"#E70013","Ghana":"#006B3F","Cape Verde":"#003893","DR Congo":"#007FFF",
  "Japan":"#BC002D","South Korea":"#CD2E3A","Saudi Arabia":"#006C35","Australia":"#FFCD00","Iran":"#239F40",
  "Qatar":"#8D1B3D","Jordan":"#007A3D","Uzbekistan":"#1EB53A","Iraq":"#CC0000","New Zealand":"#3a3a3a",
};

const CONF_STYLE = {
  UEFA:     { bg:"#1a3a6b", text:"#fff" },
  CONMEBOL: { bg:"#1a5c1a", text:"#fff" },
  CAF:      { bg:"#7a2000", text:"#fff" },
  AFC:      { bg:"#3d0070", text:"#fff" },
  CONCACAF: { bg:"#8B0000", text:"#fff" },
  OFC:      { bg:"#004d40", text:"#fff" },
};

const CONF_COUNTS = { UEFA:16, CONMEBOL:6, CAF:10, AFC:9, CONCACAF:6, OFC:1 };

const GROUP_POINTS = { 1:4, 2:3, 3:2, 4:1 };
const KO_POINTS    = { r32:3, r16:5, qf:8, sf:12, final:15 };
const FF_POINTS    = { 1:15, 2:7, 3:12, 4:5 };

const KO_ROUNDS = [
  { key:"r32",   label:"Round of 32",  pts:3,  slots:32 },
  { key:"r16",   label:"Round of 16",  pts:5,  slots:16 },
  { key:"qf",    label:"Quarterfinal", pts:8,  slots:8  },
  { key:"sf",    label:"Semifinal",    pts:12, slots:4  },
  { key:"final", label:"Final",        pts:15, slots:2  },
];

const ADMIN_PASS = "worldcup2026";
const MASTER_PIN = "2026";

// ─── THEME ────────────────────────────────────────────────────────────────────
const G1  = "#003d1a";   // darkest green (bg)
const G2  = "#005a2b";   // main green
const G3  = "#007a3d";   // mid green (cards)
const G4  = "#00a651";   // bright green (accents)
const WHT = "#ffffff";
const OFF = "#e8f5e9";   // off-white
const GLD = "#FFD700";   // gold for top scores
const CARD   = "rgba(0,90,43,0.5)";
const BORDER = "rgba(255,255,255,0.15)";
const DARK_BORDER = "rgba(0,0,0,0.3)";

// ─── SCORING ──────────────────────────────────────────────────────────────────

function calcLiveGroupScore(groupPicks, liveStandings) {
  if (!liveStandings || Object.keys(liveStandings).length === 0) return null;
  let pts = 0;
  Object.entries(groupPicks || {}).forEach(([team, predicted]) => {
    const actual = liveStandings[team];
    if (actual && actual === predicted) pts += GROUP_POINTS[predicted] || 0;
  });
  return pts;
}

function calcMaxGroupScore(groupPicks) {
  return Object.values(groupPicks || {}).reduce((s, r) => s + (GROUP_POINTS[r] || 0), 0);
}

function calcScore(picks, actualAdvancers, actualFF, liveStandings) {
  const liveG = calcLiveGroupScore(picks.groups, liveStandings);
  const maxG  = calcMaxGroupScore(picks.groups);
  const g     = liveG !== null ? liveG : maxG;
  let k = 0;
  Object.entries(picks.knockout || {}).forEach(([rnd, teams]) => {
    (teams || []).forEach(team => {
      const pool = actualAdvancers?.[rnd];
      k += pool ? (pool.includes(team) ? KO_POINTS[rnd] || 0 : 0) : KO_POINTS[rnd] || 0;
    });
  });
  let f = 0;
  Object.entries(picks.finalFour || {}).forEach(([place, team]) => {
    const actual = actualFF?.[parseInt(place)];
    f += actual ? (actual === team ? FF_POINTS[parseInt(place)] || 0 : 0) : FF_POINTS[parseInt(place)] || 0;
  });
  return { g, maxG, liveG, k, f, total: g + k + f, maxTotal: maxG + k + f };
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────

function Dot({ team, size=10 }) {
  return <span style={{
    display:"inline-block", width:size, height:size, borderRadius:"50%",
    background:TEAM_COLORS[team]||"#555", border:"1px solid rgba(255,255,255,0.3)",
    marginRight:5, flexShrink:0, verticalAlign:"middle"
  }}/>;
}

function ConfBadge({ team }) {
  const c = CONFEDERATION[team];
  const s = CONF_STYLE[c] || { bg:"#333", text:"#fff" };
  return <span style={{
    fontSize:8, fontWeight:700, letterSpacing:"0.4px",
    background:s.bg, color:s.text, padding:"1px 4px", borderRadius:3, flexShrink:0
  }}>{c}</span>;
}

function Btn({ children, onClick, bg=G4, color=WHT, style={}, disabled=false }) {
  return <button onClick={onClick} disabled={disabled} style={{
    background: disabled ? "rgba(255,255,255,0.1)" : bg,
    color: disabled ? "rgba(255,255,255,0.3)" : color,
    border: "none", borderRadius:8, padding:"10px 20px", fontWeight:800,
    fontSize:13, cursor:disabled?"default":"pointer",
    transition:"all 0.2s", fontFamily:"inherit", ...style
  }}>{children}</button>;
}

function InfoBox({ children, color=G4 }) {
  return <div style={{
    background:`rgba(0,166,81,0.1)`, border:`1px solid ${color}55`,
    borderRadius:8, padding:"10px 14px", marginBottom:16,
    fontSize:11, color:OFF, lineHeight:1.6
  }}>{children}</div>;
}

function PhaseGate({ label, description }) {
  return <div style={{ textAlign:"center", padding:"56px 20px", color:"rgba(255,255,255,0.3)" }}>
    <div style={{ fontSize:36, marginBottom:10 }}>🔒</div>
    <div style={{ fontSize:15, fontWeight:700, color:"rgba(255,255,255,0.4)", marginBottom:6 }}>{label}</div>
    <div style={{ fontSize:12 }}>{description}</div>
  </div>;
}

function TabBar({ tabs, active, onChange }) {
  return <div style={{
    display:"flex", gap:3,
    background:"rgba(0,0,0,0.3)", borderRadius:10, padding:4, flexWrap:"wrap"
  }}>
    {tabs.map(t => <button key={t.key} onClick={() => onChange(t.key)} style={{
      flex:1, minWidth:70, padding:"9px 4px", borderRadius:7, border:"none",
      background: active===t.key ? G4 : "transparent",
      color: active===t.key ? WHT : "rgba(255,255,255,0.5)",
      fontWeight:800, fontSize:11, cursor:"pointer",
      transition:"all 0.2s", whiteSpace:"nowrap", fontFamily:"inherit"
    }}>{t.label}</button>)}
  </div>;
}

function SectionTitle({ children }) {
  return <div style={{
    fontSize:11, fontWeight:800, textTransform:"uppercase",
    letterSpacing:"1px", color:G4, marginBottom:10
  }}>{children}</div>;
}

// ─── CONFEDERATION CHART ──────────────────────────────────────────────────────

function ConfChart() {
  return <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:"14px 18px", marginBottom:16 }}>
    <SectionTitle>🌍 All 48 Teams Confirmed by Confederation</SectionTitle>
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {Object.entries(CONF_COUNTS).map(([conf, count]) => {
        const s = CONF_STYLE[conf];
        return <div key={conf} style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{
            width:76, fontSize:9, fontWeight:700, letterSpacing:"0.5px",
            background:s.bg, color:s.text, padding:"2px 6px",
            borderRadius:4, textAlign:"center", flexShrink:0
          }}>{conf}</div>
          <div style={{ flex:1, background:"rgba(0,0,0,0.25)", borderRadius:6, height:18, overflow:"hidden" }}>
            <div style={{
              width:`${(count/16)*100}%`, background:s.bg, height:"100%", borderRadius:6,
              display:"flex", alignItems:"center", justifyContent:"flex-end", paddingRight:6
            }}>
              <span style={{ fontSize:10, fontWeight:800, color:s.text }}>{count}</span>
            </div>
          </div>
          <div style={{ color:"rgba(255,255,255,0.4)", fontSize:10, width:28, textAlign:"right", flexShrink:0 }}>
            {Math.round((count/48)*100)}%
          </div>
        </div>;
      })}
    </div>
    <div style={{ marginTop:10, color:G4, fontSize:10, textAlign:"center", fontWeight:700 }}>
      ✅ All 48 teams confirmed — group stage begins June 11, 2026
    </div>
  </div>;
}

// ─── GROUP PICKER ─────────────────────────────────────────────────────────────

function GroupPicker({ picks, onChange, liveStandings }) {
  const handleRank = (team, rank) => {
    const group = GROUPS.find(g => g.teams.includes(team));
    if (!group) return;
    const next = { ...picks };
    group.teams.forEach(t => { if (next[t] === rank && t !== team) delete next[t]; });
    if (next[team] === rank) delete next[team]; else next[team] = rank;
    onChange(next);
  };
  const done = GROUPS.filter(g => g.teams.every(t => picks[t])).length;
  const hasLive = liveStandings && Object.keys(liveStandings).length > 0;

  return <div>
    {hasLive && <InfoBox>
      <strong style={{ color:G4 }}>🔴 Live Standings Active</strong> — Green = your prediction matches current real standings. Red = currently wrong. Updates after each matchday.
    </InfoBox>}
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
      <div style={{ color:"rgba(255,255,255,0.6)", fontSize:12 }}>Rank each team 1st through 4th in their group</div>
      <div style={{
        color: done===12 ? G4 : WHT, fontWeight:800, fontSize:13,
        background: done===12 ? "rgba(0,166,81,0.2)" : "rgba(255,255,255,0.1)",
        padding:"4px 10px", borderRadius:20
      }}>{done}/12 groups done</div>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(265px,1fr))", gap:12 }}>
      {GROUPS.map(group => {
        const filled = group.teams.filter(t => picks[t]).length;
        return <div key={group.id} style={{
          background: CARD, border:`1px solid ${BORDER}`,
          borderRadius:10, overflow:"hidden",
          boxShadow:"0 4px 12px rgba(0,0,0,0.3)"
        }}>
          <div style={{
            background:`linear-gradient(135deg, ${G2}, ${G1})`,
            padding:"8px 12px", display:"flex", justifyContent:"space-between",
            alignItems:"center", borderBottom:`1px solid ${BORDER}`
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{
                background:WHT, color:G2, width:26, height:26, borderRadius:"50%",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontWeight:900, fontSize:13
              }}>{group.id}</div>
              <span style={{ color:"rgba(255,255,255,0.6)", fontSize:11 }}>{filled}/4 ranked</span>
            </div>
            {filled===4 && <span style={{ color:G4, fontSize:12, fontWeight:700 }}>✓ Done</span>}
          </div>
          <div style={{ padding:"8px 10px", display:"flex", flexDirection:"column", gap:5 }}>
            {group.teams.map(team => {
              const rank = picks[team];
              const liveRank = liveStandings?.[team];
              const isCorrect = rank && liveRank && rank === liveRank;
              const isWrong   = rank && liveRank && rank !== liveRank;
              return <div key={team} style={{
                display:"flex", alignItems:"center", gap:7,
                background: isCorrect ? "rgba(0,166,81,0.18)" : isWrong ? "rgba(220,50,50,0.12)" : rank ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.2)",
                border: isCorrect ? "1px solid rgba(0,166,81,0.5)" : isWrong ? "1px solid rgba(220,50,50,0.3)" : rank ? `1px solid ${BORDER}` : `1px solid ${DARK_BORDER}`,
                borderRadius:7, padding:"7px 9px", transition:"all 0.2s"
              }}>
                <Dot team={team}/>
                <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:2 }}>
                  <span style={{
                    fontSize:12, color:WHT, fontWeight:600,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"
                  }}>{team}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <ConfBadge team={team}/>
                    {liveRank && <span style={{ fontSize:8, color:"rgba(255,255,255,0.4)" }}>actual: #{liveRank}</span>}
                  </div>
                </div>
                <div style={{ display:"flex", gap:3 }}>
                  {[1,2,3,4].map(r => <button key={r} onClick={() => handleRank(team,r)} style={{
                    width:24, height:24, borderRadius:5, border:"none", cursor:"pointer",
                    background: rank===r ? (r<=2 ? G4 : r===3 ? "#7c6fc4" : "#666") : "rgba(0,0,0,0.3)",
                    color: rank===r ? WHT : "rgba(255,255,255,0.4)",
                    fontSize:11, fontWeight:800, transition:"all 0.15s", fontFamily:"inherit"
                  }}>{r}</button>)}
                </div>
                {rank && <span style={{
                  background: isCorrect ? G4 : rank<=2 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
                  color: isCorrect ? WHT : "rgba(255,255,255,0.8)",
                  borderRadius:5, padding:"2px 6px", fontSize:10, fontWeight:800, flexShrink:0
                }}>{isCorrect ? "✓ " : ""}+{GROUP_POINTS[rank]}</span>}
              </div>;
            })}
          </div>
        </div>;
      })}
    </div>
  </div>;
}

// ─── KNOCKOUT PICKER ──────────────────────────────────────────────────────────

function KnockoutPicker({ actualAdvancers, koPicks, onChange }) {
  const r32Pool = actualAdvancers?.r32 || [];
  const toggleTeam = (round, team) => {
    const current = koPicks[round] || [];
    const limit = KO_ROUNDS.find(r => r.key === round)?.slots || 0;
    let next;
    if (current.includes(team)) next = current.filter(t => t !== team);
    else if (current.length < limit) next = [...current, team];
    else next = [...current.slice(1), team];
    const idx = KO_ROUNDS.findIndex(r => r.key === round);
    const cleared = { ...koPicks, [round]: next };
    KO_ROUNDS.slice(idx+1).forEach(r => { cleared[r.key] = []; });
    onChange(cleared);
  };
  return <div>
    <InfoBox>
      <strong style={{ color:G4 }}>Knockout Stage</strong> — Pick which teams advance through each round, based on <strong style={{ color:WHT }}>who actually qualified</strong> from the group stage — not your predictions.
      Points: R32=3 · R16=5 · QF=8 · SF=12 · Final=15
    </InfoBox>
    {KO_ROUNDS.map((round, idx) => {
      const selected = koPicks[round.key] || [];
      const pool = round.key==="r32" ? r32Pool : (koPicks[KO_ROUNDS[idx-1]?.key] || []);
      const prevReady = round.key==="r32" ? r32Pool.length>0 : (koPicks[KO_ROUNDS[idx-1]?.key]||[]).length>0;
      return <div key={round.key} style={{ marginBottom:24 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ color:WHT, fontWeight:800, fontSize:14 }}>{round.label}</div>
          <div style={{
            background:"rgba(0,0,0,0.3)", borderRadius:20, padding:"3px 10px",
            color:"rgba(255,255,255,0.5)", fontSize:11
          }}>{selected.length}/{round.slots} · +{round.pts}pts each</div>
        </div>
        {!prevReady
          ? <div style={{ color:"rgba(255,255,255,0.25)", fontSize:11, padding:"12px 0" }}>
              {round.key==="r32" ? "⏳ Waiting for admin to enter group stage results..." : "Complete the previous round first."}
            </div>
          : <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {pool.map(team => {
                const sel = selected.includes(team);
                return <button key={team} onClick={() => toggleTeam(round.key, team)} style={{
                  display:"flex", alignItems:"center", gap:5,
                  background: sel ? "rgba(0,166,81,0.25)" : "rgba(0,0,0,0.25)",
                  border: sel ? `1px solid ${G4}` : `1px solid ${BORDER}`,
                  borderRadius:8, padding:"7px 12px", cursor:"pointer",
                  color: sel ? WHT : "rgba(255,255,255,0.6)",
                  fontWeight: sel ? 700 : 400, fontSize:12, transition:"all 0.15s",
                  fontFamily:"inherit"
                }}>
                  <Dot team={team} size={8}/>{team}
                  {sel && <span style={{ fontSize:10, color:"rgba(255,255,255,0.5)" }}> +{round.pts}</span>}
                </button>;
              })}
            </div>
        }
      </div>;
    })}
  </div>;
}

// ─── FINAL FOUR PICKER ────────────────────────────────────────────────────────

function FinalFourPicker({ actualFF, ffPicks, onChange }) {
  const pool = actualFF || [];
  const placements = [
    { place:1, label:"🥇 Champion",  pts:15, color:GLD },
    { place:2, label:"🥈 Runner-Up", pts:7,  color:"#C0C0C0" },
    { place:3, label:"🥉 3rd Place", pts:12, color:"#b39ddb", note:"(won consolation match)" },
    { place:4, label:"4th Place",    pts:5,  color:"rgba(255,255,255,0.5)" },
  ];
  const assign = (place, team) => {
    const next = { ...ffPicks };
    Object.keys(next).forEach(p => { if (next[p] === team) delete next[p]; });
    if (next[place] === team) delete next[place]; else next[place] = team;
    onChange(next);
  };
  return <div>
    <InfoBox>
      <strong style={{ color:G4 }}>Final Four</strong> — Assign finishing positions for the actual four semifinalists.
      Note: <strong style={{ color:WHT }}>3rd place earns 12pts</strong> (more than 2nd place's 7pts) because they must win the consolation match.
    </InfoBox>
    {pool.length===0
      ? <PhaseGate label="Final Four Not Yet Set"
          description="The admin will enter the four semifinalists once they're confirmed." />
      : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {placements.map(({ place, label, pts, color, note }) => {
            const assigned = ffPicks[place];
            return <div key={place} style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:"14px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ color, fontWeight:800, fontSize:14 }}>
                  {label} {note && <span style={{ color:"rgba(255,255,255,0.35)", fontWeight:400, fontSize:10 }}>{note}</span>}
                </div>
                <div style={{
                  background: assigned ? "rgba(0,166,81,0.2)" : "rgba(0,0,0,0.3)",
                  border: `1px solid ${assigned ? G4 : BORDER}`,
                  borderRadius:20, padding:"3px 10px",
                  color: assigned ? G4 : "rgba(255,255,255,0.3)", fontSize:12, fontWeight:700
                }}>+{pts} pts</div>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {pool.map(team => {
                  const sel = assigned===team;
                  const taken = !sel && Object.values(ffPicks).includes(team);
                  return <button key={team} onClick={() => !taken && assign(place, team)} style={{
                    display:"flex", alignItems:"center", gap:5,
                    background: sel ? "rgba(0,166,81,0.25)" : taken ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.25)",
                    border: sel ? `1px solid ${G4}` : `1px solid ${BORDER}`,
                    borderRadius:8, padding:"7px 12px", cursor:taken?"default":"pointer",
                    color: sel ? WHT : taken ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)",
                    fontWeight: sel ? 700 : 400, fontSize:12,
                    opacity: taken ? 0.4 : 1, transition:"all 0.15s", fontFamily:"inherit"
                  }}><Dot team={team} size={8}/>{team}</button>;
                })}
              </div>
            </div>;
          })}
        </div>
    }
  </div>;
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────

function Leaderboard({ entries, myName, actualAdvancers, actualFF, liveStandings }) {
  const hasLive = liveStandings && Object.keys(liveStandings).length > 0;
  const scored = [...entries]
    .map(e => ({ ...e, score: calcScore(e.picks, actualAdvancers, actualFF, liveStandings) }))
    .sort((a,b) => b.score.total - a.score.total);

  if (scored.length===0) return <div style={{ textAlign:"center", padding:"48px 0", color:"rgba(255,255,255,0.3)" }}>
    No submissions yet — be the first!
  </div>;

  return <div>
    <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11, marginBottom:14, textAlign:"center" }}>
      {scored.length} submission{scored.length!==1?"s":""} ·{" "}
      {hasLive ? "🔴 Live scoring active" : "⚡ Showing max possible points — live scoring starts when games begin"}
    </div>
    {scored.map((entry, i) => {
      const { g, maxG, liveG, k, f, total, maxTotal } = entry.score;
      const isMe = entry.name === myName;
      const medals = ["🥇","🥈","🥉"];
      return <div key={entry.name} style={{
        background: isMe ? "rgba(0,166,81,0.15)" : CARD,
        border: isMe ? `1px solid ${G4}` : `1px solid ${BORDER}`,
        borderRadius:12, padding:"12px 16px", marginBottom:8,
        display:"flex", alignItems:"center", gap:12,
        boxShadow: isMe ? "0 0 20px rgba(0,166,81,0.2)" : "none"
      }}>
        <div style={{ fontSize:18, width:28, textAlign:"center", flexShrink:0 }}>
          {i < 3 ? medals[i] : <span style={{ color:"rgba(255,255,255,0.4)", fontSize:13 }}>#{i+1}</span>}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:14, color: isMe ? G4 : WHT }}>
            {entry.name} {isMe && <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>(you)</span>}
          </div>
          <div style={{ display:"flex", gap:12, marginTop:4, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>
              <span style={{ color:G4, fontWeight:700 }}>{g}</span>
              {hasLive && liveG !== null && <span style={{ color:"rgba(255,255,255,0.3)" }}>/{maxG}</span>}
              {" "}Groups
            </span>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>
              <span style={{ color:"#64b5f6", fontWeight:700 }}>{k}</span> Knockout
            </span>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>
              <span style={{ color:"#ce93d8", fontWeight:700 }}>{f}</span> Final 4
            </span>
            {hasLive && maxTotal !== total && (
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>
                max: {maxTotal}
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontSize:22, fontWeight:900, color: isMe ? G4 : WHT }}>{total}</div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"0.5px" }}>
            {hasLive ? "live pts" : "max pts"}
          </div>
        </div>
      </div>;
    })}
  </div>;
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────

function AdminPanel({ phase, actualAdvancers, actualFF, liveStandings, onUpdate }) {
  const [pass,setPass]     = useState("");
  const [auth,setAuth]     = useState(false);
  const [msg,setMsg]       = useState("");
  const [r32,setR32]       = useState(actualAdvancers?.r32 || []);
  const [ff,setFF]         = useState(actualFF || []);
  const [saving,setSaving] = useState(false);
  const [liveDraft,setLiveDraft] = useState(liveStandings || {});

  const flash = m => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const save = async (newPhase, newLive) => {
    setSaving(true);
    const adv = newPhase>=2 ? { r32 } : actualAdvancers;
    const finalFour = newPhase>=3 ? ff : actualFF;
    const standings = newLive !== undefined ? newLive : liveDraft;
    await saveAdminState(newPhase, adv, finalFour, standings);
    onUpdate({ phase:newPhase, actualAdvancers:adv, actualFF:finalFour, liveStandings:standings });
    flash("✓ Saved!");
    setSaving(false);
  };

  const handleLiveRank = (team, rank) => {
    const group = GROUPS.find(g => g.teams.includes(team));
    if (!group) return;
    const next = { ...liveDraft };
    group.teams.forEach(t => { if (next[t]===rank && t!==team) delete next[t]; });
    if (next[team]===rank) delete next[team]; else next[team]=rank;
    setLiveDraft(next);
  };

  if (!auth) return <div style={{ maxWidth:340, margin:"40px auto", textAlign:"center" }}>
    <div style={{ fontSize:28, marginBottom:8 }}>🔐</div>
    <div style={{ color:"rgba(255,255,255,0.6)", fontSize:13, marginBottom:16 }}>Admin access required</div>
    <input value={pass} onChange={e=>setPass(e.target.value)} type="password"
      onKeyDown={e=>e.key==="Enter"&&pass===ADMIN_PASS&&setAuth(true)}
      placeholder="Password..."
      style={{
        width:"100%", padding:"11px 13px", borderRadius:8, border:`1px solid ${BORDER}`,
        background:"rgba(0,0,0,0.3)", color:WHT, fontSize:14,
        outline:"none", boxSizing:"border-box", marginBottom:10, fontFamily:"inherit"
      }}/>
    <Btn onClick={() => { if(pass===ADMIN_PASS) setAuth(true); else flash("Wrong password"); }} style={{ width:"100%" }}>
      Unlock Admin
    </Btn>
    {msg && <div style={{ color:"#ff6b6b", fontSize:11, marginTop:8 }}>{msg}</div>}
  </div>;

  return <div>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
      <SectionTitle>⚙️ Admin Panel</SectionTitle>
      {msg && <div style={{ color:G4, fontSize:12, fontWeight:700 }}>{msg}</div>}
    </div>

    {/* Phase */}
    <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
      <SectionTitle>Tournament Phase</SectionTitle>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {[
          { p:1, label:"Phase 1", sub:"Group Stage picks open" },
          { p:2, label:"Phase 2", sub:"Knockout unlocked" },
          { p:3, label:"Phase 3", sub:"Final Four unlocked" },
        ].map(({ p, label, sub }) => (
          <button key={p} onClick={() => save(p)} style={{
            background: phase===p ? "rgba(0,166,81,0.2)" : "rgba(0,0,0,0.25)",
            border: phase===p ? `1px solid ${G4}` : `1px solid ${BORDER}`,
            borderRadius:8, padding:"10px 14px", cursor:"pointer",
            textAlign:"left", flex:1, minWidth:120, fontFamily:"inherit"
          }}>
            <div style={{ fontWeight:800, fontSize:12, color: phase===p ? G4 : "rgba(255,255,255,0.6)" }}>{label}</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginTop:2 }}>{sub}</div>
          </button>
        ))}
      </div>
    </div>

    {/* Live Standings */}
    <div style={{ background:CARD, border:"1px solid rgba(0,166,81,0.4)", borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <div>
          <div style={{ color:G4, fontWeight:800, fontSize:13 }}>🔴 Live Group Standings</div>
          <div style={{ color:"rgba(255,255,255,0.4)", fontSize:10, marginTop:2 }}>
            Update after each matchday — everyone's scores recalculate instantly
          </div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <Btn onClick={() => save(phase)} bg={G4} color={WHT} disabled={saving} style={{ padding:"7px 14px", fontSize:11 }}>
            {saving ? "Saving..." : "Save Standings"}
          </Btn>
          <Btn onClick={() => { setLiveDraft({}); save(phase, {}); }} bg="rgba(0,0,0,0.4)" color="rgba(255,255,255,0.5)" style={{ padding:"7px 14px", fontSize:11 }}>
            Clear
          </Btn>
        </div>
      </div>
      <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10, marginBottom:12 }}>
        {Object.keys(liveDraft).length} of 48 teams ranked · Rank 1–4 per group to match real current standings
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))", gap:8 }}>
        {GROUPS.map(group => (
          <div key={group.id} style={{ background:"rgba(0,0,0,0.2)", border:`1px solid ${DARK_BORDER}`, borderRadius:8, padding:"8px 10px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
              <div style={{
                background:G4, color:WHT, width:22, height:22, borderRadius:"50%",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontWeight:900, fontSize:11
              }}>{group.id}</div>
              <span style={{ color:"rgba(255,255,255,0.4)", fontSize:10 }}>
                {group.teams.filter(t => liveDraft[t]).length}/4 set
              </span>
            </div>
            {group.teams.map(team => {
              const rank = liveDraft[team];
              return <div key={team} style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}>
                <Dot team={team} size={7}/>
                <span style={{ flex:1, fontSize:11, color:"rgba(255,255,255,0.7)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{team}</span>
                <div style={{ display:"flex", gap:2 }}>
                  {[1,2,3,4].map(r => <button key={r} onClick={() => handleLiveRank(team, r)} style={{
                    width:20, height:20, borderRadius:3, border:"none", cursor:"pointer",
                    background: rank===r ? (r<=2 ? G4 : r===3 ? "#7c6fc4" : "#555") : "rgba(0,0,0,0.3)",
                    color: rank===r ? WHT : "rgba(255,255,255,0.35)",
                    fontSize:9, fontWeight:800, fontFamily:"inherit"
                  }}>{r}</button>)}
                </div>
              </div>;
            })}
          </div>
        ))}
      </div>
    </div>

    {/* R32 */}
    <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <SectionTitle>Actual Round of 32 ({r32.length}/32)</SectionTitle>
        <Btn onClick={() => save(Math.max(phase,2))} bg="#1565c0" color={WHT}
          disabled={r32.length!==32||saving} style={{ padding:"7px 14px", fontSize:11 }}>
          {saving ? "Saving..." : "Save & Unlock Knockout"}
        </Btn>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
        {ALL_TEAMS.map(team => {
          const sel = r32.includes(team);
          return <button key={team} onClick={() => setR32(prev => sel ? prev.filter(t=>t!==team) : prev.length<32 ? [...prev,team] : prev)} style={{
            display:"flex", alignItems:"center", gap:5,
            background: sel ? "rgba(21,101,192,0.25)" : "rgba(0,0,0,0.25)",
            border: sel ? "1px solid #64b5f6" : `1px solid ${BORDER}`,
            borderRadius:6, padding:"4px 9px", cursor:"pointer",
            color: sel ? "#90caf9" : "rgba(255,255,255,0.4)",
            fontWeight: sel ? 700 : 400, fontSize:11, fontFamily:"inherit"
          }}><Dot team={team} size={7}/>{team}</button>;
        })}
      </div>
      {r32.length!==32 && <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10, marginTop:8 }}>
        Select exactly 32 teams ({r32.length} currently selected)
      </div>}
    </div>

    {/* Final Four */}
    <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:10, padding:"14px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <SectionTitle>Actual Final Four ({ff.length}/4)</SectionTitle>
        <Btn onClick={() => save(3)} bg="#6a1b9a" color={WHT}
          disabled={ff.length!==4||saving} style={{ padding:"7px 14px", fontSize:11 }}>
          {saving ? "Saving..." : "Save & Unlock Final 4"}
        </Btn>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
        {ALL_TEAMS.map(team => {
          const sel = ff.includes(team);
          return <button key={team} onClick={() => setFF(prev => sel ? prev.filter(t=>t!==team) : prev.length<4 ? [...prev,team] : prev)} style={{
            display:"flex", alignItems:"center", gap:5,
            background: sel ? "rgba(106,27,154,0.25)" : "rgba(0,0,0,0.25)",
            border: sel ? "1px solid #ce93d8" : `1px solid ${BORDER}`,
            borderRadius:6, padding:"4px 9px", cursor:"pointer",
            color: sel ? "#e1bee7" : "rgba(255,255,255,0.4)",
            fontWeight: sel ? 700 : 400, fontSize:11, fontFamily:"inherit"
          }}><Dot team={team} size={7}/>{team}</button>;
        })}
      </div>
      {ff.length!==4 && <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10, marginTop:8 }}>
        Select exactly 4 teams ({ff.length} currently selected)
      </div>}
    </div>
  </div>;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [step,setStep]         = useState("name"); // name | pin-new | pin-return
  const [nameInput,setNameInput] = useState("");
  const [pinInput,setPinInput]   = useState("");
  const [loading,setLoading]     = useState(false);
  const [error,setError]         = useState("");
  const [existingEntry,setExistingEntry] = useState(null);

  const handleNameNext = async () => {
    if (!nameInput.trim()) return;
    setLoading(true); setError("");
    const entry = await loadMyEntry(nameInput.trim());
    setExistingEntry(entry);
    setStep(entry ? "pin-return" : "pin-new");
    setLoading(false);
  };

  const handlePinSubmit = async () => {
    if (pinInput.length < 4) { setError("PIN must be 4 digits"); return; }
    setLoading(true); setError("");
    const name = nameInput.trim();

    // Master PIN override
    if (pinInput === MASTER_PIN) {
      onLogin(name, pinInput, existingEntry?.data || { groups:{}, knockout:{}, finalFour:{} });
      return;
    }

    if (step === "pin-return") {
      if (pinInput === existingEntry.pin) {
        onLogin(name, pinInput, existingEntry.data || { groups:{}, knockout:{}, finalFour:{} });
      } else {
        setError("Wrong PIN. Try again or contact the league admin.");
        setLoading(false);
      }
    } else {
      // New user — save with PIN
      const newPicks = { groups:{}, knockout:{}, finalFour:{} };
      await saveEntry(name, pinInput, newPicks);
      onLogin(name, pinInput, newPicks);
    }
  };

  return (
    <div style={{
      minHeight:"100vh",
      background:`linear-gradient(160deg, ${G1} 0%, #001a0d 60%, #000 100%)`,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20
    }}>
      <div style={{
        background:"rgba(0,90,43,0.4)", border:`1px solid ${BORDER}`,
        borderRadius:20, padding:"40px 32px", maxWidth:400, width:"100%",
        textAlign:"center", boxShadow:"0 20px 60px rgba(0,0,0,0.5)",
        backdropFilter:"blur(10px)"
      }}>
        <div style={{ fontSize:48, marginBottom:8 }}>🏆</div>
        <div style={{ fontSize:26, fontWeight:900, color:WHT, marginBottom:2, letterSpacing:"-0.5px" }}>
          World Cup 2026
        </div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", marginBottom:6 }}>
          Fantasy Prediction League
        </div>
        <div style={{
          background:"rgba(0,166,81,0.15)", border:"1px solid rgba(0,166,81,0.3)",
          borderRadius:8, padding:"6px 12px", marginBottom:28, fontSize:11, color:G4
        }}>
          ✅ All 48 teams confirmed · June 11 – July 19, 2026
        </div>

        {step === "name" && <>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:8, textAlign:"left" }}>Your name</div>
          <input value={nameInput} onChange={e=>setNameInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleNameNext()}
            placeholder="Enter your name..."
            style={{
              width:"100%", padding:"12px 14px", borderRadius:10, border:`1px solid ${BORDER}`,
              background:"rgba(0,0,0,0.4)", color:WHT, fontSize:15,
              outline:"none", boxSizing:"border-box", marginBottom:12, fontFamily:"inherit"
            }}/>
          <Btn onClick={handleNameNext} disabled={loading||!nameInput.trim()} style={{ width:"100%", padding:"12px" }}>
            {loading ? "Checking..." : "Continue →"}
          </Btn>
        </>}

        {step === "pin-new" && <>
          <div style={{ color:WHT, fontWeight:700, fontSize:15, marginBottom:6 }}>
            Welcome, {nameInput}! 👋
          </div>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12, marginBottom:16 }}>
            Create a 4-digit PIN to protect your picks. You'll need this to log back in.
          </div>
          <input value={pinInput} onChange={e=>setPinInput(e.target.value.replace(/\D/g,"").slice(0,4))}
            onKeyDown={e=>e.key==="Enter"&&handlePinSubmit()}
            placeholder="Choose a 4-digit PIN"
            type="password" inputMode="numeric" maxLength={4}
            style={{
              width:"100%", padding:"12px 14px", borderRadius:10, border:`1px solid ${BORDER}`,
              background:"rgba(0,0,0,0.4)", color:WHT, fontSize:20, letterSpacing:"8px",
              textAlign:"center", outline:"none", boxSizing:"border-box", marginBottom:12, fontFamily:"inherit"
            }}/>
          {error && <div style={{ color:"#ff6b6b", fontSize:11, marginBottom:8 }}>{error}</div>}
          <Btn onClick={handlePinSubmit} disabled={loading||pinInput.length<4} style={{ width:"100%", padding:"12px" }}>
            {loading ? "Setting up..." : "Create My Account →"}
          </Btn>
          <button onClick={()=>{setStep("name");setPinInput("");setError("");}} style={{
            background:"none", border:"none", color:"rgba(255,255,255,0.3)",
            fontSize:11, cursor:"pointer", marginTop:10, fontFamily:"inherit"
          }}>← Back</button>
        </>}

        {step === "pin-return" && <>
          <div style={{ color:WHT, fontWeight:700, fontSize:15, marginBottom:6 }}>
            Welcome back, {nameInput}! ⚽
          </div>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12, marginBottom:16 }}>
            Enter your PIN to access your picks
          </div>
          <input value={pinInput} onChange={e=>setPinInput(e.target.value.replace(/\D/g,"").slice(0,4))}
            onKeyDown={e=>e.key==="Enter"&&handlePinSubmit()}
            placeholder="Your 4-digit PIN"
            type="password" inputMode="numeric" maxLength={4}
            style={{
              width:"100%", padding:"12px 14px", borderRadius:10, border:`1px solid ${BORDER}`,
              background:"rgba(0,0,0,0.4)", color:WHT, fontSize:20, letterSpacing:"8px",
              textAlign:"center", outline:"none", boxSizing:"border-box", marginBottom:12, fontFamily:"inherit"
            }}/>
          {error && <div style={{ color:"#ff6b6b", fontSize:11, marginBottom:8 }}>{error}</div>}
          <Btn onClick={handlePinSubmit} disabled={loading||pinInput.length<4} style={{ width:"100%", padding:"12px" }}>
            {loading ? "Checking..." : "Enter →"}
          </Btn>
          <button onClick={()=>{setStep("name");setPinInput("");setError("");}} style={{
            background:"none", border:"none", color:"rgba(255,255,255,0.3)",
            fontSize:11, cursor:"pointer", marginTop:10, fontFamily:"inherit"
          }}>← Back</button>
          <div style={{ color:"rgba(255,255,255,0.2)", fontSize:10, marginTop:8 }}>
            Forgot your PIN? Contact the league admin.
          </div>
        </>}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen,setScreen]   = useState("login");
  const [name,setName]       = useState("");
  const [pin,setPin]         = useState("");
  const [tab,setTab]         = useState("groups");
  const [saving,setSaving]   = useState(false);
  const [saved,setSaved]     = useState(false);
  const [entries,setEntries] = useState([]);
  const [phase,setPhase]     = useState(1);
  const [actualAdvancers,setActualAdvancers] = useState(null);
  const [actualFF,setActualFF]       = useState(null);
  const [liveStandings,setLiveStandings] = useState(null);
  const [picks,setPicks]     = useState({ groups:{}, knockout:{}, finalFour:{} });

  const loadAdmin = useCallback(async () => {
    const s = await getFullAdminState();
    if (s) {
      if (s.phase != null)    setPhase(s.phase);
      if (s.actualAdvancers)  setActualAdvancers(s.actualAdvancers);
      if (s.actualFF)         setActualFF(s.actualFF);
      if (s.liveStandings)    setLiveStandings(s.liveStandings);
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setEntries(await loadAllEntries());
  }, []);

  useEffect(() => { if(screen==="app") { loadAdmin(); loadLeaderboard(); } }, [screen,loadAdmin,loadLeaderboard]);
  useEffect(() => { if(tab==="leaderboard") { loadAdmin(); loadLeaderboard(); } }, [tab,loadAdmin,loadLeaderboard]);

  const handleLogin = (n, p, existingPicks) => {
    setName(n); setPin(p);
    if (existingPicks) setPicks(existingPicks);
    setScreen("app");
  };

  const handleSave = async () => {
    setSaving(true);
    await saveEntry(name, pin, picks);
    await loadLeaderboard();
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleAdminUpdate = ({ phase:p, actualAdvancers:a, actualFF:f, liveStandings:l }) => {
    if (p != null)      setPhase(p);
    if (a != null)      setActualAdvancers(a);
    if (f != null)      setActualFF(f);
    if (l !== undefined) setLiveStandings(l);
  };

  const score = calcScore(picks, actualAdvancers, actualFF, liveStandings);
  const hasLive = liveStandings && Object.keys(liveStandings).length > 0;
  const groupsDone = GROUPS.filter(g => g.teams.every(t => picks.groups[t])).length;

  if (screen === "login") return <LoginScreen onLogin={handleLogin}/>;

  const tabs = [
    { key:"groups",     label:`Groups ${groupsDone===12?"✓":"("+groupsDone+"/12)"}` },
    { key:"knockout",   label:`Knockout${phase<2?" 🔒":""}` },
    { key:"finalfour",  label:`Final 4${phase<3?" 🔒":""}` },
    { key:"leaderboard",label:`🏅 (${entries.length})` },
    { key:"admin",      label:"⚙️" },
  ];

  return (
    <div style={{
      minHeight:"100vh",
      background:`linear-gradient(160deg, ${G1} 0%, #001a0d 60%, #000 100%)`,
      fontFamily:"'Segoe UI', system-ui, Arial, sans-serif", color:WHT
    }}>
      {/* Header */}
      <div style={{
        background:`linear-gradient(135deg, ${G2}, ${G1})`,
        borderBottom:`2px solid ${G4}`,
        padding:"13px 18px",
        boxShadow:"0 4px 20px rgba(0,0,0,0.4)"
      }}>
        <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
          <div>
            <div style={{ fontWeight:900, fontSize:18, letterSpacing:"-0.3px" }}>
              🏆 <span style={{ color:G4 }}>WC2026</span> <span style={{ color:WHT }}>Fantasy</span>
            </div>
            <div style={{ color:"rgba(255,255,255,0.5)", fontSize:11, marginTop:1 }}>
              <span style={{ color:G4, fontWeight:700 }}>{name}</span>
              {" · "}
              <span style={{ color:["",G4,"#64b5f6","#ce93d8"][phase] }}>
                {["","Phase 1: Groups","Phase 2: Knockout","Phase 3: Final Four"][phase]}
              </span>
              {hasLive && <span style={{ color:"#ff6b6b" }}> · 🔴 Live</span>}
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:22, fontWeight:900, color:G4 }}>{score.total}</div>
              <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"0.5px" }}>
                {hasLive ? "live pts" : "max pts"}
              </div>
              {hasLive && score.maxTotal !== score.total && (
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)" }}>max {score.maxTotal}</div>
              )}
            </div>
            <Btn onClick={handleSave} disabled={saving}
              bg={saved ? "#2e7d32" : G4} color={WHT} style={{ padding:"9px 16px" }}>
              {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Picks"}
            </Btn>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"16px" }}>
        <TabBar tabs={tabs} active={tab} onChange={setTab}/>
        <div style={{ marginTop:16 }}>

          {tab==="groups" && <>
            <ConfChart/>
            <GroupPicker picks={picks.groups}
              onChange={g => setPicks(p=>({...p, groups:g}))}
              liveStandings={liveStandings}/>
          </>}

          {tab==="knockout" && (phase<2
            ? <PhaseGate label="Knockout Stage Locked"
                description="The admin will unlock this once group stage results are in and the real 32 advancing teams are entered." />
            : <KnockoutPicker actualAdvancers={actualAdvancers}
                koPicks={picks.knockout}
                onChange={ko => setPicks(p=>({...p, knockout:ko}))}/>
          )}

          {tab==="finalfour" && (phase<3
            ? <PhaseGate label="Final Four Locked"
                description="The admin will unlock this once the four semifinalists are confirmed." />
            : <FinalFourPicker actualFF={actualFF}
                ffPicks={picks.finalFour}
                onChange={ff => setPicks(p=>({...p, finalFour:ff}))}/>
          )}

          {tab==="leaderboard" && (
            <Leaderboard entries={entries} myName={name}
              actualAdvancers={actualAdvancers} actualFF={actualFF}
              liveStandings={liveStandings}/>
          )}

          {tab==="admin" && (
            <AdminPanel phase={phase} actualAdvancers={actualAdvancers}
              actualFF={actualFF} liveStandings={liveStandings}
              onUpdate={handleAdminUpdate}/>
          )}

        </div>

        {tab!=="leaderboard" && tab!=="admin" && (
          <div style={{ marginTop:24, display:"flex", justifyContent:"center" }}>
            <Btn onClick={handleSave} disabled={saving}
              bg={saved?"#2e7d32":G4} color={WHT} style={{ minWidth:180, padding:"12px" }}>
              {saving ? "Saving..." : saved ? "✓ Saved!" : "💾 Save My Picks"}
            </Btn>
          </div>
        )}

        <div style={{ textAlign:"center", marginTop:20, color:"rgba(255,255,255,0.1)", fontSize:10 }}>
          June 11 – July 19, 2026 · USA · Canada · Mexico
        </div>
      </div>
    </div>
  );
}
