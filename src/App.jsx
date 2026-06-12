import { useState, useEffect, useCallback } from "react";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SUPABASE_URL  = "https://wapvjbfuwbcxgowhzsbd.supabase.co";
const SUPABASE_KEY  = "sb_publishable_bMKF8MRT-hdsDz-GL0CnPA_H1s_gpSk";

const sb = (path, opts = {}) => {
  const isWrite = opts.method && opts.method !== "GET";
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(isWrite ? { Prefer: "return=representation" } : {}),
    },
    ...opts,
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) { console.error("Supabase error:", r.status, data); return null; }
    return data;
  });
};

// ─── STORAGE ──────────────────────────────────────────────────────────────────

async function saveEntry(name, pin, picks) {
  // Check lock state before saving — enforce at request time
  const adminState = await getFullAdminState();
  if (adminState?.locks?.groups) {
    // If locked, only allow saving knockout/finalFour picks, not groups
    const existing = await loadMyEntry(name);
    if (existing) {
      // Preserve their original group picks — don't overwrite
      picks = { ...picks, groups: existing.data?.groups || picks.groups };
    }
  }
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

async function loadAllEntriesWithPins() {
  const rows = await sb("picks?select=name,pin,data");
  return Array.isArray(rows) ? rows.map(r => ({ name: r.name, pin: r.pin, picks: r.data })) : [];
}

async function loadMyEntry(name) {
  const rows = await sb(`picks?name=eq.${encodeURIComponent(name)}&select=name,pin,data`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function getFullAdminState() {
  const rows = await sb("admin_state?id=eq.1&select=phase,actual_ff,live_standings,locks,bracket,bets");
  if (!rows || !Array.isArray(rows) || !rows[0]) return null;
  return {
    phase:         rows[0].phase,
    actualFF:      rows[0].actual_ff,
    liveStandings: rows[0].live_standings,
    locks:         rows[0].locks || { groups: false, knockout: false },
    bracket:       rows[0].bracket || null,
    bets:          rows[0].bets || [],
  };
}

async function patchAdminState(updates) {
  // Map camelCase to snake_case for DB
  const dbMap = {
    phase:         "phase",
    actualFF:      "actual_ff",
    liveStandings: "live_standings",
    locks:         "locks",
    bracket:       "bracket",
  };
  const body = {};
  Object.entries(updates).forEach(([k, v]) => { if (dbMap[k]) body[dbMap[k]] = v; });
  await sb("admin_state?id=eq.1", {
    method: "PATCH",
    body: JSON.stringify(body),
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
  { id:"A", teams:["Mexico",      "South Korea",  "South Africa", "Czechia"] },
  { id:"B", teams:["Canada",      "Switzerland",  "Qatar",        "Bosnia & Herzegovina"] },
  { id:"C", teams:["Brazil",      "Morocco",      "Scotland",     "Haiti"] },
  { id:"D", teams:["USA",         "Paraguay",     "Australia",    "Turkey"] },
  { id:"E", teams:["Germany",     "Ecuador",      "Ivory Coast",  "Curaçao"] },
  { id:"F", teams:["Netherlands", "Japan",        "Tunisia",      "Sweden"] },
  { id:"G", teams:["Belgium",     "Iran",         "Egypt",        "New Zealand"] },
  { id:"H", teams:["Spain",       "Uruguay",      "Saudi Arabia", "Cape Verde"] },
  { id:"I", teams:["France",      "Senegal",      "Norway",       "Iraq"] },
  { id:"J", teams:["Argentina",   "Austria",      "Algeria",      "Jordan"] },
  { id:"K", teams:["Portugal",    "Colombia",     "Uzbekistan",   "DR Congo"] },
  { id:"L", teams:["England",     "Croatia",      "Panama",       "Ghana"] },
];

const ALL_TEAMS = GROUPS.flatMap(g => g.teams);

const CONFEDERATION = {
  Mexico:"CONCACAF",Canada:"CONCACAF",USA:"CONCACAF",Panama:"CONCACAF",Haiti:"CONCACAF","Curaçao":"CONCACAF",
  England:"UEFA",France:"UEFA",Germany:"UEFA",Spain:"UEFA",Portugal:"UEFA",Netherlands:"UEFA",
  Belgium:"UEFA",Croatia:"UEFA",Switzerland:"UEFA",Scotland:"UEFA",Norway:"UEFA",Austria:"UEFA",
  Sweden:"UEFA",Turkey:"UEFA",Czechia:"UEFA","Bosnia & Herzegovina":"UEFA",
  Brazil:"CONMEBOL",Argentina:"CONMEBOL",Uruguay:"CONMEBOL",Colombia:"CONMEBOL",Ecuador:"CONMEBOL",Paraguay:"CONMEBOL",
  Morocco:"CAF",Senegal:"CAF",Egypt:"CAF","Ivory Coast":"CAF","South Africa":"CAF",
  Algeria:"CAF",Tunisia:"CAF",Ghana:"CAF","Cape Verde":"CAF","DR Congo":"CAF",
  Japan:"AFC","South Korea":"AFC","Saudi Arabia":"AFC",Australia:"AFC",Iran:"AFC",
  Qatar:"AFC",Jordan:"AFC",Uzbekistan:"AFC",Iraq:"AFC",
  "New Zealand":"OFC",
};

const TEAM_COLORS = {
  Mexico:"#006847",Canada:"#FF0000",USA:"#002868",Panama:"#005293",Haiti:"#00209F","Curaçao":"#003DA5",
  England:"#012169",France:"#002395",Germany:"#3a3a3a",Spain:"#c60b1e",Portugal:"#006600",
  Netherlands:"#FF4F00",Belgium:"#EF3340",Croatia:"#cc0000",Switzerland:"#cc0000",Scotland:"#003F87",
  Norway:"#EF2B2D",Austria:"#ED2939",Sweden:"#006AA7",Turkey:"#E30A17",Czechia:"#cc0000",
  "Bosnia & Herzegovina":"#002395",
  Brazil:"#009C3B",Argentina:"#74ACDF",Uruguay:"#5EB6E4",Colombia:"#FCD116",Ecuador:"#FFD100",Paraguay:"#D52B1E",
  Morocco:"#006233",Senegal:"#00853F",Egypt:"#C8102E","Ivory Coast":"#F77F00","South Africa":"#007A4D",
  Algeria:"#006233",Tunisia:"#E70013",Ghana:"#006B3F","Cape Verde":"#003893","DR Congo":"#007FFF",
  Japan:"#BC002D","South Korea":"#CD2E3A","Saudi Arabia":"#006C35",Australia:"#FFCD00",Iran:"#239F40",
  Qatar:"#8D1B3D",Jordan:"#007A3D",Uzbekistan:"#1EB53A",Iraq:"#CC0000","New Zealand":"#3a3a3a",
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

const BRACKET_ROUNDS = [
  { key:"r32",   label:"Round of 32",  pts:3,  matches:16 },
  { key:"r16",   label:"Round of 16",  pts:5,  matches:8  },
  { key:"qf",    label:"Quarterfinal", pts:8,  matches:4  },
  { key:"sf",    label:"Semifinal",    pts:12, matches:2  },
  { key:"final", label:"Final",        pts:15, matches:1  },
];

const ADMIN_PASS = "worldcup2026";
const MASTER_PIN = "2026";

// ─── THEME ────────────────────────────────────────────────────────────────────
const G2="#005a2b", G4="#00a651";
const WHT="#ffffff", GLD="#FFD700";
const CARD="rgba(0,90,43,0.45)", BORDER="rgba(255,255,255,0.15)", DBORDER="rgba(0,0,0,0.3)";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Given a bracket, derive the winner's path for a given team
function TeamJourney({ team, bracket, inline }) {
  const rounds = ["r32","r16","qf","sf","final"];
  const steps = [];
  rounds.forEach(rk => {
    const matches = bracket?.[rk] || [];
    matches.forEach(m => {
      if (m.teamA === team || m.teamB === team) {
        const opp = m.teamA === team ? m.teamB : m.teamA;
        steps.push({ round: BRACKET_ROUNDS.find(r=>r.key===rk)?.label, opp, won: m.winner===team, result: m.winner });
      }
    });
  });
  if (!steps.length) return null;
  if (inline) return <span style={{ fontSize:9, color:"rgba(255,255,255,0.3)" }}>
    {steps.filter(s=>s.result).map((s,i)=><span key={i} style={{ marginRight:4, color:s.won?"#a5d6a7":"#ff8a80" }}>
      {s.won?"✓":"✗"}{s.opp?` ${s.opp}`:""}
    </span>)}
  </span>;
  return (
    <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", marginTop:4 }}>
      {steps.map((s,i) => (
        <span key={i} style={{ marginRight:8 }}>
          <span style={{ color:s.won?"#a5d6a7":s.result&&!s.won?"#ff8a80":"rgba(255,255,255,0.4)" }}>
            {s.won?"✓":s.result&&!s.won?"✗":"·"}
          </span>
          {" "}{s.round}{s.opp?` vs ${s.opp}`:""}
        </span>
      ))}
    </div>
  );
}

// Get the two semifinal matchups from bracket
function getSemifinalists(bracket) {
  const sfs = bracket?.sf || [];
  return sfs.length >= 2 ? sfs : null;
}

// Propagate winners through bracket rounds
function propagateBracket(bracketIn) {
  const b = JSON.parse(JSON.stringify(bracketIn));
  const rounds = ["r32","r16","qf","sf","final"];
  for (let ri = 0; ri < rounds.length - 1; ri++) {
    const cur = b[rounds[ri]] || [];
    const next = b[rounds[ri+1]] || Array(Math.ceil(cur.length/2)).fill(null).map(()=>({teamA:"",teamB:"",winner:null}));
    for (let i = 0; i < cur.length; i++) {
      const nm = Math.floor(i/2);
      if (!next[nm]) next[nm] = { teamA:"", teamB:"", winner:null };
      if (cur[i]?.winner) {
        if (i % 2 === 0) next[nm].teamA = cur[i].winner;
        else             next[nm].teamB = cur[i].winner;
      }
    }
    b[rounds[ri+1]] = next;
  }
  return b;
}

// Score calculation
function calcLiveGroupScore(groupPicks, liveStandings) {
  if (!liveStandings || !Object.keys(liveStandings).length) return null;
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

function calcBracketScore(bracketPicks, bracket) {
  let earned = 0, max = 0;
  if (!bracket || !bracketPicks) return { earned, max };
  BRACKET_ROUNDS.forEach(round => {
    const matches = bracket[round.key] || [];
    const picks   = bracketPicks[round.key] || {};
    matches.forEach((match, i) => {
      if (picks[i] != null) {
        max += round.pts;
        if (match.winner) {
          if (picks[i] === match.winner) earned += round.pts;
        } else {
          earned += round.pts; // potential
        }
      }
    });
  });
  return { earned, max };
}

function calcScore(picks, actualFF, liveStandings, bracket) {
  const liveG = calcLiveGroupScore(picks.groups, liveStandings);
  const maxG  = calcMaxGroupScore(picks.groups);
  const g = liveG !== null ? liveG : maxG;
  const { earned: k } = calcBracketScore(picks.bracket, bracket);

  // Final Four scoring — new format: sf1winner, sf2winner, champion, third
  let f = 0;
  const ff = picks.finalFour || {};
  const sfs = bracket?.sf || [];
  const sf1Winner = sfs[0]?.winner || null;
  const sf2Winner = sfs[1]?.winner || null;
  const sf1Loser  = sfs[0]?.winner ? (sfs[0].teamA===sfs[0].winner?sfs[0].teamB:sfs[0].teamA) : null;
  const sf2Loser  = sfs[1]?.winner ? (sfs[1].teamA===sfs[1].winner?sfs[1].teamB:sfs[1].teamA) : null;
  const finalWinner = bracket?.final?.[0]?.winner || null;
  const consWinner  = bracket?.consolation?.[0]?.winner || null;
  const consLoser   = consWinner ? (bracket?.consolation?.[0]?.teamA===consWinner?bracket?.consolation?.[0]?.teamB:bracket?.consolation?.[0]?.teamA) : null;

  // SF picks (12pts each)
  if (sf1Winner && ff.sf1winner === sf1Winner) f += 12;
  else if (!sf1Winner && ff.sf1winner) f += 12; // potential
  if (sf2Winner && ff.sf2winner === sf2Winner) f += 12;
  else if (!sf2Winner && ff.sf2winner) f += 12;

  // Champion (15pts)
  if (finalWinner && ff.champion === finalWinner) f += 15;
  else if (!finalWinner && ff.champion) f += 15;

  // 3rd place (12pts)
  if (consWinner && ff.third === consWinner) f += 12;
  else if (!consWinner && ff.third) f += 12;

  // 4th place (5pts) — auto derived
  const playerFourth = ff.third ? (ff.third===(sf1Loser||"") ? sf2Loser : sf1Loser) : null;
  if (consLoser && playerFourth === consLoser) f += 5;
  else if (!consLoser && playerFourth) f += 5;

  return { g, maxG, liveG, k, f, total: g + k + f };
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
  const c = CONFEDERATION[team]; const s = CONF_STYLE[c]||{bg:"#333",text:"#fff"};
  return <span style={{ fontSize:8, fontWeight:700, background:s.bg, color:s.text,
    padding:"1px 4px", borderRadius:3, flexShrink:0 }}>{c}</span>;
}

function Btn({ children, onClick, bg=G4, color=WHT, style={}, disabled=false }) {
  return <button onClick={onClick} disabled={disabled} style={{
    background:disabled?"rgba(255,255,255,0.08)":bg,
    color:disabled?"rgba(255,255,255,0.25)":color,
    border:"none", borderRadius:8, padding:"10px 20px", fontWeight:800,
    fontSize:13, cursor:disabled?"default":"pointer",
    transition:"all 0.2s", fontFamily:"inherit", ...style
  }}>{children}</button>;
}

function InfoBox({ children, color=G4 }) {
  return <div style={{ background:"rgba(0,166,81,0.1)", border:`1px solid ${color}55`,
    borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:11,
    color:"#e8f5e9", lineHeight:1.6 }}>{children}</div>;
}

function PhaseGate({ label, desc }) {
  return <div style={{ textAlign:"center", padding:"56px 20px", color:"rgba(255,255,255,0.3)" }}>
    <div style={{ fontSize:36, marginBottom:10 }}>🔒</div>
    <div style={{ fontSize:15, fontWeight:700, color:"rgba(255,255,255,0.4)", marginBottom:6 }}>{label}</div>
    <div style={{ fontSize:12 }}>{desc}</div>
  </div>;
}

function LockedBanner() {
  return <div style={{ background:"rgba(220,50,50,0.12)", border:"1px solid rgba(220,50,50,0.3)",
    borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:12,
    color:"#ff8a80", textAlign:"center", fontWeight:700 }}>
    🔒 Picks are locked — the tournament has started
  </div>;
}

function SectionTitle({ children }) {
  return <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase",
    letterSpacing:"1px", color:G4, marginBottom:10 }}>{children}</div>;
}

function TabBar({ tabs, active, onChange }) {
  return <div style={{ display:"flex", gap:3, background:"rgba(0,0,0,0.3)", borderRadius:10, padding:4, flexWrap:"wrap" }}>
    {tabs.map(t => <button key={t.key} onClick={()=>onChange(t.key)} style={{
      flex:1, minWidth:60, padding:"9px 4px", borderRadius:7, border:"none",
      background:active===t.key?G4:"transparent",
      color:active===t.key?WHT:"rgba(255,255,255,0.5)",
      fontWeight:800, fontSize:11, cursor:"pointer", transition:"all 0.2s",
      whiteSpace:"nowrap", fontFamily:"inherit"
    }}>{t.label}</button>)}
  </div>;
}

// ─── CONF CHART ───────────────────────────────────────────────────────────────

function ConfChart() {
  return <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:"14px 18px", marginBottom:16 }}>
    <SectionTitle>🌍 All 48 Teams by Confederation</SectionTitle>
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {Object.entries(CONF_COUNTS).map(([conf,count]) => {
        const s = CONF_STYLE[conf];
        return <div key={conf} style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:76, fontSize:9, fontWeight:700, background:s.bg, color:s.text,
            padding:"2px 6px", borderRadius:4, textAlign:"center", flexShrink:0 }}>{conf}</div>
          <div style={{ flex:1, background:"rgba(0,0,0,0.25)", borderRadius:6, height:18, overflow:"hidden" }}>
            <div style={{ width:`${(count/16)*100}%`, background:s.bg, height:"100%", borderRadius:6,
              display:"flex", alignItems:"center", justifyContent:"flex-end", paddingRight:6 }}>
              <span style={{ fontSize:10, fontWeight:800, color:s.text }}>{count}</span>
            </div>
          </div>
          <div style={{ color:"rgba(255,255,255,0.4)", fontSize:10, width:28, textAlign:"right" }}>
            {Math.round((count/48)*100)}%
          </div>
        </div>;
      })}
    </div>
    <div style={{ marginTop:10, color:G4, fontSize:10, textAlign:"center", fontWeight:700 }}>
      ✅ All 48 teams confirmed · Group stage begins June 11, 2026
    </div>
  </div>;
}

// ─── GROUP PICKER ─────────────────────────────────────────────────────────────

function GroupPicker({ picks, onChange, liveStandings, locked }) {
  const handleRank = (team, rank) => {
    if (locked) return;
    const group = GROUPS.find(g => g.teams.includes(team));
    if (!group) return;
    const next = { ...picks };
    group.teams.forEach(t => { if (next[t]===rank && t!==team) delete next[t]; });
    if (next[team]===rank) delete next[team]; else next[team]=rank;
    onChange(next);
  };
  const done = GROUPS.filter(g=>g.teams.every(t=>picks[t])).length;
  const hasLive = liveStandings && Object.keys(liveStandings).length>0;

  return <div>
    {locked && <LockedBanner/>}
    {hasLive && !locked && <InfoBox>
      <strong style={{ color:G4 }}>🔴 Live Standings Active</strong> — Green = prediction matches current real standing. Updates after each matchday.
    </InfoBox>}
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
      <div style={{ color:"rgba(255,255,255,0.6)", fontSize:12 }}>Rank each team 1st–4th in their group</div>
      <div style={{ color:done===12?G4:WHT, fontWeight:800, fontSize:13,
        background:done===12?"rgba(0,166,81,0.2)":"rgba(255,255,255,0.1)",
        padding:"4px 10px", borderRadius:20 }}>{done}/12 done</div>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(265px,1fr))", gap:12 }}>
      {GROUPS.map(group => {
        const filled = group.teams.filter(t=>picks[t]).length;
        return <div key={group.id} style={{ background:CARD, border:`1px solid ${BORDER}`,
          borderRadius:10, overflow:"hidden", boxShadow:"0 4px 12px rgba(0,0,0,0.3)" }}>
          <div style={{ background:`linear-gradient(135deg,${G2},#003d1a)`, padding:"8px 12px",
            display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:`1px solid ${BORDER}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ background:WHT, color:G2, width:26, height:26, borderRadius:"50%",
                display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:13 }}>{group.id}</div>
              <span style={{ color:"rgba(255,255,255,0.6)", fontSize:11 }}>{filled}/4 ranked</span>
            </div>
            {filled===4 && <span style={{ color:G4, fontSize:12, fontWeight:700 }}>✓</span>}
          </div>
          <div style={{ padding:"8px 10px", display:"flex", flexDirection:"column", gap:5 }}>
            {group.teams.map(team => {
              const rank=picks[team], liveRank=liveStandings?.[team];
              const isCorrect=rank&&liveRank&&rank===liveRank;
              const isWrong=rank&&liveRank&&rank!==liveRank;
              return <div key={team} style={{
                display:"flex", alignItems:"center", gap:7,
                background:isCorrect?"rgba(0,166,81,0.18)":isWrong?"rgba(220,50,50,0.1)":rank?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.2)",
                border:isCorrect?"1px solid rgba(0,166,81,0.5)":isWrong?"1px solid rgba(220,50,50,0.3)":rank?`1px solid ${BORDER}`:`1px solid ${DBORDER}`,
                borderRadius:7, padding:"7px 9px"
              }}>
                <Dot team={team}/>
                <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:2 }}>
                  <span style={{ fontSize:12, color:WHT, fontWeight:600,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{team}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <ConfBadge team={team}/>
                    {liveRank&&<span style={{ fontSize:8, color:"rgba(255,255,255,0.4)" }}>actual: #{liveRank}</span>}
                  </div>
                </div>
                <div style={{ display:"flex", gap:3 }}>
                  {[1,2,3,4].map(r=><button key={r} onClick={()=>handleRank(team,r)} disabled={locked} style={{
                    width:24, height:24, borderRadius:5, border:"none",
                    cursor:locked?"default":"pointer",
                    background:rank===r?(r<=2?G4:r===3?"#7c6fc4":"#666"):"rgba(0,0,0,0.3)",
                    color:rank===r?WHT:"rgba(255,255,255,0.4)",
                    fontSize:11, fontWeight:800, fontFamily:"inherit"
                  }}>{r}</button>)}
                </div>
                {rank&&<span style={{ background:isCorrect?G4:"rgba(255,255,255,0.15)",
                  color:isCorrect?WHT:"rgba(255,255,255,0.7)",
                  borderRadius:5, padding:"2px 6px", fontSize:10, fontWeight:800, flexShrink:0 }}>
                  {isCorrect?"✓ ":""} +{GROUP_POINTS[rank]}
                </span>}
              </div>;
            })}
          </div>
        </div>;
      })}
    </div>
  </div>;
}

// ─── BRACKET MATCH CARD (compact) ────────────────────────────────────────────

function BracketMatchCard({ teamA, teamB, userPick, onPick, locked, actualWinner, roundPts, readOnly }) {
  const teamRow = (team) => {
    if (!team) return (
      <div style={{ padding:"6px 8px", color:"rgba(255,255,255,0.2)", fontSize:10, fontStyle:"italic" }}>TBD</div>
    );
    const isPick     = userPick === team;
    const isCorrect  = isPick && actualWinner && actualWinner === team;
    const isWrong    = isPick && actualWinner && actualWinner !== team;
    const isActual   = actualWinner === team;
    const canClick   = !locked && !readOnly && teamA && teamB && !actualWinner;

    return (
      <div onClick={()=>{ if(canClick) onPick(team); }}
        style={{
          display:"flex", alignItems:"center", gap:5, padding:"6px 8px",
          cursor: canClick ? "pointer" : "default",
          background: isCorrect?"rgba(0,166,81,0.25)":isWrong?"rgba(220,50,50,0.15)":isPick?"rgba(255,255,255,0.1)":"transparent",
          borderLeft: isPick ? "3px solid " + (isCorrect?G4:isWrong?"#ff5252":G4) : "3px solid transparent",
          transition:"background 0.15s",
        }}>
        <Dot team={team} size={7}/>
        <span style={{ flex:1, fontSize:11, fontWeight:isPick?700:400,
          color: isActual&&actualWinner?GLD : isWrong?"rgba(255,255,255,0.3)":WHT,
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          maxWidth:100 }}>{team}</span>
        {isCorrect && <span style={{ fontSize:9, color:G4, fontWeight:800, flexShrink:0 }}>✓+{roundPts}</span>}
        {isWrong   && <span style={{ fontSize:9, color:"#ff5252", flexShrink:0 }}>✗</span>}
        {isActual && !isPick && <span style={{ fontSize:9, flexShrink:0 }}>🏆</span>}
      </div>
    );
  };

  return (
    <div style={{ background:CARD, border:"1px solid " + BORDER, borderRadius:8, overflow:"hidden", width:160 }}>
      {teamRow(teamA)}
      <div style={{ height:1, background:BORDER }}/>
      {teamRow(teamB)}
    </div>
  );
}

// ─── BRACKET VIEW ─────────────────────────────────────────────────────────────

function BracketView({ bracket, bracketPicks, onPick, locked, readOnly, actualBracket }) {
  // bracketPicks: { r32: {0: "France", 1: "USA", ...}, r16: {...}, ... }
  // bracket: the real bracket with actual matchups and winners (from admin)
  // When picking, later rounds are derived from the player's own picks

  if (!bracket?.r32?.length) {
    return <PhaseGate label="Bracket Not Set Yet"
      desc="The admin will enter all Round of 32 matchups once the group stage is complete."/>;
  }

  // Build the player's full bracket view by cascading their picks
  // For each round, teamA/teamB come from the player's picks in the previous round
  const getPlayerBracket = () => {
    const pb = {};
    BRACKET_ROUNDS.forEach((round, ri) => {
      if (ri === 0) {
        // R32: use real matchups from admin bracket
        pb[round.key] = (bracket[round.key]||[]).map(m => ({
          teamA: m.teamA, teamB: m.teamB,
          winner: actualBracket?.[round.key]?.find?.((_, i) => i === (bracket[round.key]||[]).indexOf(m))?.winner || null
        }));
      } else {
        const prevRound = BRACKET_ROUNDS[ri-1];
        const prevPicks = bracketPicks?.[prevRound.key] || {};
        const prevMatches = pb[prevRound.key] || [];
        const matches = [];
        for (let i = 0; i < prevMatches.length; i += 2) {
          const winnerA = prevPicks[i] || null;
          const winnerB = prevPicks[i+1] || null;
          const actualW = actualBracket?.[round.key]?.[Math.floor(i/2)]?.winner || null;
          matches.push({ teamA: winnerA, teamB: winnerB, winner: actualW });
        }
        pb[round.key] = matches;
      }
    });
    return pb;
  };

  const playerBracket = getPlayerBracket();

  const handlePick = (roundKey, matchIdx, team) => {
    if (locked || readOnly) return;
    // Build new picks — if changing a pick, clear downstream picks that depended on it
    const newPicks = JSON.parse(JSON.stringify(bracketPicks || {}));
    if (!newPicks[roundKey]) newPicks[roundKey] = {};

    const oldPick = newPicks[roundKey][matchIdx];
    newPicks[roundKey][matchIdx] = team;

    // Clear downstream picks if pick changed
    if (oldPick && oldPick !== team) {
      const rounds = ["r32","r16","qf","sf","final"];
      let needsClear = false;
      rounds.forEach((rk, ri) => {
        if (rk === roundKey) { needsClear = true; return; }
        if (needsClear && newPicks[rk]) {
          // Clear the downstream match that this pick feeds into
          const prevRoundIdx = rounds.indexOf(rk) - 1;
          if (prevRoundIdx >= 0) {
            delete newPicks[rk]; // simplest: clear all downstream for this branch
          }
        }
      });
    }

    onPick(newPicks);
  };

  return (
    <div>
      {locked && <LockedBanner/>}
      {!locked && !readOnly && (
        <InfoBox>
          <strong style={{ color:G4 }}>Pick your full bracket</strong> — Click a team to pick them as the winner.
          Your picks cascade forward — the team you pick advances to the next round.
          Pick all rounds at once, then save. Points: R32=3 · R16=5 · QF=8 · SF=12 · Final=15
        </InfoBox>
      )}

      <div style={{ overflowX:"auto", paddingBottom:16, WebkitOverflowScrolling:"touch" }}>
        <div style={{ display:"flex", gap:8, minWidth:"max-content", alignItems:"flex-start", paddingBottom:4 }}>
          {BRACKET_ROUNDS.map((round, ri) => {
            const matches = playerBracket[round.key] || [];
            const picks   = bracketPicks?.[round.key] || {};
            // Vertical spacing doubles each round to visually align brackets
            const gap = Math.pow(2, ri) * 14 + (ri > 0 ? 14 : 0);

            return (
              <div key={round.key} style={{ display:"flex", flexDirection:"column", minWidth:168 }}>
                {/* Round header */}
                <div style={{ background:G2, borderRadius:6, padding:"4px 8px", textAlign:"center",
                  color:WHT, fontWeight:800, fontSize:10, marginBottom:8, flexShrink:0 }}>
                  {round.label}
                  <span style={{ color:"rgba(255,255,255,0.4)", fontSize:9, marginLeft:4 }}>+{round.pts}</span>
                </div>
                {/* Matches */}
                <div style={{ display:"flex", flexDirection:"column", gap:gap }}>
                  {matches.map((match, mi) => (
                    <BracketMatchCard
                      key={mi}
                      teamA={match.teamA}
                      teamB={match.teamB}
                      userPick={picks[mi]}
                      actualWinner={match.winner}
                      roundPts={round.pts}
                      locked={locked}
                      readOnly={readOnly}
                      onPick={(team) => handlePick(round.key, mi, team)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── FINAL FOUR PICKER ────────────────────────────────────────────────────────

function FinalFourPicker({ actualFF, ffPicks, onChange, locked, bracket, actualBracket }) {
  // actualFF: array of 4 team names (the real semifinalists)
  // ffPicks: { sf1winner, sf2winner, champion, third }
  const pool = actualFF || [];
  const sfs  = bracket?.sf || actualBracket?.sf || [];

  // Derive the two SF matchups
  const sf1 = sfs[0] || {};
  const sf2 = sfs[1] || {};

  // Player's picks
  const sf1Pick    = ffPicks?.sf1winner || null;
  const sf2Pick    = ffPicks?.sf2winner || null;
  const champPick  = ffPicks?.champion  || null;
  const thirdPick  = ffPicks?.third     || null;

  // Real results from actual bracket
  const sf1Winner  = sf1.winner || null;
  const sf2Winner  = sf2.winner || null;
  const sf1Loser   = sf1Winner ? (sf1.teamA===sf1Winner?sf1.teamB:sf1.teamA) : null;
  const sf2Loser   = sf2Winner ? (sf2.teamA===sf2Winner?sf2.teamB:sf2.teamA) : null;
  const finalMatch = actualBracket?.final?.[0] || {};
  const consMatch  = { teamA: sf1Loser, teamB: sf2Loser, winner: actualBracket?.consolation?.[0]?.winner || null };

  const set = (key, team) => {
    if (locked) return;
    const next = { ...(ffPicks||{}) };
    if (next[key] === team) delete next[key]; else next[key] = team;
    onChange(next);
  };

  const PickMatch = ({ title, teamA, teamB, pickKey, actualWinner, pts, color }) => {
    const pick = ffPicks?.[pickKey];
    const isCorrectA = pick===teamA && actualWinner && actualWinner===teamA;
    const isCorrectB = pick===teamB && actualWinner && actualWinner===teamB;
    const isWrongA   = pick===teamA && actualWinner && actualWinner!==teamA;
    const isWrongB   = pick===teamB && actualWinner && actualWinner!==teamB;

    const TeamBtn = ({ team, isCorrect, isWrong }) => {
      if (!team) return <div style={{ flex:1, padding:"10px 8px", textAlign:"center",
        color:"rgba(255,255,255,0.2)", fontSize:11, fontStyle:"italic" }}>TBD</div>;
      const isPick = pick === team;
      return (
        <button onClick={()=>set(pickKey, team)} disabled={locked||!teamA||!teamB}
          style={{
            flex:1, padding:"10px 8px", borderRadius:8, cursor:locked?"default":"pointer",
            background: isCorrect?"rgba(0,166,81,0.25)":isWrong?"rgba(220,50,50,0.15)":isPick?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.2)",
            border: "1px solid " + (isCorrect?G4:isWrong?"#ff5252":isPick?G4:BORDER),
            color: actualWinner===team?GLD:isWrong?"rgba(255,255,255,0.3)":WHT,
            fontWeight:isPick?800:400, fontSize:12, fontFamily:"inherit", transition:"all 0.15s",
            display:"flex", alignItems:"center", justifyContent:"center", gap:5
          }}>
          <Dot team={team} size={8}/>{team}
          {isCorrect && <span style={{ color:G4, fontSize:10, fontWeight:800 }}>✓+{pts}</span>}
          {isWrong   && <span style={{ color:"#ff5252", fontSize:10 }}>✗</span>}
          {actualWinner===team && !isPick && <span style={{ fontSize:10 }}>🏆</span>}
        </button>
      );
    };

    return (
      <div style={{ background:CARD, border:"1px solid " + BORDER, borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ color, fontWeight:800, fontSize:13 }}>{title}</div>
          <div style={{ background:"rgba(0,0,0,0.3)", border:"1px solid " + BORDER,
            borderRadius:20, padding:"2px 10px", color:G4, fontSize:11, fontWeight:700 }}>
            +{pts} pts
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <TeamBtn team={teamA} isCorrect={isCorrectA} isWrong={isWrongA}/>
          <div style={{ display:"flex", alignItems:"center", color:"rgba(255,255,255,0.3)", fontSize:11 }}>vs</div>
          <TeamBtn team={teamB} isCorrect={isCorrectB} isWrong={isWrongB}/>
        </div>
        {/* Team journey context */}
        {(teamA||teamB) && bracket && (
          <div style={{ marginTop:8, display:"flex", gap:12, flexWrap:"wrap" }}>
            {[teamA,teamB].filter(Boolean).map(team=>(
              <div key={team} style={{ fontSize:9, color:"rgba(255,255,255,0.3)" }}>
                <Dot team={team} size={6}/><span>{team}:</span>{" "}
                <TeamJourney team={team} bracket={actualBracket||bracket} inline/>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (pool.length === 0) {
    return <PhaseGate label="Final Four Not Yet Set"
      desc="The admin will confirm the four semifinalists once they're known."/>;
  }

  return (
    <div>
      {locked && <LockedBanner/>}
      <InfoBox>
        <strong style={{ color:G4 }}>Final Four</strong> — Pick the winner of each semifinal, then the Final and Consolation match.
        3rd place earns <strong style={{ color:WHT }}>12pts</strong> (more than 2nd's 7pts) — they must win the consolation match.
      </InfoBox>

      <SectionTitle>⚽ Semifinal 1</SectionTitle>
      <PickMatch title="Semifinal 1 — Who advances to the Final?"
        teamA={sf1.teamA} teamB={sf1.teamB} pickKey="sf1winner"
        actualWinner={sf1Winner} pts={12} color="#64b5f6"/>

      <SectionTitle>⚽ Semifinal 2</SectionTitle>
      <PickMatch title="Semifinal 2 — Who advances to the Final?"
        teamA={sf2.teamA} teamB={sf2.teamB} pickKey="sf2winner"
        actualWinner={sf2Winner} pts={12} color="#64b5f6"/>

      <SectionTitle>🏆 The Final</SectionTitle>
      <PickMatch title="Final — Who wins the World Cup?"
        teamA={sf1Pick||sf1Winner} teamB={sf2Pick||sf2Winner} pickKey="champion"
        actualWinner={finalMatch.winner} pts={15} color={GLD}/>

      <SectionTitle>🥉 Consolation Match (3rd Place)</SectionTitle>
      <PickMatch title="Consolation — Who wins 3rd place?"
        teamA={sf1Pick ? (sf1Pick===sf1.teamA?sf1.teamB:sf1.teamA) : sf1Loser}
        teamB={sf2Pick ? (sf2Pick===sf2.teamA?sf2.teamB:sf2.teamA) : sf2Loser}
        pickKey="third"
        actualWinner={consMatch.winner} pts={12} color="#b39ddb"/>

      <div style={{ background:"rgba(0,0,0,0.2)", border:"1px solid " + BORDER, borderRadius:12,
        padding:"12px 16px", marginTop:4 }}>
        <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, fontWeight:700, marginBottom:6 }}>
          4th Place — Consolation Match Loser
        </div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>
          Automatically assigned — earns <span style={{ color:G4 }}>+5pts</span> if correct
        </div>
        {(thirdPick || consMatch.winner) && (
          <div style={{ marginTop:8, display:"flex", alignItems:"center", gap:6 }}>
            <Dot team={
              consMatch.winner
                ? (consMatch.teamA===consMatch.winner?consMatch.teamB:consMatch.teamA)
                : thirdPick
                  ? (thirdPick===(sf1Pick?(sf1Pick===sf1.teamA?sf1.teamB:sf1.teamA):sf1Loser)
                    ? (sf2Pick?(sf2Pick===sf2.teamA?sf2.teamB:sf2.teamA):sf2Loser)
                    : (sf1Pick?(sf1Pick===sf1.teamA?sf1.teamB:sf1.teamA):sf1Loser))
                  : null
            } size={8}/>
            <span style={{ fontSize:12, color:"rgba(255,255,255,0.5)" }}>
              {consMatch.winner
                ? (consMatch.teamA===consMatch.winner?consMatch.teamB:consMatch.teamA)
                : "Loser of consolation match"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────

function Leaderboard({ entries, myName, actualFF, liveStandings, bracket, locks }) {
  const [selected, setSelected] = useState(null);
  const hasLive = liveStandings && Object.keys(liveStandings).length>0;
  const canViewPicks = locks?.groups || REGISTRATION_LOCKED; // picks visible once group stage is locked

  const scored = [...entries]
    .map(e => ({ ...e, score: calcScore(e.picks, actualFF, liveStandings, bracket) }))
    .sort((a,b) => b.score.total - a.score.total);

  // ── Detail view ──
  if (selected) {
    const entry = entries.find(e=>e.name===selected);
    if (!entry) { setSelected(null); return null; }
    const p = entry.picks;
    return <div>
      <button onClick={()=>setSelected(null)} style={{ background:"none", border:`1px solid ${BORDER}`,
        borderRadius:8, color:"rgba(255,255,255,0.6)", padding:"7px 14px",
        cursor:"pointer", fontSize:12, marginBottom:16, fontFamily:"inherit" }}>← Back to Leaderboard</button>
      <div style={{ color:G4, fontWeight:900, fontSize:20, marginBottom:4 }}>{entry.name}</div>
      <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11, marginBottom:20 }}>
        Total: <strong style={{ color:G4 }}>{calcScore(p, actualFF, liveStandings, bracket).total} pts</strong>
      </div>

      <SectionTitle>Group Stage Rankings</SectionTitle>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8, marginBottom:20 }}>
        {GROUPS.map(group => {
          const ranked=group.teams.map(t=>({team:t,rank:p.groups?.[t]})).filter(x=>x.rank).sort((a,b)=>a.rank-b.rank);
          const unranked=group.teams.filter(t=>!p.groups?.[t]);
          return <div key={group.id} style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:8, overflow:"hidden" }}>
            <div style={{ background:G2, padding:"5px 10px", display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ background:WHT, color:G2, width:18, height:18, borderRadius:"50%",
                display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:10 }}>{group.id}</div>
            </div>
            <div style={{ padding:"5px 8px" }}>
              {ranked.map(({ team, rank }) => {
                const liveRank=liveStandings?.[team], correct=liveRank&&liveRank===rank;
                return <div key={team} style={{ display:"flex", alignItems:"center", gap:5, padding:"2px 0" }}>
                  <span style={{ background:rank<=2?G4:rank===3?"#7c6fc4":"#555", color:WHT,
                    width:16, height:16, borderRadius:3, display:"inline-flex", alignItems:"center",
                    justifyContent:"center", fontSize:9, fontWeight:800, flexShrink:0 }}>{rank}</span>
                  <Dot team={team} size={7}/>
                  <span style={{ fontSize:11, color:correct?"#a5d6a7":WHT, flex:1,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{team}</span>
                  {correct&&<span style={{ fontSize:9, color:G4 }}>✓</span>}
                </div>;
              })}
              {unranked.map(t=><div key={t} style={{ display:"flex", alignItems:"center", gap:5, padding:"2px 0", opacity:0.3 }}>
                <span style={{ width:16, height:16, borderRadius:3, background:"rgba(255,255,255,0.1)",
                  display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:9 }}>?</span>
                <Dot team={t} size={7}/><span style={{ fontSize:11 }}>{t}</span>
              </div>)}
            </div>
          </div>;
        })}
      </div>

      {bracket?.r32?.length>0 && <>
        <SectionTitle>Knockout Bracket Picks</SectionTitle>
        <BracketView bracket={bracket} bracketPicks={p.bracket}
          onPick={()=>{}} locked={true} readOnly={true} actualBracket={bracket}/>
        <div style={{ marginBottom:20 }}/>
      </>}

      {p.finalFour && Object.keys(p.finalFour).length>0 && <>
        <SectionTitle>Final Four Picks</SectionTitle>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
          {[
            { key:"sf1winner", label:"SF1 Winner", pts:12 },
            { key:"sf2winner", label:"SF2 Winner", pts:12 },
            { key:"champion",  label:"🥇 Champion",  pts:15 },
            { key:"third",     label:"🥉 3rd Place",  pts:12 },
          ].map(({ key, label, pts }) => {
            const team = p.finalFour?.[key];
            const sfs = bracket?.sf || [];
            let actualWinner = null;
            if (key==="sf1winner") actualWinner = sfs[0]?.winner;
            if (key==="sf2winner") actualWinner = sfs[1]?.winner;
            if (key==="champion")  actualWinner = bracket?.final?.[0]?.winner;
            if (key==="third")     actualWinner = bracket?.consolation?.[0]?.winner;
            const correct = team && actualWinner && team===actualWinner;
            const wrong   = team && actualWinner && team!==actualWinner;
            return <div key={key} style={{ display:"flex", alignItems:"center", gap:10,
              background:correct?"rgba(0,166,81,0.15)":wrong?"rgba(220,50,50,0.1)":CARD,
              border:"1px solid " + (correct?G4:wrong?"rgba(220,50,50,0.4)":BORDER),
              borderRadius:8, padding:"8px 12px" }}>
              <span style={{ color:"rgba(255,255,255,0.5)", fontSize:11, width:90, flexShrink:0 }}>{label}</span>
              {team ? <>
                <Dot team={team} size={8}/>
                <span style={{ fontSize:12, color:WHT, flex:1 }}>{team}</span>
                {correct && <span style={{ fontSize:10, color:G4, fontWeight:800 }}>✓ +{pts}pts</span>}
                {wrong   && <span style={{ fontSize:10, color:"#ff5252" }}>✗</span>}
              </> : <span style={{ color:"rgba(255,255,255,0.2)", fontSize:11 }}>Not picked</span>}
            </div>;
          })}
        </div>
      </>}
    </div>;
  }

  if (!scored.length) return <div style={{ textAlign:"center", padding:"48px 0",
    color:"rgba(255,255,255,0.3)" }}>No submissions yet — be the first!</div>;

  return <div>
    <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11, marginBottom:14, textAlign:"center" }}>
      {scored.length} player{scored.length!==1?"s":""} ·{" "}
      {hasLive?"🔴 Live scoring active":"⚡ Max possible points shown"}
      {canViewPicks && <span style={{ color:G4 }}> · Click any name to see their picks</span>}
    </div>
    {scored.map((entry,i) => {
      const { g, k, f, total } = entry.score;
      const isMe = entry.name===myName;
      return <div key={entry.name}
        onClick={canViewPicks ? ()=>setSelected(entry.name) : undefined}
        style={{
          background:isMe?"rgba(0,166,81,0.15)":CARD,
          border:isMe?`1px solid ${G4}`:`1px solid ${BORDER}`,
          borderRadius:12, padding:"12px 16px", marginBottom:8,
          display:"flex", alignItems:"center", gap:12,
          boxShadow:isMe?"0 0 20px rgba(0,166,81,0.2)":"none",
          cursor:canViewPicks?"pointer":"default",
          transition:"opacity 0.15s"
        }}>
        <div style={{ fontSize:18, width:28, textAlign:"center", flexShrink:0 }}>
          {["🥇","🥈","🥉"][i]||<span style={{ color:"rgba(255,255,255,0.3)", fontSize:12 }}>#{i+1}</span>}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:14, color:isMe?G4:WHT }}>
            {entry.name} {isMe&&<span style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>(you)</span>}
          </div>
          <div style={{ display:"flex", gap:12, marginTop:4, flexWrap:"wrap" }}>
            {[{l:"Groups",v:g,c:G4},{l:"Knockout",v:k,c:"#64b5f6"},{l:"Final 4",v:f,c:"#ce93d8"}].map(s=>
              <span key={s.l} style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>
                <span style={{ color:s.c, fontWeight:700 }}>{s.v}</span> {s.l}
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontSize:22, fontWeight:900, color:isMe?G4:WHT }}>{total}</div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", textTransform:"uppercase" }}>pts</div>
        </div>
        {canViewPicks && <div style={{ color:"rgba(255,255,255,0.2)", fontSize:14 }}>›</div>}
      </div>;
    })}
  </div>;
}

// ─── ADMIN PREDICTIONS ────────────────────────────────────────────────────────

// ─── SCORING PANEL (collapsible) ──────────────────────────────────────────────

function ScoringPanel({ phase }) {
  const [open, setOpen] = useState(false);

  const sections = {
    groups: {
      title: "📋 Group Stage Scoring",
      rows: [
        ["Predict 1st place correctly", "4 pts"],
        ["Predict 2nd place correctly", "3 pts"],
        ["Predict 3rd place correctly", "2 pts"],
        ["Predict 4th place correctly", "1 pt"],
      ],
      note: "Top 2 from each group advance automatically. The 8 best 3rd-place teams across all 12 groups also advance to the Round of 32.",
    },
    knockout: {
      title: "📋 Knockout Stage Scoring",
      rows: [
        ["Round of 32 winner correct", "3 pts"],
        ["Round of 16 winner correct", "5 pts"],
        ["Quarterfinal winner correct", "8 pts"],
        ["Semifinal winner correct", "12 pts"],
        ["Final winner correct", "15 pts"],
      ],
      note: "Picks are based on who actually qualified from the group stage — not your group predictions. Click a team to pick them as match winner.",
    },
    finalfour: {
      title: "📋 Final Four Scoring",
      rows: [
        ["1st place (Champion)", "15 pts"],
        ["3rd place (consolation winner)", "12 pts"],
        ["2nd place (Runner-Up)", "7 pts"],
        ["4th place", "5 pts"],
      ],
      note: "3rd place scores MORE than 2nd place because the 3rd-place team must win an extra consolation match after losing the semifinal.",
    },
  };

  const activeKey = phase <= 1 ? "groups" : phase === 2 ? "knockout" : "finalfour";
  const section = sections[activeKey];

  return (
    <div style={{ marginBottom: 16 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", justifyContent: "space-between",
        alignItems: "center", background: "rgba(0,166,81,0.08)",
        border: `1px solid rgba(0,166,81,0.25)`, borderRadius: open ? "10px 10px 0 0" : 10,
        padding: "10px 14px", cursor: "pointer", fontFamily: "inherit",
        color: G4, fontWeight: 800, fontSize: 12,
      }}>
        <span>{section.title}</span>
        <span style={{ fontSize: 14, transition: "transform 0.2s",
          transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </button>
      {open && (
        <div style={{ background: "rgba(0,0,0,0.3)", border: `1px solid rgba(0,166,81,0.25)`,
          borderTop: "none", borderRadius: "0 0 10px 10px", padding: "12px 14px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {section.rows.map(([label, pts]) => (
                <tr key={label}>
                  <td style={{ padding: "5px 0", fontSize: 11, color: "rgba(255,255,255,0.7)", width: "75%" }}>{label}</td>
                  <td style={{ padding: "5px 0", fontSize: 12, fontWeight: 800, color: G4, textAlign: "right" }}>{pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(0,166,81,0.08)",
            borderRadius: 6, fontSize: 10, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
            ℹ️ {section.note}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN PREDICTIONS ────────────────────────────────────────────────────────

function AdminPredictions({ entries, actualFF, liveStandings, bracket, onDelete }) {
  const [auth,setAuth]         = useState(false);
  const [pass,setPass]         = useState("");
  const [msg,setMsg]           = useState("");
  const [selected,setSelected] = useState(null);
  const [fullEntries,setFullEntries] = useState([]);

  useEffect(()=>{
    if(auth) loadAllEntriesWithPins().then(setFullEntries);
  },[auth]);

  const scored = [...(auth ? fullEntries : entries)]
    .map(e => ({ ...e, score: calcScore(e.picks, actualFF, liveStandings, bracket) }))
    .sort((a,b) => b.score.total - a.score.total);

  if (!auth) return <div style={{ maxWidth:340, margin:"40px auto", textAlign:"center" }}>
    <div style={{ fontSize:26, marginBottom:8 }}>👁️</div>
    <div style={{ color:"rgba(255,255,255,0.6)", fontSize:13, marginBottom:16 }}>Admin access required</div>
    <input value={pass} onChange={e=>setPass(e.target.value)} type="password"
      onKeyDown={e=>e.key==="Enter"&&pass===ADMIN_PASS&&setAuth(true)}
      placeholder="Password..."
      style={{ width:"100%", padding:"11px 13px", borderRadius:8, border:`1px solid ${BORDER}`,
        background:"rgba(0,0,0,0.3)", color:WHT, fontSize:14, outline:"none",
        boxSizing:"border-box", marginBottom:10, fontFamily:"inherit" }}/>
    <Btn onClick={()=>{ if(pass===ADMIN_PASS) setAuth(true); else setMsg("Wrong password"); }} style={{ width:"100%" }}>
      Unlock
    </Btn>
    {msg&&<div style={{ color:"#ff6b6b", fontSize:11, marginTop:8 }}>{msg}</div>}
  </div>;

  if (selected) {
    const entry = entries.find(e=>e.name===selected);
    if (!entry) return null;
    const p = entry.picks;
    return <div>
      <button onClick={()=>setSelected(null)} style={{ background:"none", border:`1px solid ${BORDER}`,
        borderRadius:8, color:"rgba(255,255,255,0.6)", padding:"7px 14px",
        cursor:"pointer", fontSize:12, marginBottom:16, fontFamily:"inherit" }}>
        ← Back
      </button>
      <div style={{ color:G4, fontWeight:900, fontSize:18, marginBottom:16 }}>{entry.name}</div>

      <SectionTitle>Group Stage</SectionTitle>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8, marginBottom:20 }}>
        {GROUPS.map(group => {
          const ranked=group.teams.map(t=>({team:t,rank:p.groups?.[t]})).filter(x=>x.rank).sort((a,b)=>a.rank-b.rank);
          const unranked=group.teams.filter(t=>!p.groups?.[t]);
          return <div key={group.id} style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:8, overflow:"hidden" }}>
            <div style={{ background:G2, padding:"5px 10px", display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ background:WHT, color:G2, width:18, height:18, borderRadius:"50%",
                display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:10 }}>{group.id}</div>
            </div>
            <div style={{ padding:"5px 8px" }}>
              {ranked.map(({ team, rank }) => {
                const liveRank=liveStandings?.[team], correct=liveRank&&liveRank===rank;
                return <div key={team} style={{ display:"flex", alignItems:"center", gap:5, padding:"2px 0" }}>
                  <span style={{ background:rank<=2?G4:rank===3?"#7c6fc4":"#555", color:WHT,
                    width:16, height:16, borderRadius:3, display:"inline-flex", alignItems:"center",
                    justifyContent:"center", fontSize:9, fontWeight:800, flexShrink:0 }}>{rank}</span>
                  <Dot team={team} size={7}/>
                  <span style={{ fontSize:11, color:correct?"#a5d6a7":WHT, flex:1,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{team}</span>
                  {correct&&<span style={{ fontSize:9, color:G4 }}>✓</span>}
                </div>;
              })}
              {unranked.map(t=><div key={t} style={{ display:"flex", alignItems:"center", gap:5, padding:"2px 0", opacity:0.3 }}>
                <span style={{ width:16, height:16, borderRadius:3, background:"rgba(255,255,255,0.1)",
                  display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:9 }}>?</span>
                <Dot team={t} size={7}/><span style={{ fontSize:11 }}>{t}</span>
              </div>)}
            </div>
          </div>;
        })}
      </div>

      <SectionTitle>Knockout Bracket Picks</SectionTitle>
      <div style={{ overflowX:"auto", paddingBottom:12, marginBottom:20 }}>
        <div style={{ display:"flex", gap:12, minWidth:"max-content", alignItems:"flex-start" }}>
          {BRACKET_ROUNDS.map(round => {
            const roundPicks = p.bracket?.[round.key] || {};
            const matches = bracket?.[round.key] || [];
            if (!matches.some(m => m.teamA || m.teamB)) return null;
            const spacing = Math.pow(2, BRACKET_ROUNDS.findIndex(r=>r.key===round.key)) * 8;
            return <div key={round.key} style={{ display:"flex", flexDirection:"column", gap:0, minWidth:180 }}>
              <div style={{ background:G2, borderRadius:8, padding:"5px 10px", textAlign:"center",
                color:WHT, fontWeight:800, fontSize:11, marginBottom:spacing+4 }}>
                {round.label} <span style={{ color:"rgba(255,255,255,0.4)", fontSize:9 }}>+{round.pts}pts</span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:spacing>0?spacing:8 }}>
                {matches.map((match,mi) => {
                  const pick = roundPicks[mi];
                  const { teamA, teamB, winner } = match;
                  const teamRow = (team) => {
                    if (!team) return <div style={{ padding:"8px 10px", color:"rgba(255,255,255,0.2)", fontSize:11, fontStyle:"italic" }}>TBD</div>;
                    const isPick = pick === team;
                    const isCorrect = isPick && winner && winner === team;
                    const isWrong = isPick && winner && winner !== team;
                    return <div style={{
                      display:"flex", alignItems:"center", gap:6, padding:"8px 10px",
                      background: isCorrect?"rgba(0,166,81,0.2)":isWrong?"rgba(220,50,50,0.12)":isPick?"rgba(255,255,255,0.08)":"transparent",
                      borderLeft: isPick?`3px solid ${isCorrect?G4:isWrong?"#ff5252":G4}`:"3px solid transparent",
                    }}>
                      <Dot team={team} size={8}/>
                      <span style={{ flex:1, fontSize:11, fontWeight:isPick?700:400,
                        color:winner===team?GLD:isWrong?"rgba(255,255,255,0.3)":WHT,
                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{team}</span>
                      {isCorrect && <span style={{ fontSize:9, color:G4 }}>✓</span>}
                      {isWrong   && <span style={{ fontSize:9, color:"#ff5252" }}>✗</span>}
                      {winner===team && !isPick && <span style={{ fontSize:9 }}>🏆</span>}
                    </div>;
                  };
                  return <div key={mi} style={{ background:CARD, border:`1px solid ${BORDER}`,
                    borderRadius:10, overflow:"hidden", minWidth:180 }}>
                    {teamRow(teamA)}
                    <div style={{ height:1, background:BORDER }}/>
                    {teamRow(teamB)}
                  </div>;
                })}
              </div>
            </div>;
          })}
        </div>
      </div>

      <SectionTitle>Final Four</SectionTitle>
      {!Object.keys(p.finalFour||{}).length
        ? <span style={{ color:"rgba(255,255,255,0.2)", fontSize:11 }}>No picks yet</span>
        : <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {[1,2,3,4].map(place => {
              const team=p.finalFour?.[place];
              const labels={1:"🥇 Champion",2:"🥈 Runner-Up",3:"🥉 3rd Place",4:"4th Place"};
              return <div key={place} style={{ display:"flex", alignItems:"center", gap:10,
                background:CARD, border:`1px solid ${BORDER}`, borderRadius:8, padding:"8px 12px" }}>
                <span style={{ color:"rgba(255,255,255,0.5)", fontSize:11, width:110 }}>{labels[place]}</span>
                {team?<><Dot team={team}/><span style={{ fontSize:12, color:WHT }}>{team}</span></>
                    :<span style={{ color:"rgba(255,255,255,0.2)", fontSize:11 }}>Not picked</span>}
              </div>;
            })}
          </div>
      }
    </div>;
  }

  return <div>
    <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11, marginBottom:14 }}>
      Click any player to see their full predictions · Use 🗑️ to remove duplicate accounts
    </div>
    {scored.map((entry,i) => {
      const { g,k,f,total } = entry.score;
      const gDone=GROUPS.filter(gr=>gr.teams.every(t=>entry.picks.groups?.[t])).length;
      return <div key={entry.name} style={{ display:"flex", gap:6, marginBottom:8, alignItems:"stretch" }}>
        <button onClick={()=>setSelected(entry.name)} style={{
          background:CARD, border:`1px solid ${BORDER}`, borderRadius:10, padding:"12px 16px",
          cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:12,
          flex:1, fontFamily:"inherit"
        }}>
          <div style={{ fontSize:16, width:26, textAlign:"center", flexShrink:0 }}>
            {["🥇","🥈","🥉"][i]||<span style={{ color:"rgba(255,255,255,0.3)", fontSize:12 }}>#{i+1}</span>}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:13, color:WHT, display:"flex", alignItems:"center", gap:8 }}>
              {entry.name}
              {entry.pin && <span style={{ background:"rgba(255,215,0,0.15)", border:"1px solid rgba(255,215,0,0.3)",
                borderRadius:6, padding:"1px 7px", fontSize:10, color:GLD, fontWeight:700, letterSpacing:"2px" }}>
                PIN: {entry.pin}
              </span>}
            </div>
            <div style={{ display:"flex", gap:10, marginTop:3, flexWrap:"wrap" }}>
              <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}><span style={{ color:G4 }}>{gDone}/12</span> groups</span>
              <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}><span style={{ color:"#64b5f6" }}>{Object.keys(entry.picks.bracket?.r32||{}).length}</span> R32</span>
              <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}><span style={{ color:"#ce93d8" }}>{Object.keys(entry.picks.finalFour||{}).length}</span>/4 FF</span>
            </div>
          </div>
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div style={{ fontSize:18, fontWeight:900, color:G4 }}>{total}</div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", textTransform:"uppercase" }}>pts</div>
          </div>
          <div style={{ color:"rgba(255,255,255,0.2)" }}>›</div>
        </button>
        <button onClick={()=>{ if(window.confirm(`Delete ${entry.name}? This cannot be undone.`)) onDelete(entry.name); }}
          style={{ background:"rgba(220,50,50,0.12)", border:"1px solid rgba(220,50,50,0.3)",
            borderRadius:10, padding:"0 14px", cursor:"pointer", color:"#ff8a80",
            fontSize:16, fontFamily:"inherit", flexShrink:0 }}>
          🗑️
        </button>
      </div>;
    })}
  </div>;
}

// ─── BETS TAB ─────────────────────────────────────────────────────────────────

async function saveBets(bets) {
  // Store bets as a single row in admin_state for simplicity
  // Use direct patch to avoid RLS issues
  await fetch(`${SUPABASE_URL}/rest/v1/admin_state?id=eq.1`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ bets }),
  });
}

// ─── TOURNAMENT LOCK ─────────────────────────────────────────────────────────
const REGISTRATION_LOCKED = false; // Controlled via Admin panel in Supabase

async function checkIsLocked() {
  // First check the hardcoded constant — this can never fail silently
  if (REGISTRATION_LOCKED) return true;
  // Then check Supabase for dynamic override
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/admin_state?id=eq.1&select=locks`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
    });
    const rows = await r.json();
    return rows?.[0]?.locks?.groups === true;
  } catch { return REGISTRATION_LOCKED; }
}
async function loadBets() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/admin_state?id=eq.1&select=bets`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
    });
    const rows = await r.json();
    return Array.isArray(rows) && rows[0]?.bets ? rows[0].bets : [];
  } catch { return []; }
}

function BetsTab({ entries, myName, bets, onBetsChange, adminAuth }) {
  const [creating, setCreating] = useState(false);
  const [betType, setBetType]   = useState("match");
  const [teamA, setTeamA]       = useState("");
  const [teamB, setTeamB]       = useState("");
  const [playerA, setPlayerA]   = useState("");
  const [playerB, setPlayerB]   = useState("");
  const [stake, setStake]       = useState("");
  const [showHidden, setShowHidden] = useState(false);

  // Poll every 10 seconds so all devices stay in sync
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const latest = await loadBets();
        if (!cancelled) onBetsChange(latest);
      } catch(e) { console.error("bets poll error", e); }
    };
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allBets = bets || [];
  const playerNames = entries.map(e=>e.name);

  const handleCreate = async () => {
    if (betType==="match" && (!teamA || !teamB || teamA===teamB)) return;
    if (betType==="leaderboard" && (!playerA || !playerB || playerA===playerB)) return;
    const newBet = {
      id: Date.now(),
      type: betType,
      creator: myName,
      stake: stake || "Bragging rights",
      createdAt: new Date().toISOString(),
      votes: {},
      ...(betType==="match"
        ? { teamA, teamB, label:`Who wins: ${teamA} vs ${teamB}` }
        : { playerA, playerB, label:`Who places higher: ${playerA} vs ${playerB}` }
      ),
    };
    const updated = [...allBets, newBet];
    await saveBets(updated);
    onBetsChange(updated);
    setCreating(false);
    setTeamA(""); setTeamB(""); setPlayerA(""); setPlayerB(""); setStake("");
  };

  const handleCloseBet = async (betId) => {
    const updated = allBets.map(b => b.id===betId ? { ...b, closed:true } : b);
    await saveBets(updated);
    onBetsChange(updated);
  };

  const handleHideBet = async (betId) => {
    const updated = allBets.map(b => b.id===betId ? { ...b, hidden:true } : b);
    await saveBets(updated);
    onBetsChange(updated);
  };

  const handleUnhideBet = async (betId) => {
    const updated = allBets.map(b => b.id===betId ? { ...b, hidden:false } : b);
    await saveBets(updated);
    onBetsChange(updated);
  };

  const handleVote = async (betId, pick) => {
    const updated = allBets.map(b => {
      if (b.id !== betId) return b;
      const votes = { ...(b.votes||{}), [myName]: pick };
      return { ...b, votes };
    });
    await saveBets(updated);
    onBetsChange(updated);
  };

  const selectStyle = { background:"rgba(0,0,0,0.4)", color:WHT, border:`1px solid ${BORDER}`,
    borderRadius:8, padding:"9px 12px", fontSize:12, fontFamily:"inherit", width:"100%" };

  return <div>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
      <div>
        <div style={{ fontWeight:800, fontSize:16, color:WHT }}>🎲 Hypothetical Bets</div>
        <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11, marginTop:2 }}>
          For fun only — no real money involved
        </div>
      </div>
      <Btn onClick={()=>setCreating(c=>!c)} bg={creating?"rgba(255,255,255,0.1)":G4}
        color={creating?"rgba(255,255,255,0.6)":WHT} style={{ padding:"8px 16px", fontSize:12 }}>
        {creating?"Cancel":"+ Create Bet"}
      </Btn>
    </div>

    {creating && <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:"16px", marginBottom:20 }}>
      <SectionTitle>New Bet</SectionTitle>
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {[{k:"match",l:"⚽ Winner of X vs X"},{k:"leaderboard",l:"🏆 Who places higher"}].map(({k,l})=>(
          <button key={k} onClick={()=>setBetType(k)} style={{
            flex:1, padding:"9px", borderRadius:8, border:`1px solid ${betType===k?G4:BORDER}`,
            background:betType===k?"rgba(0,166,81,0.15)":"rgba(0,0,0,0.2)",
            color:betType===k?G4:"rgba(255,255,255,0.5)", fontWeight:betType===k?800:400,
            fontSize:12, cursor:"pointer", fontFamily:"inherit"
          }}>{l}</button>
        ))}
      </div>
      {betType==="match" && <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
        <div style={{ color:"rgba(255,255,255,0.5)", fontSize:11 }}>Select two teams</div>
        <select value={teamA} onChange={e=>setTeamA(e.target.value)} style={selectStyle}>
          <option value="">-- Team A --</option>
          {ALL_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ textAlign:"center", color:"rgba(255,255,255,0.3)", fontSize:12 }}>vs</div>
        <select value={teamB} onChange={e=>setTeamB(e.target.value)} style={selectStyle}>
          <option value="">-- Team B --</option>
          {ALL_TEAMS.filter(t=>t!==teamA).map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>}
      {betType==="leaderboard" && <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
        <div style={{ color:"rgba(255,255,255,0.5)", fontSize:11 }}>Select two players</div>
        <select value={playerA} onChange={e=>setPlayerA(e.target.value)} style={selectStyle}>
          <option value="">-- Player A --</option>
          {playerNames.map(n=><option key={n} value={n}>{n}</option>)}
        </select>
        <div style={{ textAlign:"center", color:"rgba(255,255,255,0.3)", fontSize:12 }}>vs</div>
        <select value={playerB} onChange={e=>setPlayerB(e.target.value)} style={selectStyle}>
          <option value="">-- Player B --</option>
          {playerNames.filter(n=>n!==playerA).map(n=><option key={n} value={n}>{n}</option>)}
        </select>
      </div>}
      <div style={{ marginBottom:12 }}>
        <div style={{ color:"rgba(255,255,255,0.5)", fontSize:11, marginBottom:6 }}>Stakes (optional)</div>
        <input value={stake} onChange={e=>setStake(e.target.value)}
          placeholder="e.g. Loser buys drinks, Bragging rights..."
          style={{ ...selectStyle, outline:"none", boxSizing:"border-box" }}/>
      </div>
      <Btn onClick={handleCreate}
        disabled={(betType==="match"&&(!teamA||!teamB||teamA===teamB))||(betType==="leaderboard"&&(!playerA||!playerB||playerA===playerB))}
        style={{ width:"100%", padding:"10px" }}>
        Create Bet
      </Btn>
    </div>}

    {adminAuth && allBets.some(b=>b.hidden) && (
      <button onClick={()=>setShowHidden(s=>!s)} style={{
        background:"none", border:`1px solid ${BORDER}`, borderRadius:8,
        color:"rgba(255,255,255,0.4)", padding:"6px 12px", cursor:"pointer",
        fontSize:11, fontFamily:"inherit", marginBottom:12
      }}>
        {showHidden ? "Hide hidden bets" : "Show hidden bets (" + allBets.filter(b=>b.hidden).length + ")"}
      </button>
    )}

    {allBets.filter(b => adminAuth ? (showHidden || !b.hidden) : !b.hidden).length === 0 && !creating && (
      <div style={{ textAlign:"center", padding:"48px 20px", color:"rgba(255,255,255,0.3)" }}>
        <div style={{ fontSize:32, marginBottom:8 }}>🎲</div>
        No bets yet — create one to get the trash talk started!
      </div>
    )}

    {allBets.filter(b => adminAuth ? (showHidden || !b.hidden) : !b.hidden).map(bet => {
      const votes = bet.votes || {};
      const myVote = votes[myName];
      const optionA = bet.type==="match" ? bet.teamA : bet.playerA;
      const optionB = bet.type==="match" ? bet.teamB : bet.playerB;
      const votesA = Object.values(votes).filter(v=>v===optionA).length;
      const votesB = Object.values(votes).filter(v=>v===optionB).length;
      const totalVotes = votesA + votesB;
      const winner = totalVotes > 0 ? (votesA >= votesB ? optionA : optionB) : null;

      return <div key={bet.id} style={{
        background: bet.hidden?"rgba(0,0,0,0.3)":bet.closed?"rgba(0,0,0,0.4)":CARD,
        border:"1px solid " + (bet.hidden?"rgba(255,255,255,0.05)":bet.closed?"rgba(255,215,0,0.3)":BORDER),
        borderRadius:12, padding:"14px 16px", marginBottom:10,
        opacity: bet.hidden ? 0.5 : 1
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <span style={{ fontWeight:800, fontSize:14, color:bet.hidden?"rgba(255,255,255,0.4)":WHT }}>
                {bet.label}
              </span>
              {bet.closed && <span style={{ background:"rgba(255,215,0,0.15)", border:"1px solid rgba(255,215,0,0.4)",
                borderRadius:20, padding:"2px 8px", fontSize:9, color:GLD, fontWeight:700 }}>CLOSED</span>}
              {bet.hidden && <span style={{ background:"rgba(255,255,255,0.05)", border:"1px solid " + BORDER,
                borderRadius:20, padding:"2px 8px", fontSize:9, color:"rgba(255,255,255,0.3)", fontWeight:700 }}>HIDDEN</span>}
            </div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:3 }}>
              Created by {bet.creator} · Stakes: <span style={{ color:G4 }}>{bet.stake}</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
            <span style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>
              {totalVotes} vote{totalVotes!==1?"s":""}
            </span>
            {adminAuth && !bet.closed && !bet.hidden && (
              <button onClick={()=>handleCloseBet(bet.id)} style={{
                background:"rgba(255,215,0,0.1)", border:"1px solid rgba(255,215,0,0.3)",
                borderRadius:6, padding:"4px 10px", cursor:"pointer",
                color:GLD, fontSize:11, fontWeight:700, fontFamily:"inherit"
              }}>Close</button>
            )}
            {adminAuth && !bet.hidden && (
              <button onClick={()=>handleHideBet(bet.id)} style={{
                background:"rgba(220,50,50,0.1)", border:"1px solid rgba(220,50,50,0.3)",
                borderRadius:6, padding:"4px 10px", cursor:"pointer",
                color:"#ff8a80", fontSize:11, fontWeight:700, fontFamily:"inherit"
              }}>Hide</button>
            )}
            {adminAuth && bet.hidden && (
              <button onClick={()=>handleUnhideBet(bet.id)} style={{
                background:"rgba(255,255,255,0.05)", border:"1px solid " + BORDER,
                borderRadius:6, padding:"4px 10px", cursor:"pointer",
                color:"rgba(255,255,255,0.5)", fontSize:11, fontWeight:700, fontFamily:"inherit"
              }}>Unhide</button>
            )}
          </div>
        </div>

        {bet.closed && winner && (
          <div style={{ background:"rgba(255,215,0,0.1)", border:"1px solid rgba(255,215,0,0.3)",
            borderRadius:8, padding:"10px 14px", marginBottom:10,
            display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:18 }}>🏆</span>
            <div>
              <div style={{ color:GLD, fontWeight:800, fontSize:13 }}>{winner} wins the vote!</div>
              <div style={{ color:"rgba(255,255,255,0.4)", fontSize:10, marginTop:2 }}>
                {votesA} vs {votesB} — voting is now closed
              </div>
            </div>
          </div>
        )}

        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          {[optionA, optionB].map(option => {
            const vCount = option===optionA ? votesA : votesB;
            const pct = totalVotes ? Math.round((vCount/totalVotes)*100) : 0;
            const isPick = myVote===option;
            const isWinner = bet.closed && option===winner;
            return <button key={option}
              onClick={()=>{ if(!bet.closed) handleVote(bet.id, option); }}
              disabled={bet.closed}
              style={{
                flex:1, padding:"10px 8px", borderRadius:10,
                cursor:bet.closed?"default":"pointer",
                background:isWinner?"rgba(255,215,0,0.15)":isPick?"rgba(0,166,81,0.2)":"rgba(0,0,0,0.25)",
                border:"1px solid " + (isWinner?"rgba(255,215,0,0.5)":isPick?G4:BORDER),
                color:isWinner?GLD:isPick?G4:"rgba(255,255,255,0.6)",
                fontWeight:isPick||isWinner?800:400, fontSize:12,
                fontFamily:"inherit", textAlign:"center", transition:"all 0.15s"
              }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:5, marginBottom:4 }}>
                {bet.type==="match" && <Dot team={option} size={8}/>}
                <span>{option}</span>
                {isPick && !bet.closed && <span style={{ fontSize:10 }}>✓</span>}
                {isWinner && <span style={{ fontSize:10 }}>🏆</span>}
              </div>
              {totalVotes>0 && <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>
                {pct}% ({vCount})
              </div>}
            </button>;
          })}
        </div>

        {totalVotes>0 && <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
          {Object.entries(votes).map(([voter, pick]) => (
            <span key={voter} style={{ fontSize:9, padding:"2px 6px",
              background:pick===optionA?"rgba(0,166,81,0.15)":"rgba(100,181,246,0.15)",
              border:"1px solid " + (pick===optionA?"rgba(0,166,81,0.3)":"rgba(100,181,246,0.3)"),
              borderRadius:20, color:"rgba(255,255,255,0.5)" }}>
              {voter} → {pick}
            </span>
          ))}
        </div>}
      </div>;
    })}
  </div>;
}




function AdminPanel({ phase, actualFF, liveStandings, locks, bracket, onUpdate, auth, onAuth }) {
  const [pass,setPass]     = useState("");
  const [msg,setMsg]       = useState("");
  const [saving,setSaving] = useState(false);
  const [liveDraft,setLiveDraft]   = useState(liveStandings||{});
  const [ffDraft,setFfDraft]       = useState(actualFF||[]);
  const [r32Draft,setR32Draft]     = useState(
    bracket?.r32?.length===16
      ? bracket.r32.map(m=>({teamA:m.teamA||"",teamB:m.teamB||"",winner:m.winner||null}))
      : Array(16).fill(null).map(()=>({teamA:"",teamB:"",winner:null}))
  );
  const [bracketState,setBracketState] = useState(bracket||null);

  // Keep liveDraft in sync when liveStandings prop updates from polling
  useEffect(()=>{
    if(liveStandings && Object.keys(liveStandings).length > 0) {
      setLiveDraft(liveStandings);
    }
  }, [liveStandings]);

  const flash = m => { setMsg(m); setTimeout(()=>setMsg(""),3000); };

  const save = async (updates) => {
    setSaving(true);
    await patchAdminState(updates);
    onUpdate(updates);
    flash("✓ Saved!");
    setSaving(false);
  };

  const toggleLock = async (key) => {
    const newLocks = { ...(locks||{}), [key]:!(locks?.[key]) };
    await save({ locks: newLocks });
  };

  const saveBracket = async () => {
    const base = { r32: r32Draft.map(m=>({...m,winner:m.winner||null})) };
    const full  = propagateBracket(base);
    setBracketState(full);
    await save({ bracket: full, phase: Math.max(phase,2) });
  };

  const setWinner = async (roundKey, mi, winner) => {
    const next = JSON.parse(JSON.stringify(bracketState||{}));
    if (!next[roundKey]?.[mi]) return;
    next[roundKey][mi].winner = winner;
    const propagated = propagateBracket(next);
    setBracketState(propagated);
    await save({ bracket: propagated });
  };

  const handleLiveRank = (team, rank) => {
    const g=GROUPS.find(gr=>gr.teams.includes(team)); if(!g) return;
    const next={...liveDraft};
    g.teams.forEach(t=>{ if(next[t]===rank&&t!==team) delete next[t]; });
    if(next[team]===rank) delete next[team]; else next[team]=rank;
    setLiveDraft(next);
  };

  if (!auth) return <div style={{ maxWidth:340, margin:"40px auto", textAlign:"center" }}>
    <div style={{ fontSize:26, marginBottom:8 }}>🔐</div>
    <div style={{ color:"rgba(255,255,255,0.6)", fontSize:13, marginBottom:16 }}>Admin access required</div>
    <input value={pass} onChange={e=>setPass(e.target.value)} type="password"
      onKeyDown={e=>e.key==="Enter"&&pass===ADMIN_PASS&&onAuth(true)}
      placeholder="Password..."
      style={{ width:"100%", padding:"11px 13px", borderRadius:8, border:`1px solid ${BORDER}`,
        background:"rgba(0,0,0,0.3)", color:WHT, fontSize:14, outline:"none",
        boxSizing:"border-box", marginBottom:10, fontFamily:"inherit" }}/>
    <Btn onClick={()=>{ if(pass===ADMIN_PASS) onAuth(true); else setMsg("Wrong password"); }} style={{ width:"100%" }}>
      Unlock Admin
    </Btn>
    {msg&&<div style={{ color:"#ff6b6b", fontSize:11, marginTop:8 }}>{msg}</div>}
  </div>;

  return <div>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
      <SectionTitle>⚙️ Admin Panel</SectionTitle>
      {msg&&<div style={{ color:G4, fontSize:12, fontWeight:700 }}>{msg}</div>}
    </div>

    {/* Phase */}
    <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
      <SectionTitle>Tournament Phase</SectionTitle>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {[{p:1,l:"Phase 1",s:"Groups open"},{p:2,l:"Phase 2",s:"Knockout open"},{p:3,l:"Phase 3",s:"Final Four open"}].map(({p,l,s})=>(
          <button key={p} onClick={()=>save({phase:p})} style={{
            background:phase===p?"rgba(0,166,81,0.2)":CARD,
            border:phase===p?`1px solid ${G4}`:`1px solid ${BORDER}`,
            borderRadius:8, padding:"10px 14px", cursor:"pointer", textAlign:"left",
            flex:1, minWidth:100, fontFamily:"inherit"
          }}>
            <div style={{ fontWeight:800, fontSize:12, color:phase===p?G4:"rgba(255,255,255,0.6)" }}>{l}</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginTop:2 }}>{s}</div>
          </button>
        ))}
      </div>
    </div>

    {/* Locks */}
    <div style={{ background:CARD, border:"1px solid rgba(220,50,50,0.3)", borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
      <SectionTitle>🔒 Pick Locks</SectionTitle>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {[
          { key:"groups",   label:"Group Stage Picks", desc:"Lock before June 11 kickoff" },
          { key:"knockout", label:"Knockout Picks",    desc:"Lock when bracket is set" },
        ].map(({ key, label, desc }) => {
          const isLocked = locks?.[key];
          return <div key={key} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
            background:"rgba(0,0,0,0.2)", borderRadius:8, padding:"10px 14px" }}>
            <div>
              <div style={{ color:WHT, fontWeight:700, fontSize:13 }}>{label}</div>
              <div style={{ color:"rgba(255,255,255,0.35)", fontSize:10, marginTop:2 }}>{desc}</div>
            </div>
            <button onClick={()=>toggleLock(key)} style={{
              background:isLocked?"rgba(220,50,50,0.2)":"rgba(0,166,81,0.2)",
              border:`1px solid ${isLocked?"rgba(220,50,50,0.5)":G4}`,
              borderRadius:20, padding:"6px 16px", cursor:"pointer",
              color:isLocked?"#ff8a80":G4, fontWeight:800, fontSize:12, fontFamily:"inherit"
            }}>{isLocked?"🔒 Locked":"🔓 Unlocked"}</button>
          </div>;
        })}
      </div>
    </div>

    {/* Live Standings */}
    <div style={{ background:CARD, border:"1px solid rgba(0,166,81,0.3)", borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div>
          <div style={{ color:G4, fontWeight:800, fontSize:13 }}>🔴 Live Group Standings</div>
          <div style={{ color:"rgba(255,255,255,0.4)", fontSize:10, marginTop:2 }}>Update after each matchday — scores recalculate for everyone</div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <Btn onClick={()=>save({liveStandings:liveDraft})} bg={G4} color={WHT} disabled={saving} style={{ padding:"7px 14px", fontSize:11 }}>
            {saving?"Saving...":"Save"}
          </Btn>
          <Btn onClick={()=>{ setLiveDraft({}); save({liveStandings:{}}); }} bg="rgba(0,0,0,0.4)" color="rgba(255,255,255,0.5)" style={{ padding:"7px 14px", fontSize:11 }}>
            Clear
          </Btn>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:8 }}>
        {GROUPS.map(group=>(
          <div key={group.id} style={{ background:"rgba(0,0,0,0.2)", border:`1px solid ${DBORDER}`, borderRadius:8, padding:"8px 10px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
              <div style={{ background:G4, color:WHT, width:22, height:22, borderRadius:"50%",
                display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:11 }}>{group.id}</div>
              <span style={{ color:"rgba(255,255,255,0.4)", fontSize:10 }}>{group.teams.filter(t=>liveDraft[t]).length}/4</span>
            </div>
            {group.teams.map(team=>{
              const rank=liveDraft[team];
              return <div key={team} style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}>
                <Dot team={team} size={7}/>
                <span style={{ flex:1, fontSize:11, color:"rgba(255,255,255,0.7)",
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{team}</span>
                <div style={{ display:"flex", gap:2 }}>
                  {[1,2,3,4].map(r=><button key={r} onClick={()=>handleLiveRank(team,r)} style={{
                    width:20, height:20, borderRadius:3, border:"none", cursor:"pointer",
                    background:rank===r?(r<=2?G4:r===3?"#7c6fc4":"#555"):"rgba(0,0,0,0.3)",
                    color:rank===r?WHT:"rgba(255,255,255,0.3)", fontSize:9, fontWeight:800, fontFamily:"inherit"
                  }}>{r}</button>)}
                </div>
              </div>;
            })}
          </div>
        ))}
      </div>
    </div>

    {/* R32 Bracket Setup */}
    <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <div>
          <div style={{ color:"#64b5f6", fontWeight:800, fontSize:13 }}>🏟️ Round of 32 — Enter Matchups</div>
          <div style={{ color:"rgba(255,255,255,0.4)", fontSize:10, marginTop:2 }}>
            Mirror the real FIFA bracket draw. All 16 matches → players pick winners.
          </div>
        </div>
        <Btn onClick={saveBracket} bg="#1565c0" color={WHT} disabled={saving} style={{ padding:"7px 14px", fontSize:11 }}>
          {saving?"Saving...":"Save Bracket & Unlock"}
        </Btn>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))", gap:8, marginTop:12 }}>
        {r32Draft.map((match,i)=>(
          <div key={i} style={{ background:"rgba(0,0,0,0.2)", border:`1px solid ${DBORDER}`, borderRadius:8, padding:"8px 10px" }}>
            <div style={{ color:"rgba(255,255,255,0.35)", fontSize:9, marginBottom:6, fontWeight:700 }}>MATCH {i+1}</div>
            {["teamA","teamB"].map(slot=>(
              <select key={slot} value={match[slot]||""}
                onChange={e=>{ const next=[...r32Draft]; next[i]={...next[i],[slot]:e.target.value}; setR32Draft(next); }}
                style={{ background:"rgba(0,0,0,0.4)", color:match[slot]?WHT:"rgba(255,255,255,0.3)",
                  border:`1px solid ${BORDER}`, borderRadius:6, padding:"6px 8px", fontSize:11,
                  fontFamily:"inherit", width:"100%", marginBottom:4 }}>
                <option value="">-- Select Team --</option>
                {ALL_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            ))}
          </div>
        ))}
      </div>
    </div>

    {/* Mark Match Winners */}
    {bracketState?.r32?.length>0 && (
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
        <div style={{ color:GLD, fontWeight:800, fontSize:13, marginBottom:12 }}>🏆 Mark Real Match Winners</div>
        {BRACKET_ROUNDS.map(round=>{
          const matches=bracketState[round.key]||[];
          if(!matches.some(m=>m.teamA||m.teamB)) return null;
          return <div key={round.key} style={{ marginBottom:16 }}>
            <div style={{ color:"rgba(255,255,255,0.5)", fontSize:11, fontWeight:700, marginBottom:8 }}>{round.label}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {matches.map((match,i)=>{
                if(!match.teamA&&!match.teamB) return null;
                return <div key={i} style={{ background:"rgba(0,0,0,0.25)", border:`1px solid ${BORDER}`,
                  borderRadius:8, padding:"8px 12px", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  <span style={{ color:"rgba(255,255,255,0.3)", fontSize:10, flexShrink:0 }}>M{i+1}:</span>
                  {[match.teamA,match.teamB].filter(Boolean).map(team=>(
                    <button key={team} onClick={()=>setWinner(round.key,i,team)} style={{
                      background:match.winner===team?"rgba(255,215,0,0.2)":"rgba(255,255,255,0.07)",
                      border:match.winner===team?`1px solid ${GLD}`:`1px solid ${BORDER}`,
                      borderRadius:6, padding:"5px 10px", cursor:"pointer",
                      color:match.winner===team?GLD:WHT,
                      fontSize:11, fontWeight:match.winner===team?700:400,
                      fontFamily:"inherit", display:"flex", alignItems:"center", gap:4
                    }}><Dot team={team} size={7}/>{team}{match.winner===team&&" 🏆"}</button>
                  ))}
                </div>;
              })}
            </div>
          </div>;
        })}
      </div>
    )}

    {/* Final Four */}
    <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:10, padding:"14px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div style={{ color:"#ce93d8", fontWeight:800, fontSize:13 }}>
          🥇 Final Four Placements ({ffDraft.length}/4 selected)
        </div>
        <Btn onClick={()=>save({actualFF:ffDraft,phase:3})} bg="#6a1b9a" color={WHT}
          disabled={ffDraft.length!==4||saving} style={{ padding:"7px 14px", fontSize:11 }}>
          Save & Unlock Final 4
        </Btn>
      </div>
      <div style={{ color:"rgba(255,255,255,0.35)", fontSize:10, marginBottom:10 }}>
        Select the 4 semifinalists — players will assign their predicted finishing positions
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
        {ALL_TEAMS.map(team=>{
          const sel=ffDraft.includes(team);
          return <button key={team} onClick={()=>setFfDraft(prev=>sel?prev.filter(t=>t!==team):prev.length<4?[...prev,team]:prev)} style={{
            display:"flex", alignItems:"center", gap:5,
            background:sel?"rgba(106,27,154,0.25)":"rgba(0,0,0,0.25)",
            border:sel?"1px solid #ce93d8":`1px solid ${BORDER}`,
            borderRadius:6, padding:"4px 9px", cursor:"pointer",
            color:sel?"#e1bee7":"rgba(255,255,255,0.4)",
            fontWeight:sel?700:400, fontSize:11, fontFamily:"inherit"
          }}><Dot team={team} size={7}/>{team}</button>;
        })}
      </div>
      {ffDraft.length!==4&&<div style={{ color:"rgba(255,255,255,0.3)", fontSize:10, marginTop:8 }}>
        {ffDraft.length} selected — need exactly 4
      </div>}
    </div>

    {/* ── PLAYERS: PINs & Delete ── */}
    <PlayerManager onDelete={async(playerName)=>{
      await sb(`picks?name=eq.${encodeURIComponent(playerName)}`, {
        method:"DELETE",
        headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}`, "Content-Type":"application/json" },
      });
      flash(`✓ ${playerName} deleted`);
    }}/>
  </div>;
}

function PlayerManager({ onDelete }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    loadAllEntriesWithPins().then(p=>{ setPlayers(p); setLoading(false); });
  },[]);

  if (loading) return <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:10,
    padding:"14px 16px", marginTop:14, color:"rgba(255,255,255,0.4)", fontSize:12 }}>Loading players...</div>;

  return <div style={{ background:CARD, border:"1px solid rgba(255,215,0,0.25)", borderRadius:10, padding:"14px 16px", marginTop:14 }}>
    <SectionTitle>👥 Players — PINs & Account Management</SectionTitle>
    <div style={{ color:"rgba(255,255,255,0.35)", fontSize:10, marginBottom:12 }}>
      Use this to help players who are locked out of their account. 🗑️ removes duplicate accounts.
    </div>
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {players.length===0 && <div style={{ color:"rgba(255,255,255,0.3)", fontSize:12 }}>No players yet.</div>}
      {players.map((p,i) => (
        <div key={p.name} style={{ display:"flex", alignItems:"center", gap:10,
          background:"rgba(0,0,0,0.2)", border:`1px solid ${BORDER}`, borderRadius:8, padding:"10px 14px" }}>
          <div style={{ fontSize:14, width:24, textAlign:"center", flexShrink:0 }}>
            {["🥇","🥈","🥉"][i]||<span style={{ color:"rgba(255,255,255,0.3)", fontSize:11 }}>#{i+1}</span>}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:13, color:WHT }}>{p.name}</div>
          </div>
          <div style={{ background:"rgba(255,215,0,0.12)", border:"1px solid rgba(255,215,0,0.3)",
            borderRadius:6, padding:"3px 10px", fontSize:12, color:GLD, fontWeight:800, letterSpacing:"3px" }}>
            {p.pin || "—"}
          </div>
          <button onClick={()=>{ if(window.confirm(`Delete ${p.name}? This cannot be undone.`)){
            onDelete(p.name);
            setPlayers(prev=>prev.filter(x=>x.name!==p.name));
          }}} style={{ background:"rgba(220,50,50,0.12)", border:"1px solid rgba(220,50,50,0.3)",
            borderRadius:8, padding:"6px 12px", cursor:"pointer", color:"#ff8a80",
            fontSize:14, fontFamily:"inherit", flexShrink:0 }}>
            🗑️
          </button>
        </div>
      ))}
    </div>
  </div>;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [step,setStep]           = useState("name");
  const [nameInput,setNameInput] = useState("");
  const [pinInput,setPinInput]   = useState("");
  const [loading,setLoading]     = useState(false);
  const [error,setError]         = useState("");
  const [existing,setExisting]   = useState(null);
  const [isLocked,setIsLocked]   = useState(false);

  const inputStyle = { width:"100%", padding:"12px 14px", borderRadius:10,
    border:`1px solid ${BORDER}`, background:"rgba(0,0,0,0.4)", color:WHT,
    fontSize:15, outline:"none", boxSizing:"border-box", marginBottom:12, fontFamily:"inherit" };

  const handleName = async () => {
    if (!nameInput.trim()) return;
    setLoading(true); setError("");
    // Check lock state directly
    const locked = await checkIsLocked();
    const entry = await loadMyEntry(nameInput.trim());
    setExisting(entry);
    setIsLocked(locked);
    // If locked and new user — block immediately
    if (locked && !entry) {
      setError("Registration is closed — the tournament has started. Contact the league admin if you have an existing account.");
      setLoading(false);
      return;
    }
    setStep(entry ? "pin-return" : "pin-new");
    setLoading(false);
  };

  const handlePin = async () => {
    if (pinInput.length<4) { setError("PIN must be 4 digits"); return; }
    setLoading(true); setError("");
    const name = nameInput.trim();
    if (pinInput===MASTER_PIN) {
      onLogin(name, pinInput, existing?.data||{groups:{},bracket:{},finalFour:{}});
      return;
    }
    if (step==="pin-return") {
      if (pinInput===existing.pin) {
        onLogin(name, pinInput, existing.data||{groups:{},bracket:{},finalFour:{}});
      } else {
        setError("Wrong PIN. Contact the league admin."); setLoading(false);
      }
    } else {
      // Double-check lock before creating new account
      if (isLocked) {
        setError("Picks are locked — the tournament has started.");
        setLoading(false);
        return;
      }
      const newPicks = { groups:{}, bracket:{}, finalFour:{} };
      await saveEntry(name, pinInput, newPicks);
      onLogin(name, pinInput, newPicks);
    }
  };

  return <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#001a0d,#000)",
    display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
    <div style={{ background:"rgba(0,90,43,0.35)", border:`1px solid ${BORDER}`,
      borderRadius:20, padding:"40px 32px", maxWidth:400, width:"100%",
      textAlign:"center", boxShadow:"0 20px 60px rgba(0,0,0,0.5)" }}>
      <div style={{ fontSize:48, marginBottom:8 }}>🏆</div>
      <div style={{ fontSize:26, fontWeight:900, color:WHT, marginBottom:2 }}>World Cup 2026</div>
      <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", marginBottom:8 }}>Fantasy Prediction League</div>
      <div style={{ background:"rgba(0,166,81,0.15)", border:"1px solid rgba(0,166,81,0.3)",
        borderRadius:8, padding:"6px 12px", marginBottom:28, fontSize:11, color:G4 }}>
        ✅ All 48 teams confirmed · June 11 – July 19, 2026
      </div>

      {step==="name"&&<>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:8, textAlign:"left" }}>Your name</div>
        <input value={nameInput} onChange={e=>setNameInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&handleName()} placeholder="Enter your name..." style={inputStyle}/>
        <Btn onClick={handleName} disabled={loading||!nameInput.trim()} style={{ width:"100%", padding:"12px" }}>
          {loading?"Checking...":"Continue →"}
        </Btn>
      </>}

      {(step==="pin-new"||step==="pin-return")&&<>
        <div style={{ color:WHT, fontWeight:700, fontSize:15, marginBottom:6 }}>
          {step==="pin-new"?`Welcome, ${nameInput}! 👋`:`Welcome back, ${nameInput}! ⚽`}
        </div>
        <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12, marginBottom:16 }}>
          {step==="pin-new"?"Create a 4-digit PIN to protect your picks":"Enter your PIN to access your picks"}
        </div>
        <input value={pinInput}
          onChange={e=>setPinInput(e.target.value.replace(/\D/g,"").slice(0,4))}
          onKeyDown={e=>e.key==="Enter"&&handlePin()}
          placeholder={step==="pin-new"?"Choose a 4-digit PIN":"Your 4-digit PIN"}
          type="password" inputMode="numeric" maxLength={4}
          style={{ ...inputStyle, fontSize:20, letterSpacing:"8px", textAlign:"center" }}/>
        {error&&<div style={{ color:"#ff6b6b", fontSize:11, marginBottom:8 }}>{error}</div>}
        <Btn onClick={handlePin} disabled={loading||pinInput.length<4} style={{ width:"100%", padding:"12px" }}>
          {loading?(step==="pin-new"?"Setting up...":"Checking..."):(step==="pin-new"?"Create Account →":"Enter →")}
        </Btn>
        <button onClick={()=>{setStep("name");setPinInput("");setError("");}}
          style={{ background:"none", border:"none", color:"rgba(255,255,255,0.3)",
            fontSize:11, cursor:"pointer", marginTop:10, fontFamily:"inherit" }}>← Back</button>
        {step==="pin-return"&&<div style={{ color:"rgba(255,255,255,0.2)", fontSize:10, marginTop:8 }}>
          Forgot your PIN? Contact the league admin.
        </div>}
      </>}
    </div>
  </div>;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen,setScreen]   = useState("login");
  const [name,setName]       = useState("");
  const [pin,setPin]         = useState("");
  const [tab,setTab]         = useState("groups");
  const [saving,setSaving]   = useState(false);
  const [showSplash,setShowSplash] = useState(false);
  const [entries,setEntries] = useState([]);
  const [phase,setPhase]     = useState(1);
  const [actualFF,setActualFF]           = useState(null);
  const [liveStandings,setLiveStandings] = useState(null);
  const [locks,setLocks]                 = useState({ groups:false, knockout:false });
  const [bracket,setBracket]             = useState(null);
  const [bets,setBets]                   = useState([]);
  const [adminAuth,setAdminAuth]         = useState(false); // persists across tab switches
  const [picks,setPicks] = useState({ groups:{}, bracket:{}, finalFour:{} });

  const loadAdmin = useCallback(async()=>{
    const s = await getFullAdminState();
    if(s){
      if(s.phase!=null)                    setPhase(s.phase);
      setActualFF(s.actualFF||null);
      setLiveStandings(s.liveStandings||null);
      setLocks(s.locks||{ groups:false, knockout:false });
      setBracket(s.bracket||null);
      if(Array.isArray(s.bets))            setBets(s.bets);
    }
  },[]);

  const loadLeaderboard = useCallback(async()=>{
    setEntries(await loadAllEntries());
  },[]);

  useEffect(()=>{ if(screen==="app"){ loadAdmin(); loadLeaderboard(); } },[screen,loadAdmin,loadLeaderboard]);
  useEffect(()=>{ if(tab==="leaderboard"||tab==="predictions"||tab==="bets"){ loadAdmin(); loadLeaderboard(); } },[tab]);

  // Poll every 15 seconds — keeps locks, bets, standings, leaderboard in sync across ALL devices
  useEffect(()=>{
    if(screen!=="app") return;
    const interval = setInterval(()=>{
      loadAdmin();
      loadLeaderboard();
    }, 15000);
    return ()=>clearInterval(interval);
  },[screen, loadAdmin, loadLeaderboard]);

  const handleLogin = async (n,p,existingPicks) => {
    setName(n); setPin(p);
    if(existingPicks) setPicks(existingPicks);
    // Load admin state BEFORE showing the app so locks are applied immediately
    await loadAdmin();
    setScreen("app");
  };

  const handleSave = async () => {
    if (locks?.groups || REGISTRATION_LOCKED) return;
    setSaving(true);
    await saveEntry(name,pin,picks);
    await loadLeaderboard();
    setSaving(false);
    setShowSplash(true);
    setTimeout(()=>{ setShowSplash(false); setTab("leaderboard"); }, 2000);
  };

  const handleDelete = async (playerName) => {
    await sb(`picks?name=eq.${encodeURIComponent(playerName)}`, {
      method:"DELETE",
      headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}`, "Content-Type":"application/json" },
    });
    await loadLeaderboard();
  };

  const handleAdminUpdate = (updates) => {
    // Apply locally immediately for instant feedback
    if(updates.phase!=null)                                        setPhase(updates.phase);
    if(updates.actualFF!=null)                                     setActualFF(updates.actualFF);
    if(updates.liveStandings!=null &&
       Object.keys(updates.liveStandings||{}).length > 0)         setLiveStandings(updates.liveStandings);
    if(updates.locks!=null)                                        setLocks(updates.locks);
    if(updates.bracket!=null)                                      setBracket(updates.bracket);
    // Reload from server after 1 second to confirm sync
    setTimeout(()=>loadAdmin(), 1000);
  };

  const handleBracketPick = (newBracketPicks) => {
    if(locks?.knockout) return;
    setPicks(prev => ({ ...prev, bracket: newBracketPicks }));
  };

  const score = calcScore(picks, actualFF, liveStandings, bracket);
  const hasLive = liveStandings && Object.keys(liveStandings).length>0;
  const groupsDone = GROUPS.filter(g=>g.teams.every(t=>picks.groups[t])).length;

  if(screen==="login") return <LoginScreen onLogin={handleLogin}/>;

  const tabs = [
    { key:"groups",      label:`Groups${groupsDone===12?" ✓":""}` },
    { key:"knockout",    label:`Knockouts${phase<2?" 🔒":""}` },
    { key:"finalfour",   label:`Final 4${phase<3?" 🔒":""}` },
    { key:"leaderboard", label:`Leaderboard` },
    { key:"bets",        label:`Bets` },
    { key:"admin",       label:`Admin` },
  ];

  return <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#001a0d,#000)",
    fontFamily:"'Segoe UI',system-ui,Arial,sans-serif", color:WHT }}>

    {/* Save splash overlay */}
    {showSplash && <div style={{
      position:"fixed", inset:0, zIndex:1000,
      background:"rgba(0,0,0,0.85)", backdropFilter:"blur(8px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      flexDirection:"column", gap:16
    }}>
      <div style={{ fontSize:64 }}>✅</div>
      <div style={{ fontSize:24, fontWeight:900, color:G4 }}>Picks Saved!</div>
      <div style={{ fontSize:14, color:"rgba(255,255,255,0.5)" }}>Taking you to the leaderboard…</div>
      <div style={{ width:200, height:4, background:"rgba(255,255,255,0.1)", borderRadius:4, overflow:"hidden", marginTop:8 }}>
        <div style={{ height:"100%", background:G4, borderRadius:4, animation:"none", width:"100%",
          transition:"width 2s linear" }}/>
      </div>
    </div>}

    <div style={{ background:`linear-gradient(135deg,${G2},#003d1a)`,
      borderBottom:`2px solid ${G4}`, padding:"13px 18px", boxShadow:"0 4px 20px rgba(0,0,0,0.4)" }}>
      <div style={{ maxWidth:1300, margin:"0 auto", display:"flex",
        justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
        <div>
          <div style={{ fontWeight:900, fontSize:18 }}>🏆 <span style={{ color:G4 }}>WC2026</span> Fantasy</div>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:11, marginTop:1 }}>
            <span style={{ color:G4, fontWeight:700 }}>{name}</span>
            {" · "}<span style={{ color:["",G4,"#64b5f6","#ce93d8"][phase] }}>
              {["","Phase 1: Groups","Phase 2: Knockout","Phase 3: Final Four"][phase]}
            </span>
            {hasLive&&<span style={{ color:"#ff6b6b" }}> · 🔴 Live</span>}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:22, fontWeight:900, color:G4 }}>{score.total}</div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", textTransform:"uppercase" }}>pts</div>
          </div>
          <Btn onClick={handleSave} disabled={saving||locks?.groups} bg={G4} color={WHT}>
            {saving?"Saving...":(locks?.groups||REGISTRATION_LOCKED)?"🔒 Locked":"Save Picks"}
          </Btn>
        </div>
      </div>
    </div>

    <div style={{ maxWidth:1300, margin:"0 auto", padding:"16px" }}>
      <TabBar tabs={tabs} active={tab} onChange={setTab}/>
      <div style={{ marginTop:16 }}>

        {tab==="groups"&&<>
          <ScoringPanel phase={1}/>
          <ConfChart/>
          <GroupPicker picks={picks.groups}
            onChange={g=>setPicks(p=>({...p,groups:g}))}
            liveStandings={liveStandings} locked={locks?.groups || REGISTRATION_LOCKED}/>
        </>}

        {tab==="knockout"&&(phase<2
          ? <PhaseGate label="Knockout Stage Locked"
              desc="The admin will unlock this once the group stage is complete and the bracket is set."/>
          : <>
              <ScoringPanel phase={2}/>
              <BracketView bracket={bracket} bracketPicks={picks.bracket}
                onPick={handleBracketPick} locked={locks?.knockout}
                actualBracket={bracket}/>
            </>
        )}

        {tab==="finalfour"&&(phase<3
          ? <PhaseGate label="Final Four Locked"
              desc="The admin will unlock this once the four semifinalists are confirmed."/>
          : <>
              <ScoringPanel phase={3}/>
              <FinalFourPicker actualFF={actualFF} ffPicks={picks.finalFour}
                onChange={ff=>setPicks(p=>({...p,finalFour:ff}))}
                locked={locks?.knockout} bracket={bracket} actualBracket={bracket}/>
            </>
        )}

        {tab==="leaderboard"&&<Leaderboard entries={entries} myName={name}
          actualFF={actualFF} liveStandings={liveStandings} bracket={bracket} locks={locks}/>}

        {tab==="bets"&&<BetsTab entries={entries} myName={name}
          bets={bets} onBetsChange={setBets} adminAuth={adminAuth}/>}

        {tab==="predictions"&&<AdminPredictions entries={entries}
          actualFF={actualFF} liveStandings={liveStandings} bracket={bracket}
          onDelete={handleDelete}/>}

        {tab==="admin"&&<AdminPanel phase={phase} actualFF={actualFF}
          liveStandings={liveStandings} locks={locks} bracket={bracket}
          onUpdate={handleAdminUpdate} auth={adminAuth} onAuth={setAdminAuth}/>}

      </div>

      {tab!=="leaderboard"&&tab!=="admin"&&tab!=="predictions"&&tab!=="bets"&&(
        <div style={{ marginTop:24, display:"flex", justifyContent:"center" }}>
          <Btn onClick={handleSave} disabled={saving||locks?.groups} bg={G4} color={WHT}
            style={{ minWidth:180, padding:"12px" }}>
            {saving?"Saving...":(locks?.groups||REGISTRATION_LOCKED)?"🔒 Picks Locked":"💾 Save My Picks"}
          </Btn>
        </div>
      )}
      <div style={{ textAlign:"center", marginTop:20, color:"rgba(255,255,255,0.08)", fontSize:10 }}>
        June 11 – July 19, 2026 · USA · Canada · Mexico
      </div>
    </div>
  </div>;
}
