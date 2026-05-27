import { useState, useEffect, useCallback } from "react";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
// Replace these two values with your own from Supabase → Settings → API

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

// ─── STORAGE LAYER (Supabase) ─────────────────────────────────────────────────

async function saveEntry(name, picks) {
  await sb("picks", {
    method: "POST",
    body: JSON.stringify({ name, data: picks, updated_at: new Date().toISOString() }),
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
  const rows = await sb(`picks?name=eq.${encodeURIComponent(name)}&select=name,data`);
  return Array.isArray(rows) && rows[0] ? { name: rows[0].name, picks: rows[0].data } : null;
}

async function getAdminState() {
  const rows = await sb("admin_state?id=eq.1&select=phase,actual_advancers,actual_ff");
  return Array.isArray(rows) && rows[0] ? {
    phase: rows[0].phase,
    actualAdvancers: rows[0].actual_advancers,
    actualFF: rows[0].actual_ff,
  } : null;
}

async function saveAdminState(phase, actualAdvancers, actualFF) {
  await sb("admin_state?id=eq.1", {
    method: "PATCH",
    body: JSON.stringify({
      phase,
      actual_advancers: actualAdvancers || null,
      actual_ff: actualFF || null,
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
  { id:"A", teams:["Mexico",     "South Korea",  "South Africa",        "Czechia"] },
  { id:"B", teams:["Canada",     "Switzerland",  "Qatar",               "Bosnia & Herzegovina"] },
  { id:"C", teams:["Brazil",     "Morocco",      "Scotland",            "Haiti"] },
  { id:"D", teams:["USA",        "Paraguay",     "Australia",           "Turkey"] },
  { id:"E", teams:["Germany",    "Ecuador",      "Ivory Coast",         "Curaçao"] },
  { id:"F", teams:["Netherlands","Japan",        "Tunisia",             "Sweden"] },
  { id:"G", teams:["Belgium",    "Iran",         "Egypt",               "New Zealand"] },
  { id:"H", teams:["Spain",      "Uruguay",      "Saudi Arabia",        "Cape Verde"] },
  { id:"I", teams:["France",     "Senegal",      "Norway",              "Iraq"] },
  { id:"J", teams:["Argentina",  "Austria",      "Algeria",             "Jordan"] },
  { id:"K", teams:["Portugal",   "Colombia",     "Uzbekistan",          "DR Congo"] },
  { id:"L", teams:["England",    "Croatia",      "Panama",              "Ghana"] },
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
  "England":"#012169","France":"#002395","Germany":"#1a1a1a","Spain":"#c60b1e","Portugal":"#006600",
  "Netherlands":"#FF4F00","Belgium":"#EF3340","Croatia":"#cc0000","Switzerland":"#cc0000","Scotland":"#003F87",
  "Norway":"#EF2B2D","Austria":"#ED2939","Sweden":"#006AA7","Turkey":"#E30A17","Czechia":"#cc0000",
  "Bosnia & Herzegovina":"#002395",
  "Brazil":"#009C3B","Argentina":"#74ACDF","Uruguay":"#5EB6E4","Colombia":"#FCD116","Ecuador":"#FFD100","Paraguay":"#D52B1E",
  "Morocco":"#006233","Senegal":"#00853F","Egypt":"#C8102E","Ivory Coast":"#F77F00","South Africa":"#007A4D",
  "Algeria":"#006233","Tunisia":"#E70013","Ghana":"#006B3F","Cape Verde":"#003893","DR Congo":"#007FFF",
  "Japan":"#BC002D","South Korea":"#CD2E3A","Saudi Arabia":"#006C35","Australia":"#FFCD00","Iran":"#239F40",
  "Qatar":"#8D1B3D","Jordan":"#007A3D","Uzbekistan":"#1EB53A","Iraq":"#CC0000","New Zealand":"#111111",
};

const CONF_STYLE = {
  UEFA:     { bg:"#1a3a6b", text:"#fff" },
  CONMEBOL: { bg:"#2e7d32", text:"#fff" },
  CAF:      { bg:"#bf360c", text:"#fff" },
  AFC:      { bg:"#4a148c", text:"#fff" },
  CONCACAF: { bg:"#b71c1c", text:"#fff" },
  OFC:      { bg:"#00695c", text:"#fff" },
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
const GOLD="#FFD700", DARK="#0a0a1a", CARD="rgba(255,255,255,0.05)", BORDER="rgba(255,255,255,0.1)";

// ─── SCORING ──────────────────────────────────────────────────────────────────

function calcScore(picks, actualAdvancers, actualFF) {
  let g=0, k=0, f=0;
  Object.values(picks.groups||{}).forEach(r => g += GROUP_POINTS[r]||0);
  Object.entries(picks.knockout||{}).forEach(([rnd,teams]) => {
    (teams||[]).forEach(team => {
      const pool = actualAdvancers?.[rnd];
      k += pool ? (pool.includes(team) ? KO_POINTS[rnd]||0 : 0) : KO_POINTS[rnd]||0;
    });
  });
  Object.entries(picks.finalFour||{}).forEach(([place,team]) => {
    const actual = actualFF?.[parseInt(place)];
    f += actual ? (actual===team ? FF_POINTS[parseInt(place)]||0 : 0) : FF_POINTS[parseInt(place)]||0;
  });
  return { g, k, f, total: g+k+f };
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────

function Dot({ team, size=10 }) {
  return <span style={{ display:"inline-block", width:size, height:size, borderRadius:"50%",
    background:TEAM_COLORS[team]||"#555", border:"1px solid rgba(255,255,255,0.2)",
    marginRight:5, flexShrink:0, verticalAlign:"middle" }}/>;
}

function ConfBadge({ team }) {
  const c = CONFEDERATION[team]; const s = CONF_STYLE[c]||{bg:"#333",text:"#fff"};
  return <span style={{ fontSize:8, fontWeight:700, letterSpacing:"0.4px",
    background:s.bg, color:s.text, padding:"1px 4px", borderRadius:3, flexShrink:0 }}>{c}</span>;
}

function Btn({ children, onClick, bg=GOLD, color="#000", style={}, disabled=false }) {
  return <button onClick={onClick} disabled={disabled} style={{
    background:disabled?"#2a2a2a":bg, color:disabled?"#555":color,
    border:"none", borderRadius:8, padding:"9px 18px", fontWeight:800,
    fontSize:12, cursor:disabled?"default":"pointer", transition:"all 0.2s", ...style
  }}>{children}</button>;
}

function InfoBox({ children, color=GOLD }) {
  return <div style={{ background:`${color}11`, border:`1px solid ${color}33`,
    borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:11, color:"#bbb", lineHeight:1.6 }}>
    {children}
  </div>;
}

function PhaseGate({ label, description }) {
  return <div style={{ textAlign:"center", padding:"56px 20px", color:"#444" }}>
    <div style={{ fontSize:36, marginBottom:10 }}>🔒</div>
    <div style={{ fontSize:15, fontWeight:700, color:"#555", marginBottom:6 }}>{label}</div>
    <div style={{ fontSize:12 }}>{description}</div>
  </div>;
}

function TabBar({ tabs, active, onChange }) {
  return <div style={{ display:"flex", gap:3, background:"rgba(0,0,0,0.35)", borderRadius:10, padding:4, flexWrap:"wrap" }}>
    {tabs.map(t => <button key={t.key} onClick={() => onChange(t.key)} style={{
      flex:1, minWidth:70, padding:"8px 4px", borderRadius:7, border:"none",
      background:active===t.key?GOLD:"transparent", color:active===t.key?"#000":"#777",
      fontWeight:800, fontSize:11, cursor:"pointer", transition:"all 0.2s", whiteSpace:"nowrap"
    }}>{t.label}</button>)}
  </div>;
}

// ─── CONFEDERATION CHART ──────────────────────────────────────────────────────

function ConfChart() {
  return <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:"14px 18px", marginBottom:16 }}>
    <div style={{ color:GOLD, fontWeight:800, fontSize:13, marginBottom:12 }}>🌍 All 48 Teams by Confederation</div>
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {Object.entries(CONF_COUNTS).map(([conf,count]) => {
        const s = CONF_STYLE[conf];
        return <div key={conf} style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:76, fontSize:9, fontWeight:700, letterSpacing:"0.5px",
            background:s.bg, color:s.text, padding:"2px 6px", borderRadius:4, textAlign:"center", flexShrink:0 }}>{conf}</div>
          <div style={{ flex:1, background:"rgba(255,255,255,0.07)", borderRadius:6, height:18, overflow:"hidden" }}>
            <div style={{ width:`${(count/16)*100}%`, background:s.bg, height:"100%", borderRadius:6,
              display:"flex", alignItems:"center", justifyContent:"flex-end", paddingRight:6 }}>
              <span style={{ fontSize:10, fontWeight:800, color:s.text }}>{count}</span>
            </div>
          </div>
          <div style={{ color:"#555", fontSize:10, width:28, textAlign:"right", flexShrink:0 }}>
            {Math.round((count/48)*100)}%
          </div>
        </div>;
      })}
    </div>
    <div style={{ marginTop:10, color:"#4caf50", fontSize:10, textAlign:"center", fontWeight:700 }}>
      ✅ All 48 teams confirmed
    </div>
  </div>;
}

// ─── GROUP PICKER ─────────────────────────────────────────────────────────────

function GroupPicker({ picks, onChange }) {
  const handleRank = (team, rank) => {
    const group = GROUPS.find(g => g.teams.includes(team));
    if (!group) return;
    const next = {...picks};
    group.teams.forEach(t => { if (next[t]===rank && t!==team) delete next[t]; });
    if (next[team]===rank) delete next[team]; else next[team]=rank;
    onChange(next);
  };
  const done = GROUPS.filter(g => g.teams.every(t => picks[t])).length;

  return <div>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
      <div style={{ color:"#aaa", fontSize:12 }}>Rank each team 1–4 in their group</div>
      <div style={{ color:done===12?"#4caf50":GOLD, fontWeight:800, fontSize:13 }}>{done}/12 groups done</div>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(265px,1fr))", gap:12 }}>
      {GROUPS.map(group => {
        const filled = group.teams.filter(t => picks[t]).length;
        return <div key={group.id} style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:10, overflow:"hidden" }}>
          <div style={{ background:"linear-gradient(135deg,#1a1a2e,#16213e)", padding:"8px 12px",
            display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:`1px solid ${GOLD}33` }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ background:GOLD, color:"#000", width:26, height:26, borderRadius:"50%",
                display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:13 }}>
                {group.id}
              </div>
              <span style={{ color:"#777", fontSize:11 }}>{filled}/4 ranked</span>
            </div>
            {filled===4 && <span style={{ color:"#4caf50", fontSize:11, fontWeight:700 }}>✓</span>}
          </div>
          <div style={{ padding:"8px 10px", display:"flex", flexDirection:"column", gap:5 }}>
            {group.teams.map(team => {
              const rank = picks[team];
              return <div key={team} style={{
                display:"flex", alignItems:"center", gap:7,
                background:rank?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.03)",
                border:rank?"1px solid rgba(255,215,0,0.3)":`1px solid ${BORDER}`,
                borderRadius:7, padding:"7px 9px"
              }}>
                <Dot team={team}/>
                <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:2 }}>
                  <span style={{ fontSize:12, color:"#ddd", fontWeight:600,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{team}</span>
                  <ConfBadge team={team}/>
                </div>
                <div style={{ display:"flex", gap:3, marginLeft:4 }}>
                  {[1,2,3,4].map(r => <button key={r} onClick={() => handleRank(team,r)} style={{
                    width:22, height:22, borderRadius:4, border:"none", cursor:"pointer",
                    background:rank===r?(r<=2?"#FFD700":r===3?"#7c6fc4":"#555"):"rgba(255,255,255,0.1)",
                    color:rank===r?(r<=2?"#000":"#fff"):"#666", fontSize:10, fontWeight:800, transition:"all 0.15s"
                  }}>{r}</button>)}
                </div>
                {rank && <span style={{ background:rank<=2?GOLD:"#444", color:rank<=2?"#000":"#ccc",
                  borderRadius:4, padding:"1px 5px", fontSize:10, fontWeight:800, flexShrink:0 }}>
                  +{GROUP_POINTS[rank]}
                </span>}
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
    const current = koPicks[round]||[];
    const limit = KO_ROUNDS.find(r=>r.key===round)?.slots||0;
    let next;
    if (current.includes(team)) next = current.filter(t=>t!==team);
    else if (current.length<limit) next = [...current,team];
    else next = [...current.slice(1),team];
    const idx = KO_ROUNDS.findIndex(r=>r.key===round);
    const cleared = {...koPicks,[round]:next};
    KO_ROUNDS.slice(idx+1).forEach(r => { cleared[r.key]=[]; });
    onChange(cleared);
  };
  return <div>
    <InfoBox>
      <strong style={{ color:GOLD }}>Knockout Stage</strong> — Pick which teams advance through each round,
      based on <strong style={{ color:"#fff" }}>who actually qualified</strong> from the group stage.
      Points: R32=3 · R16=5 · QF=8 · SF=12 · Final=15
    </InfoBox>
    {KO_ROUNDS.map((round,idx) => {
      const selected = koPicks[round.key]||[];
      const pool = round.key==="r32" ? r32Pool : (koPicks[KO_ROUNDS[idx-1]?.key]||[]);
      const prevReady = round.key==="r32" ? r32Pool.length>0 : (koPicks[KO_ROUNDS[idx-1]?.key]||[]).length>0;
      return <div key={round.key} style={{ marginBottom:22 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div style={{ color:GOLD, fontWeight:800, fontSize:13 }}>{round.label}</div>
          <div style={{ color:"#666", fontSize:11 }}>{selected.length}/{round.slots} · +{round.pts}pts each</div>
        </div>
        {!prevReady
          ? <div style={{ color:"#444", fontSize:11, padding:"8px 0" }}>
              {round.key==="r32" ? "Waiting for group stage results..." : "Complete the previous round first."}
            </div>
          : <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {pool.map(team => {
                const sel = selected.includes(team);
                return <button key={team} onClick={() => toggleTeam(round.key,team)} style={{
                  display:"flex", alignItems:"center", gap:5,
                  background:sel?"rgba(255,215,0,0.14)":"rgba(255,255,255,0.05)",
                  border:sel?"1px solid rgba(255,215,0,0.45)":`1px solid ${BORDER}`,
                  borderRadius:7, padding:"6px 10px", cursor:"pointer",
                  color:sel?GOLD:"#aaa", fontWeight:sel?700:400, fontSize:12, transition:"all 0.15s"
                }}><Dot team={team} size={8}/>{team}{sel&&<span style={{ fontSize:10,color:"#888" }}> +{round.pts}</span>}</button>;
              })}
            </div>
        }
      </div>;
    })}
  </div>;
}

// ─── FINAL FOUR PICKER ────────────────────────────────────────────────────────

function FinalFourPicker({ actualFF, ffPicks, onChange }) {
  const pool = actualFF||[];
  const placements = [
    { place:1, label:"🥇 Champion",  pts:15, color:GOLD },
    { place:2, label:"🥈 Runner-Up", pts:7,  color:"#C0C0C0" },
    { place:3, label:"🥉 3rd Place", pts:12, color:"#9b8ec4", note:"(won consolation match)" },
    { place:4, label:"4th Place",    pts:5,  color:"#888" },
  ];
  const assign = (place, team) => {
    const next = {...ffPicks};
    Object.keys(next).forEach(p => { if (next[p]===team) delete next[p]; });
    if (next[place]===team) delete next[place]; else next[place]=team;
    onChange(next);
  };
  return <div>
    <InfoBox>
      <strong style={{ color:GOLD }}>Final Four</strong> — Assign finishing positions for the actual four semifinalists.
      3rd place (12pts) scores higher than 2nd (7pts) because they must win the consolation match.
    </InfoBox>
    {pool.length===0
      ? <PhaseGate label="Final Four Not Yet Set"
          description="The admin will enter the four semifinalists once they're confirmed." />
      : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {placements.map(({ place,label,pts,color,note }) => {
            const assigned = ffPicks[place];
            return <div key={place} style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:10, padding:"12px 14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ color, fontWeight:800, fontSize:13 }}>
                  {label} {note&&<span style={{ color:"#555", fontWeight:400, fontSize:10 }}>{note}</span>}
                </div>
                <div style={{ background:assigned?"rgba(255,215,0,0.15)":"rgba(255,255,255,0.05)",
                  border:`1px solid ${assigned?"rgba(255,215,0,0.3)":BORDER}`,
                  borderRadius:6, padding:"2px 8px", color:assigned?GOLD:"#444", fontSize:11, fontWeight:700 }}>
                  +{pts} pts
                </div>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {pool.map(team => {
                  const sel=assigned===team, taken=!sel&&Object.values(ffPicks).includes(team);
                  return <button key={team} onClick={() => !taken&&assign(place,team)} style={{
                    display:"flex", alignItems:"center", gap:5,
                    background:sel?"rgba(255,215,0,0.17)":taken?"rgba(0,0,0,0.1)":"rgba(255,255,255,0.05)",
                    border:sel?"1px solid rgba(255,215,0,0.5)":`1px solid ${BORDER}`,
                    borderRadius:7, padding:"6px 10px", cursor:taken?"default":"pointer",
                    color:sel?GOLD:taken?"#333":"#aaa", fontWeight:sel?700:400,
                    fontSize:12, opacity:taken?0.35:1, transition:"all 0.15s"
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

function Leaderboard({ entries, myName, actualAdvancers, actualFF }) {
  const scored = [...entries]
    .map(e => ({ ...e, score: calcScore(e.picks, actualAdvancers, actualFF) }))
    .sort((a,b) => b.score.total - a.score.total);
  const hasReal = !!(actualAdvancers || actualFF);

  if (scored.length===0) return <div style={{ textAlign:"center", padding:"48px 0", color:"#555" }}>
    No submissions yet — be the first!
  </div>;

  return <div>
    <div style={{ color:"#555", fontSize:11, marginBottom:12, textAlign:"center" }}>
      {scored.length} submission{scored.length!==1?"s":""} ·{" "}
      {hasReal ? "📊 Live scoring active" : "⚡ Showing max possible points"}
    </div>
    {scored.map((entry,i) => {
      const { g,k,f,total } = entry.score;
      const isMe = entry.name===myName;
      return <div key={entry.name} style={{
        background:isMe?"rgba(255,215,0,0.07)":CARD,
        border:isMe?"1px solid rgba(255,215,0,0.3)":`1px solid ${BORDER}`,
        borderRadius:10, padding:"11px 15px", marginBottom:7,
        display:"flex", alignItems:"center", gap:10
      }}>
        <div style={{ fontSize:16, width:26, textAlign:"center", flexShrink:0 }}>
          {["🥇","🥈","🥉"][i]||`#${i+1}`}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:13, color:isMe?GOLD:"#fff" }}>
            {entry.name} {isMe&&<span style={{ fontSize:10, color:"#888" }}>(you)</span>}
          </div>
          <div style={{ display:"flex", gap:10, marginTop:3, flexWrap:"wrap" }}>
            {[{l:"Groups",v:g,c:"#4caf50"},{l:"Knockout",v:k,c:"#2196f3"},{l:"Final 4",v:f,c:"#9c27b0"}].map(s =>
              <span key={s.l} style={{ fontSize:10, color:"#666" }}>
                <span style={{ color:s.c, fontWeight:700 }}>{s.v}</span> {s.l}
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontSize:20, fontWeight:900, color:isMe?GOLD:"#fff" }}>{total}</div>
          <div style={{ fontSize:9, color:"#555", textTransform:"uppercase" }}>pts</div>
        </div>
      </div>;
    })}
  </div>;
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────

function AdminPanel({ phase, actualAdvancers, actualFF, onUpdate }) {
  const [pass,setPass]   = useState("");
  const [auth,setAuth]   = useState(false);
  const [msg,setMsg]     = useState("");
  const [r32,setR32]     = useState(actualAdvancers?.r32||[]);
  const [ff,setFF]       = useState(actualFF||[]);
  const [saving,setSaving] = useState(false);

  const flash = m => { setMsg(m); setTimeout(()=>setMsg(""),3000); };

  const save = async (newPhase) => {
    setSaving(true);
    const adv = newPhase>=2 ? { r32 } : actualAdvancers;
    const finalFour = newPhase>=3 ? ff : actualFF;
    await saveAdminState(newPhase, adv, finalFour);
    onUpdate({ phase:newPhase, actualAdvancers:adv, actualFF:finalFour });
    flash(`✓ Phase ${newPhase} saved!`);
    setSaving(false);
  };

  if (!auth) return <div style={{ maxWidth:340, margin:"40px auto", textAlign:"center" }}>
    <div style={{ fontSize:26, marginBottom:8 }}>🔐</div>
    <div style={{ color:"#888", fontSize:13, marginBottom:14 }}>Admin password required</div>
    <input value={pass} onChange={e=>setPass(e.target.value)} type="password"
      onKeyDown={e=>e.key==="Enter"&&pass===ADMIN_PASS&&setAuth(true)}
      placeholder="Password..."
      style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:`1px solid ${BORDER}`,
        background:"rgba(255,255,255,0.07)", color:"#fff", fontSize:14,
        outline:"none", boxSizing:"border-box", marginBottom:10 }}/>
    <Btn onClick={() => { if(pass===ADMIN_PASS) setAuth(true); else flash("Wrong password"); }} style={{ width:"100%" }}>
      Unlock
    </Btn>
    {msg&&<div style={{ color:"#f44", fontSize:11, marginTop:8 }}>{msg}</div>}
  </div>;

  return <div>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
      <div style={{ color:GOLD, fontWeight:800, fontSize:14 }}>⚙️ Admin Panel</div>
      {msg&&<div style={{ color:"#4caf50", fontSize:12, fontWeight:700 }}>{msg}</div>}
    </div>

    <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
      <div style={{ color:"#777", fontWeight:700, fontSize:11, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.5px" }}>Tournament Phase</div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {[{p:1,label:"Phase 1",sub:"Group Stage"},{p:2,label:"Phase 2",sub:"Knockout unlocked"},{p:3,label:"Phase 3",sub:"Final Four unlocked"}].map(({p,label,sub}) => (
          <button key={p} onClick={() => save(p)} style={{
            background:phase===p?"rgba(255,215,0,0.13)":CARD,
            border:phase===p?"1px solid rgba(255,215,0,0.45)":`1px solid ${BORDER}`,
            borderRadius:8, padding:"10px 14px", cursor:"pointer", textAlign:"left", flex:1, minWidth:110
          }}>
            <div style={{ fontWeight:800, fontSize:12, color:phase===p?GOLD:"#777" }}>{label}</div>
            <div style={{ fontSize:10, color:"#444", marginTop:2 }}>{sub}</div>
          </button>
        ))}
      </div>
    </div>

    <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div style={{ color:"#aaa", fontWeight:700, fontSize:12 }}>
          Actual Round of 32 <span style={{ color:r32.length===32?"#4caf50":"#777" }}>({r32.length}/32)</span>
        </div>
        <Btn onClick={() => save(Math.max(phase,2))} bg="#2196f3" color="#fff"
          disabled={r32.length!==32||saving} style={{ padding:"6px 12px", fontSize:11 }}>
          {saving?"Saving...":"Save R32"}
        </Btn>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
        {ALL_TEAMS.map(team => {
          const sel = r32.includes(team);
          return <button key={team} onClick={() => setR32(prev => sel?prev.filter(t=>t!==team):prev.length<32?[...prev,team]:prev)} style={{
            display:"flex", alignItems:"center", gap:5,
            background:sel?"rgba(33,150,243,0.16)":"rgba(255,255,255,0.04)",
            border:sel?"1px solid rgba(33,150,243,0.45)":`1px solid ${BORDER}`,
            borderRadius:6, padding:"4px 9px", cursor:"pointer",
            color:sel?"#64b5f6":"#555", fontWeight:sel?700:400, fontSize:11
          }}><Dot team={team} size={7}/>{team}</button>;
        })}
      </div>
      {r32.length!==32&&<div style={{ color:"#444", fontSize:10, marginTop:8 }}>Select exactly 32 teams ({r32.length} selected)</div>}
    </div>

    <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:10, padding:"14px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div style={{ color:"#aaa", fontWeight:700, fontSize:12 }}>
          Actual Final Four <span style={{ color:ff.length===4?"#4caf50":"#777" }}>({ff.length}/4)</span>
        </div>
        <Btn onClick={() => save(3)} bg="#9c27b0" color="#fff"
          disabled={ff.length!==4||saving} style={{ padding:"6px 12px", fontSize:11 }}>
          {saving?"Saving...":"Save Final 4"}
        </Btn>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
        {ALL_TEAMS.map(team => {
          const sel = ff.includes(team);
          return <button key={team} onClick={() => setFF(prev => sel?prev.filter(t=>t!==team):prev.length<4?[...prev,team]:prev)} style={{
            display:"flex", alignItems:"center", gap:5,
            background:sel?"rgba(156,39,176,0.16)":"rgba(255,255,255,0.04)",
            border:sel?"1px solid rgba(156,39,176,0.45)":`1px solid ${BORDER}`,
            borderRadius:6, padding:"4px 9px", cursor:"pointer",
            color:sel?"#ce93d8":"#555", fontWeight:sel?700:400, fontSize:11
          }}><Dot team={team} size={7}/>{team}</button>;
        })}
      </div>
      {ff.length!==4&&<div style={{ color:"#444", fontSize:10, marginTop:8 }}>Select exactly 4 teams ({ff.length} selected)</div>}
    </div>
  </div>;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen,setScreen]     = useState("login");
  const [nameInput,setNameInput] = useState("");
  const [name,setName]         = useState("");
  const [tab,setTab]           = useState("groups");
  const [saving,setSaving]     = useState(false);
  const [saved,setSaved]       = useState(false);
  const [loading,setLoading]   = useState(false);
  const [entries,setEntries]   = useState([]);
  const [phase,setPhase]       = useState(1);
  const [actualAdvancers,setActualAdvancers] = useState(null);
  const [actualFF,setActualFF] = useState(null);
  const [picks,setPicks]       = useState({ groups:{}, knockout:{}, finalFour:{} });

  const loadAdmin = useCallback(async () => {
    const s = await getAdminState();
    if (s) {
      if (s.phase)           setPhase(s.phase);
      if (s.actualAdvancers) setActualAdvancers(s.actualAdvancers);
      if (s.actualFF)        setActualFF(s.actualFF);
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setEntries(await loadAllEntries());
  }, []);

  useEffect(() => { if(screen==="app") { loadAdmin(); loadLeaderboard(); } }, [screen,loadAdmin,loadLeaderboard]);
  useEffect(() => { if(tab==="leaderboard") { loadAdmin(); loadLeaderboard(); } }, [tab,loadAdmin,loadLeaderboard]);

  const handleLogin = async () => {
    if (!nameInput.trim()) return;
    setLoading(true);
    const n = nameInput.trim();
    const existing = await loadMyEntry(n);
    if (existing?.picks) setPicks(existing.picks);
    await loadAdmin();
    setName(n); setScreen("app"); setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await saveEntry(name, picks);
    await loadLeaderboard();
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleAdminUpdate = ({ phase:p, actualAdvancers:a, actualFF:f }) => {
    if (p != null) setPhase(p);
    if (a != null) setActualAdvancers(a);
    if (f != null) setActualFF(f);
  };

  const { total } = calcScore(picks, actualAdvancers, actualFF);
  const groupsDone = GROUPS.filter(g => g.teams.every(t => picks.groups[t])).length;

  // ── LOGIN ──
  if (screen==="login") return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(135deg,${DARK},#0d1b2a)`,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${BORDER}`,
        borderRadius:16, padding:"36px 30px", maxWidth:380, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:38, marginBottom:6 }}>🏆</div>
        <div style={{ fontSize:22, fontWeight:900, color:GOLD, marginBottom:2 }}>World Cup 2026</div>
        <div style={{ fontSize:13, color:"#555", marginBottom:8 }}>Fantasy Prediction League</div>
        <div style={{ background:"rgba(76,175,80,0.1)", border:"1px solid rgba(76,175,80,0.3)",
          borderRadius:7, padding:"6px 12px", marginBottom:22, fontSize:11, color:"#4caf50" }}>
          ✅ All 48 teams confirmed
        </div>
        <div style={{ fontSize:11, color:"#777", marginBottom:7, textAlign:"left" }}>Your name</div>
        <input value={nameInput} onChange={e=>setNameInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&handleLogin()}
          placeholder="Enter your name..."
          style={{ width:"100%", padding:"11px 13px", borderRadius:8, border:`1px solid ${BORDER}`,
            background:"rgba(255,255,255,0.07)", color:"#fff", fontSize:14,
            outline:"none", boxSizing:"border-box", marginBottom:12 }}/>
        <Btn onClick={handleLogin} disabled={loading||!nameInput.trim()} style={{ width:"100%" }}>
          {loading ? "Loading..." : "Enter →"}
        </Btn>
        <div style={{ color:"#333", fontSize:10, marginTop:14, lineHeight:1.5 }}>
          Picks are shared with the group · Return with the same name to edit yours
        </div>
      </div>
    </div>
  );

  // ── MAIN ──
  const tabs = [
    { key:"groups",     label:`Groups ${groupsDone===12?"✓":"("+groupsDone+"/12)"}` },
    { key:"knockout",   label:`Knockout${phase<2?" 🔒":""}` },
    { key:"finalfour",  label:`Final 4${phase<3?" 🔒":""}` },
    { key:"leaderboard",label:`🏅 (${entries.length})` },
    { key:"admin",      label:"⚙️" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(135deg,${DARK},#0d1b2a)`,
      fontFamily:"'Segoe UI',Arial,sans-serif", color:"#fff" }}>

      <div style={{ background:"linear-gradient(135deg,#1a1a2e,#0f3460)", borderBottom:`2px solid ${GOLD}`, padding:"13px 18px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
          <div>
            <div style={{ fontWeight:900, fontSize:17 }}>🏆 <span style={{ color:GOLD }}>WC2026 Fantasy</span></div>
            <div style={{ color:"#555", fontSize:11 }}>
              <span style={{ color:GOLD }}>{name}</span> ·{" "}
              <span style={{ color:["","#4caf50","#2196f3","#9c27b0"][phase] }}>
                {["","Phase 1: Groups","Phase 2: Knockout","Phase 3: Final Four"][phase]}
              </span>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:19, fontWeight:900, color:GOLD }}>{total}</div>
              <div style={{ fontSize:9, color:"#444", textTransform:"uppercase" }}>pts</div>
            </div>
            <Btn onClick={handleSave} disabled={saving}
              bg={saved?"#4caf50":GOLD} color={saved?"#fff":"#000"}>
              {saving?"Saving...":saved?"✓ Saved!":"Save Picks"}
            </Btn>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"16px" }}>
        <TabBar tabs={tabs} active={tab} onChange={setTab}/>
        <div style={{ marginTop:16 }}>

          {tab==="groups" && <>
            <ConfChart/>
            <GroupPicker picks={picks.groups} onChange={g => setPicks(p=>({...p,groups:g}))}/>
          </>}

          {tab==="knockout" && (phase<2
            ? <PhaseGate label="Knockout Stage Locked"
                description="The admin will unlock this once group stage results are in." />
            : <KnockoutPicker actualAdvancers={actualAdvancers}
                koPicks={picks.knockout} onChange={ko => setPicks(p=>({...p,knockout:ko}))}/>
          )}

          {tab==="finalfour" && (phase<3
            ? <PhaseGate label="Final Four Locked"
                description="The admin will unlock this once the four semifinalists are confirmed." />
            : <FinalFourPicker actualFF={actualFF}
                ffPicks={picks.finalFour} onChange={ff => setPicks(p=>({...p,finalFour:ff}))}/>
          )}

          {tab==="leaderboard" && (
            <Leaderboard entries={entries} myName={name}
              actualAdvancers={actualAdvancers} actualFF={actualFF}/>
          )}

          {tab==="admin" && (
            <AdminPanel phase={phase} actualAdvancers={actualAdvancers}
              actualFF={actualFF} onUpdate={handleAdminUpdate}/>
          )}

        </div>

        {tab!=="leaderboard"&&tab!=="admin"&&(
          <div style={{ marginTop:22, display:"flex", justifyContent:"center" }}>
            <Btn onClick={handleSave} disabled={saving}
              bg={saved?"#4caf50":GOLD} color={saved?"#fff":"#000"} style={{ minWidth:160 }}>
              {saving?"Saving...":saved?"✓ Saved!":"💾 Save My Picks"}
            </Btn>
          </div>
        )}

        <div style={{ textAlign:"center", marginTop:18, color:"#1a1a1a", fontSize:10 }}>
          June 11 – July 19, 2026 · USA · Canada · Mexico
        </div>
      </div>
    </div>
  );
}
