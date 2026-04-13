import { useState, useRef, useEffect, useCallback, useMemo } from "react";

// ─── BRAND & DESIGN TOKENS ────────────────────────────────────────────────────
const BRAND = {
  navy:    "#0F2942",
  navyMid: "#1A3A5C",
  teal:    "#00A878",
  tealLight:"#00C896",
  gold:    "#F5A623",
  white:   "#FFFFFF",
  offWhite:"#F7F9FC",
  border:  "#E4ECF4",
  textMain:"#0F2942",
  textSub: "#5C7A9A",
  textMuted:"#94A8BE",
  card:    "#FFFFFF",
  pink:    "#E8476A",
  purple:  "#7C5CBF",
  green:   "#00A878",
};

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Playfair+Display:wght@700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{background:#F7F9FC;color:#0F2942;font-family:'Nunito',sans-serif;-webkit-font-smoothing:antialiased;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:.35;transform:scale(.65)}50%{opacity:1;transform:scale(1)}}
  @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
  @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
  ::-webkit-scrollbar{width:4px}
  ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:4px}
  textarea,input,select{font-family:'Nunito',sans-serif;}
  select option{background:#fff;color:#0F2942;}
  a{color:#00A878;}
  input[type=range]{-webkit-appearance:none;width:100%;height:5px;border-radius:4px;outline:none;cursor:pointer;}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#00A878;cursor:pointer;box-shadow:0 2px 8px rgba(0,168,120,.4);}
`;


// ─── PRICING ENGINE ───────────────────────────────────────────────────────────
const PROV = [
  {id:"irishLife",  name:"Irish Life",    logo:"🟢", rating:"A",
   quoteUrl:"https://www.irishlife.ie/life-insurance/get-a-quote/",
   pensionUrl:"https://www.irishlife.ie/pensions/get-a-quote/",
   savingsUrl:"https://www.irishlife.ie/investments/"},
  {id:"zurich",     name:"Zurich Life",   logo:"🔵", rating:"AA-",
   quoteUrl:"https://www.zurich.ie/insurance/life-insurance/",
   pensionUrl:"https://www.zurich.ie/pensions/",
   savingsUrl:"https://www.zurich.ie/investments/"},
  {id:"aviva",      name:"Aviva",         logo:"🟡", rating:"A+",
   quoteUrl:"https://www.aviva.ie/insurance/life-insurance/",
   pensionUrl:"https://www.aviva.ie/pensions/",
   savingsUrl:"https://www.aviva.ie/investments/"},
  {id:"royalLondon",name:"Royal London",  logo:"🟣", rating:"A+",
   quoteUrl:"https://www.royallondon.com/ireland/insurance/",
   pensionUrl:"https://www.royallondon.com/ireland/pensions/",
   savingsUrl:"https://www.royallondon.com/ireland/"},
  {id:"nnLife",     name:"NN Life",       logo:"🟠", rating:"A",
   quoteUrl:"https://www.nn.ie/life-insurance/",
   pensionUrl:"https://www.nn.ie/pensions/",
   savingsUrl:"https://www.nn.ie/"},
];
const BASE_LIFE   = {irishLife:12.5, zurich:12.8, aviva:12.2, royalLondon:12.9, nnLife:11.8};
const BASE_SI     = {irishLife:28,   zurich:27,   aviva:26,   royalLondon:29,   nnLife:25.5};
const BASE_IP     = {irishLife:22,   zurich:21,   aviva:20,   royalLondon:23,   nnLife:20.5};

function lifeQ(age, female, smoker, cover, term, pid) {
  const b = BASE_LIFE[pid] * (cover/100000);
  return Math.max(4.99, +(b * Math.pow(1.055, Math.max(0,age-30)) * (smoker?2.1:1) * (female?.85:1) * (term<=15?.88:term<=20?1:term<=25?1.14:1.28)).toFixed(2));
}
function siQ(age, female, smoker, cover, term, pid) {
  const b = BASE_SI[pid] * (cover/100000);
  return Math.max(9.99, +(b * Math.pow(1.07, Math.max(0,age-30)) * (smoker?2.4:1) * (female?.9:1) * (term<=15?.85:term<=20?1:term<=25?1.18:1.38)).toFixed(2));
}
function ipQ(age, female, smoker, income, deferWks, term, occMult, pid) {
  const b = BASE_IP[pid] * (income*.75/10000);
  const df = deferWks===4?1.4:deferWks===8?1.2:deferWks===13?1:deferWks===26?.82:.68;
  return Math.max(19.99, +(b * Math.pow(1.065, Math.max(0,age-30)) * (smoker?1.6:1) * (female?1.15:1) * df * occMult * (term<=15?.9:1)).toFixed(2));
}

function cfpNeeds(age, income, hasKids, hasMortgage) {
  const ytr = Math.max(5, 66 - age);
  return {
    life: {
      amount: Math.round((income*10 + (hasMortgage?income*3.5:0) + (hasKids?income*2:0))/10000)*10000,
      term: Math.min(ytr, 35),
    },
    si: { amount: Math.round(income*3/10000)*10000, term: Math.min(ytr,30) },
    ip: { amount: Math.round(income*.75), term: ytr },
  };
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────
function useLS(key, def) {
  const [v, setV] = useState(() => { try { const s=localStorage.getItem(key); return s?JSON.parse(s):def; } catch{return def;} });
  const set = useCallback(fn => setV(p => { const n=typeof fn==="function"?fn(p):fn; try{localStorage.setItem(key,JSON.stringify(n));}catch{} return n; }), [key]);
  return [v, set];
}

// ─── SYSTEM PROMPTS ───────────────────────────────────────────────────────────
function sysPrompt(modId, profile, goal) {
  const p = profile || {};
  const age = Number(p.age)||35;
  const income = Number(p.income)||50000;
  const hasKids = p.dependants && p.dependants !== "No dependants";
  const hasMortgage = p.homeowner === "Yes — with mortgage";
  const needs = cfpNeeds(age, income, hasKids, hasMortgage);

  const goalCtx = goal ? `\nThe user is specifically focused on this goal: "${goal.label}" — ${goal.desc}. Keep your advice focused on helping them achieve this goal.\n` : "";

  const providerLinks = `
DIRECT QUOTE LINKS — when recommending a provider or when the user asks where to get a quote or how to apply, include the relevant direct link:
• Irish Life (life/protection): https://www.irishlife.ie/life-insurance/get-a-quote/
• Irish Life (pension): https://www.irishlife.ie/pensions/get-a-quote/
• Irish Life (investments): https://www.irishlife.ie/investments/
• Zurich (life/protection): https://www.zurich.ie/insurance/life-insurance/
• Zurich (pension): https://www.zurich.ie/pensions/
• Zurich (investments): https://www.zurich.ie/investments/
• Aviva (life/protection): https://www.aviva.ie/insurance/life-insurance/
• Aviva (pension): https://www.aviva.ie/pensions/
• Royal London (life/protection): https://www.royallondon.com/ireland/insurance/
• Royal London (pension): https://www.royallondon.com/ireland/pensions/
• NN Life (life/protection): https://www.nn.ie/life-insurance/
• Vhi Healthcare: https://www.vhi.ie/health-insurance
• Laya Healthcare: https://www.layahealthcare.ie/healthinsurance/
• An Post State Savings: https://www.statesavings.ie/
• Help to Buy scheme: https://www.revenue.ie/en/property/help-to-buy-incentive/index.aspx
• First Home Scheme: https://www.firsthomescheme.ie/
• Local Authority Home Loan: https://localauthorityhomeloan.ie/
• My Pension (PRSA checker): https://www.mypension.ie/
• Revenue pension info: https://www.revenue.ie/en/jobs-and-pensions/pensions/index.aspx
• CCPC money tools: https://www.ccpc.ie/consumers/money/

IMPORTANT RULE: NEVER tell the user to "consult a financial adviser", "speak to a broker", or "seek professional advice". YOU are their financial adviser. Give direct, confident, actionable advice. When they ask where to get a quote or how to proceed, give them the direct link above. After giving advice, always tell them their next concrete step and link them directly there.
`;

  const priceCtx = modId === "protection" ? `
LIVE INDICATIVE PRICES FOR ${p.name||"this user"} (age ${age}, non-smoker, standard occupation):

LIFE COVER — €${needs.life.amount.toLocaleString("en-IE")} over ${needs.life.term} years:
${PROV.map(pr => `  • ${pr.name}: €${lifeQ(age,false,false,needs.life.amount,needs.life.term,pr.id).toFixed(2)}/month — get a quote: ${pr.quoteUrl}`).sort().join("\n")}

SERIOUS ILLNESS — €${needs.si.amount.toLocaleString("en-IE")} over ${needs.si.term} years:
${PROV.map(pr => `  • ${pr.name}: €${siQ(age,false,false,needs.si.amount,needs.si.term,pr.id).toFixed(2)}/month — get a quote: ${pr.quoteUrl}`).sort().join("\n")}

INCOME PROTECTION — €${needs.ip.amount.toLocaleString("en-IE")}/year (13-week deferral):
${PROV.map(pr => `  • ${pr.name}: €${ipQ(age,false,false,income,13,needs.ip.term,1,pr.id).toFixed(2)}/month — get a quote: ${pr.quoteUrl}`).sort().join("\n")}

RULE: When asked about costs or prices, ALWAYS show these numbers directly. Format as a clear list sorted cheapest first. Include the direct quote link beside each provider. Never say "use the calculator". Smoker rates are ~2x higher. After showing prices, tell them exactly how to proceed — click the link, start the application, what information they'll need.
` : "";

  const base = {
    budgeting: `You are a confident, friendly Irish financial planning expert specialising in budgeting. You ARE the financial adviser — give direct, actionable advice. Reference PAYE/PRSI/USC, Irish cost of living. Give numbered action plans in plain English. Be concise — 3 to 5 clear points maximum. When recommending a next step, give the direct link.`,
    cashflow:  `You are a confident, friendly Irish cash flow planning expert. You ARE the financial adviser. Help project income and expenses using Irish realities. Give concrete steps. Be concise — 3 to 5 clear points maximum. When a next step involves a product or tool, give the direct link.`,
    protection:`You are a confident, friendly Irish protection planning expert. You ARE the financial adviser. Use Irish terms: serious illness cover, income protection, life assurance, mortgage protection. CFP rules: 10× income life cover, 3× income serious illness, 75% income protection. Tax relief on IP premiums at marginal rate. Mortgage protection legally required. ALWAYS give prices when asked — use the figures above, sorted cheapest first, with direct quote links. Be concise and clear.`,
    savings:   `You are a confident, friendly Irish savings and investment expert. You ARE the financial adviser. Cover DIRT (33%), exit tax (41%, 8-year deemed disposal), pension first, An Post State Savings (DIRT-exempt), no ISAs in Ireland. Give direct recommendations and links. Be concise — 3 to 5 clear points maximum.`,
    pensions:  `You are a confident, friendly Irish pension planning expert. You ARE the financial adviser. Cover PRSAs, RACs, auto-enrolment, State Contributory Pension (~€277/week, age 66), PRSI, tax relief at marginal rate (15%–40% age-based), SFT €2m. Give direct, concise advice — 3 to 5 clear points maximum. Link to relevant provider or Revenue page.`,
    mortgages: `You are a confident, friendly Irish mortgage expert. You ARE the financial adviser. Central Bank rules: LTI 4× FTBs, 3.5× others; LTV 90% FTBs, 80% others. Help to Buy up to €30k, First Home Scheme, Local Authority Home Loan. Stamp duty 1%/2%. Be concise — 3 to 5 clear points maximum. Link directly to the relevant scheme.`,
    publicsector: `You are a confident, friendly expert in Irish public sector employment, pensions and benefits. You ARE the financial adviser. You have deep knowledge of all Irish public sector pension schemes and workplace benefits. Cover the following comprehensively:

PENSION SCHEMES:
- Single Public Service Pension Scheme (Single Scheme): for staff recruited from 1 Jan 2013. Career-average scheme. Pension = 1/80th of pensionable remuneration per year + lump sum = 3/80ths per year. Normal Pension Age (NPA) linked to State Pension age (currently 66, rising to 67 in 2031, 68 in 2039). Minimum 2 years to vest.
- Pre-2013 "Integrated" schemes (civil servants, teachers, gardaí, nurses, etc.): Final salary schemes. Pension = 1/80th of final salary × years service + lump sum = 3/80ths × years. Coordinated with State Pension. Normal retirement age 65 (some 60 or 55 for uniformed grades). Fast accrual for some grades.
- Preserved benefits: if leaving before retirement with 2+ years service, pension is preserved to NPA.
- PRD (Pension-Related Deduction / "pension levy"): abolished in 2019.
- Pension tax-free lump sum: up to €200,000 tax-free.

SECTOR-SPECIFIC SCHEMES: Teachers (DES), Gardaí (enhanced/fast-accrual), Defence Forces, Nurses/Midwives (enhanced), Civil Service, Local Authority, HSE, Education, An Garda Síochána, Prison Officers (different NPAs and accrual rates). Ask the user which sector they work in to give specific advice.

ADDITIONAL VOLUNTARY CONTRIBUTIONS (AVCs):
- Public sector workers can top up pension with AVCs via their employer's AVC provider (often Irish Life, Cornmarket, or Zurich).
- Cornmarket Group Financial Services is the main AVC provider for many public sector workers: https://www.cornmarket.ie/avc
- Tax relief on AVCs at marginal rate.
- Important: Single Scheme members in particular may have a significant gap between their projected pension and their desired retirement income — AVCs are essential to bridge this.

BENEFITS THROUGH WORK:
- Sick pay: Temporary Rehabilitation Remuneration (TRR) — 6 months full pay then 6 months half pay in any 4-year rolling period, then illness benefit. Critical illness protocol: extended pay for serious illness.
- Death in service: typically 1× annual salary lump sum (spouses/dependants pension also payable — varies by scheme).
- Maternity/paternity/parental leave: paid at full salary (maternity 26 weeks, paternity 2 weeks).
- Shorter Working Year/Work Sharing schemes available across most sectors.
- Career break entitlements.

USEFUL LINKS:
- Single Scheme info: https://www.singlepensionscheme.gov.ie/
- Department of Public Expenditure pension circulars: https://www.gov.ie/en/collection/6d8363-public-service-pensions/
- Cornmarket AVCs: https://www.cornmarket.ie/avc
- Revenue pension info: https://www.revenue.ie/en/jobs-and-pensions/pensions/index.aspx
- My pension estimate (public sector): https://www.mypension.ie/

Always ask the user which sector/grade they work in and what year they started so you can identify which pension scheme applies to them. Give concise, specific advice — 3 to 5 clear points.`,
  };

  const isPublicSector = p.employment && p.employment.startsWith("Public Sector");
  const sector = isPublicSector ? p.employment.replace("Public Sector — ","").replace("Public Sector","").trim() : "";
  const sectorCtx = isPublicSector ? `\nIMPORTANT: This user works in the Irish public sector (${sector||"general"}). When giving pension advice in ANY module, note that they are likely in a defined benefit public sector pension scheme (Single Scheme if started after Jan 2013, or a legacy final-salary scheme if before). Remind them their pension needs and AVC requirements may differ significantly from private sector workers. For pension-specific questions, refer them to the Public Sector module.\n` : "";

  const today = new Date().toLocaleDateString("en-IE",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  const webCtx = `Today is ${today}. You have web_search available but ONLY use it when the user specifically asks about something that may have changed recently — such as the current ECB rate, the latest Budget changes, or whether a specific scheme is still open. For all standard advice about Irish tax rules, CFP planning principles, pension contribution limits, Central Bank mortgage rules, and protection needs — answer directly from your knowledge without searching. Most questions do not require a search. Searching makes responses much slower so only do it when genuinely necessary.`;
  const profCtx = p.name ? `User: ${p.name}, age ${age}, ${p.employment||""}, €${income.toLocaleString("en-IE")} gross, ${p.dependants||"no dependants"}, ${p.homeowner||"not homeowner"}. Personalise all advice to their situation.` : "";

  return [profCtx, sectorCtx, goalCtx, providerLinks, priceCtx, webCtx, base[modId]].filter(Boolean).join("\n\n");
}

// ─── MODULES ──────────────────────────────────────────────────────────────────
const MODS = [
  {id:"budgeting",   icon:"💰", label:"Budgeting",             color:"#00A878", bg:"#E8F8F3", desc:"Manage your money day to day"},
  {id:"cashflow",    icon:"📊", label:"Cash Flow",             color:"#3B82F6", bg:"#EBF3FF", desc:"Plan ahead for big life moments"},
  {id:"protection",  icon:"🛡️", label:"Protection",            color:"#E8476A", bg:"#FEF0F3", desc:"Protect what matters most"},
  {id:"savings",     icon:"📈", label:"Savings & Investments",  color:"#7C5CBF", bg:"#F3EFFF", desc:"Grow your wealth over time"},
  {id:"pensions",    icon:"🏖️", label:"Pensions",              color:"#F5A623", bg:"#FEF8EE", desc:"Build the retirement you deserve"},
  {id:"mortgages",   icon:"🏠", label:"Mortgages",             color:"#0F2942", bg:"#EAF0F8", desc:"Get on the property ladder"},
  {id:"publicsector",icon:"🏛️", label:"Public Sector",         color:"#0EA5E9", bg:"#E0F2FE", desc:"Your pension & benefits explained"},
];

const STARTERS = {
  budgeting:    ["How do I build a budget from scratch?","I'm spending more than I earn — help!","How much emergency fund do I need?"],
  cashflow:     ["How do I forecast my cash flow?","I'm buying a house in 2 years — how to prepare?","How much buffer in my current account?"],
  protection:   ["How much cover do I need and what will it cost?","What's the difference between serious illness and income protection?","I'm self-employed — what protection do I need?"],
  savings:      ["Best way to invest €200/month in Ireland?","How does DIRT tax work?","Explain the 8-year deemed disposal rule on ETFs"],
  pensions:     ["How much should I contribute to my pension?","I'm 40 with no pension — is it too late?","How does pension tax relief work in Ireland?"],
  mortgages:    ["How much can I borrow for a mortgage?","Do I qualify for Help to Buy?","What are the costs of buying a first home?"],
  publicsector: ["What pension will I get when I retire from the public sector?","What happens to my pension if I leave a public sector job?","What sick pay and death in service benefits do I have?"],
};

// ─── API CALL ─────────────────────────────────────────────────────────────────
async function callClaude(messages, systemPrompt) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages,
      systemPrompt
    })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data.reply || "Sorry, I couldn't get a response. Please try again.";
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
const c = (color, a=1) => color; // passthrough

function Dots({color="#00A878"}) {
  return <span style={{display:"inline-flex",gap:5,alignItems:"center"}}>
    {[0,1,2].map(i=><span key={i} style={{width:8,height:8,borderRadius:"50%",background:color,display:"inline-block",animation:`pulse 1.2s ease infinite`,animationDelay:`${i*.2}s`}}/>)}
  </span>;
}

function Pill({children, color, active, onClick}) {
  return <button onClick={onClick} style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${active?color+"88":"rgba(255,255,255,0.1)"}`,background:active?color+"18":"transparent",color:active?color:"#5C7A9A",fontSize:12.5,fontWeight:active?700:400,cursor:"pointer",transition:"all .2s",fontFamily:"'Nunito',sans-serif",whiteSpace:"nowrap"}}>{children}</button>;
}

// ─── QUOTE TABLE ──────────────────────────────────────────────────────────────
function QuoteTable({quotes, color}) {
  const min = Math.min(...quotes.map(q=>q.monthly));
  return (
    <div style={{marginTop:4}}>
      {quotes.sort((a,b)=>a.monthly-b.monthly).map((q,i)=>(
        <div key={q.id} style={{padding:"12px 14px",background:i===0?"#E8F8F3":"#fff",border:`1px solid ${i===0?"#00A87833":"#E4ECF4"}`,borderRadius:11,marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>{q.logo}</span>
              <div>
                <div style={{color:"#0F2942",fontWeight:600,fontSize:13.5}}>{q.name}</div>
                {i===0 && <div style={{color:"#00A878",fontSize:10.5,fontWeight:700}}>LOWEST PRICE</div>}
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{color:i===0?"#00A878":color,fontWeight:700,fontSize:20,fontFamily:"'Playfair Display',serif"}}>€{q.monthly.toFixed(2)}</div>
              <div style={{color:"#5C7A9A",fontSize:11}}>/month · €{(q.monthly*12).toFixed(0)}/yr</div>
            </div>
          </div>
          <a href={q.quoteUrl} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"8px 14px",background:i===0?`${color}22`:"#F7F9FC",border:`1px solid ${i===0?color+"55":"#E4ECF4"}`,borderRadius:9,color:i===0?color:"#5C7A9A",fontSize:13,fontWeight:700,textDecoration:"none",transition:"all .2s"}}
            onMouseOver={e=>{e.currentTarget.style.background=`${color}33`;e.currentTarget.style.color=color;}}
            onMouseOut={e=>{e.currentTarget.style.background=i===0?`${color}22`:"#F7F9FC";e.currentTarget.style.color=i===0?color:"#5C7A9A";}}>
            Get a quote from {q.name} →
          </a>
        </div>
      ))}
      <div style={{padding:"9px 12px",background:"#fff",border:"1px solid #E4ECF4",borderRadius:9,marginTop:4}}>
        <div style={{color:"#5C7A9A",fontSize:11.5,lineHeight:1.5}}>ℹ️ Prices are indicative estimates based on standard rates. Actual premiums are confirmed when you complete your application with the provider.</div>
      </div>
    </div>
  );
}

// ─── PROTECTION CALCULATOR ────────────────────────────────────────────────────
function Calculator({profile}) {
  const age0  = Number(profile?.age)||35;
  const inc0  = Number(profile?.income)||50000;
  const need  = cfpNeeds(age0, inc0, profile?.dependants&&profile.dependants!=="No dependants", profile?.homeowner==="Yes — with mortgage");

  const [tab,   setTab]   = useState("life");
  const [age,   setAge]   = useState(age0);
  const [female,setFemale]= useState(false);
  const [smoker,setSmoker]= useState(false);
  const [occ,   setOcc]   = useState(1.0);
  const [lCover,setLC]    = useState(need.life.amount);
  const [lTerm, setLT]    = useState(need.life.term);
  const [sCover,setSC]    = useState(need.si.amount);
  const [sTerm, setST]    = useState(need.si.term);
  const [inc,   setInc]   = useState(inc0);
  const [defer, setDefer] = useState(13);
  const [iTerm, setIT]    = useState(need.ip.term);

  const lifeQ_ = useMemo(()=>PROV.map(p=>({...p,monthly:lifeQ(age,female,smoker,lCover,lTerm,p.id)})),[age,female,smoker,lCover,lTerm]);
  const siQ_   = useMemo(()=>PROV.map(p=>({...p,monthly:siQ(age,female,smoker,sCover,sTerm,p.id)})),[age,female,smoker,sCover,sTerm]);
  const ipQ_   = useMemo(()=>PROV.map(p=>({...p,monthly:ipQ(age,female,smoker,inc,defer,iTerm,occ,p.id)})),[age,female,smoker,inc,defer,iTerm,occ]);

  const color = tab==="life"?"#F472B6":tab==="si"?"#FBBF24":"#00A878";

  function Slider({label, val, min, max, step=1, set, fmt}) {
    return (
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{color:"#5C7A9A",fontSize:12.5}}>{label}</span>
          <span style={{color,fontWeight:700,fontSize:14,fontFamily:"'Playfair Display',serif"}}>{fmt?fmt(val):val}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={val} onChange={e=>set(Number(e.target.value))} style={{width:"100%",height:4,borderRadius:4,outline:"none",cursor:"pointer",appearance:"none",background:`linear-gradient(to right,${color} ${((val-min)/(max-min))*100}%,rgba(228,236,244,1) ${((val-min)/(max-min))*100}%)`}}/>
      </div>
    );
  }

  function Toggle({label, opts, val, set}) {
    return (
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{color:"#5C7A9A",fontSize:12.5}}>{label}</span>
        <div style={{display:"flex",background:"#F7F9FC",borderRadius:8,padding:3,gap:3}}>
          {opts.map(o=><button key={o.v} onClick={()=>set(o.v)} style={{padding:"5px 12px",borderRadius:6,border:"none",background:val===o.v?color:"transparent",color:val===o.v?"#0F2942":"#5C7A9A",fontWeight:600,fontSize:12,cursor:"pointer",transition:"all .2s"}}>{o.l}</button>)}
        </div>
      </div>
    );
  }

  // CFP summary cards
  const summaryItems = [
    {label:"Life Cover",    amount:need.life.amount,  color:"#F472B6", note:`${need.life.term} year term`},
    {label:"Serious Illness",amount:need.si.amount,   color:"#FBBF24", note:`${need.si.term} year term`},
    {label:"Income Protection",amount:need.ip.amount, color:"#00A878", note:"p.a. (75% income)"},
  ];

  return (
    <div style={{padding:"16px 0"}}>
      {/* CFP needs */}
      <div style={{marginBottom:18}}>
        <div style={{color:"rgba(255,255,255,0.65)",fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",marginBottom:10}}>CFP Recommended Cover</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {summaryItems.map(s=>(
            <div key={s.label} style={{flex:"1 1 140px",background:`${s.color}0C`,border:`1px solid ${s.color}33`,borderRadius:11,padding:"11px 13px"}}>
              <div style={{color:"#5C7A9A",fontSize:11,marginBottom:3}}>{s.label}</div>
              <div style={{color:s.color,fontWeight:700,fontSize:18,fontFamily:"'Playfair Display',serif"}}>€{s.amount.toLocaleString("en-IE")}</div>
              <div style={{color:"#5C7A9A",fontSize:11,marginTop:2}}>{s.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Personal controls */}
      <div style={{background:"#fff",border:"2px solid #E4ECF4",borderRadius:16,padding:"16px 18px",marginBottom:16,boxShadow:"0 2px 8px rgba(15,41,66,0.06)"}}>
        <div style={{color:"#5C7A9A",fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",marginBottom:12}}>Your Details</div>
        <Slider label="Age" val={age} min={18} max={70} set={setAge} />
        <Toggle label="Gender" opts={[{v:false,l:"Male"},{v:true,l:"Female"}]} val={female} set={setFemale}/>
        <Toggle label="Smoker" opts={[{v:false,l:"Non-Smoker"},{v:true,l:"Smoker"}]} val={smoker} set={setSmoker}/>
        <div style={{marginBottom:4}}>
          <div style={{color:"#5C7A9A",fontSize:12.5,marginBottom:7}}>Occupation</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {[{v:1.0,l:"Class 1"},{v:1.15,l:"Class 2"},{v:1.35,l:"Class 3"},{v:1.65,l:"Class 4"},{v:2.1,l:"Class 5"}].map(o=>(
              <button key={o.v} onClick={()=>setOcc(o.v)} style={{padding:"5px 11px",borderRadius:8,border:`1px solid ${occ===o.v?"#00A87866":"#E4ECF4"}`,background:occ===o.v?"#E8F8F3":"transparent",color:occ===o.v?"#00A878":"#5C7A9A",fontSize:12,fontWeight:600,cursor:"pointer"}}>{o.l}</button>
            ))}
          </div>
          <div style={{color:"#94A8BE",fontSize:11,marginTop:5}}>Class 1=Office · Class 2=Light manual · Class 3=Skilled trades · Class 4=Heavy manual · Class 5=High risk</div>
        </div>
      </div>

      {/* Product tabs */}
      <div style={{display:"flex",gap:4,marginBottom:14,background:"#fff",border:"1px solid #E4ECF4",borderRadius:10,padding:3}}>
        {[{id:"life",l:"Life Cover",c:"#F472B6"},{id:"si",l:"Serious Illness",c:"#FBBF24"},{id:"ip",l:"Income Protection",c:"#00A878"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"7px 4px",borderRadius:7,border:"none",background:tab===t.id?t.c+"22":"transparent",color:tab===t.id?t.c:"#5C7A9A",fontWeight:tab===t.id?700:400,fontSize:12.5,cursor:"pointer",transition:"all .2s",borderBottom:tab===t.id?`2px solid ${t.c}`:"2px solid transparent"}}>{t.l}</button>
        ))}
      </div>

      {/* Cover controls */}
      <div style={{background:"#fff",border:"2px solid #E4ECF4",borderRadius:16,padding:"16px 18px",marginBottom:16,boxShadow:"0 2px 8px rgba(15,41,66,0.06)"}}>
        {tab==="life" && <>
          <Slider label="Cover Amount" val={lCover} min={50000} max={2000000} step={10000} set={setLC} fmt={v=>`€${(v/1000).toFixed(0)}k`}/>
          <Slider label="Term (years)" val={lTerm} min={5} max={40} set={setLT}/>
          <div style={{padding:"8px 12px",background:"rgba(244,114,182,0.06)",border:"1px solid rgba(244,114,182,0.2)",borderRadius:9,color:"#F472B6",fontSize:12.5}}>€{lCover.toLocaleString("en-IE")} cover · {lTerm} years · expires age {age+lTerm}</div>
        </>}
        {tab==="si" && <>
          <Slider label="Cover Amount" val={sCover} min={25000} max={500000} step={5000} set={setSC} fmt={v=>`€${(v/1000).toFixed(0)}k`}/>
          <Slider label="Term (years)" val={sTerm} min={5} max={35} set={setST}/>
          <div style={{padding:"8px 12px",background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:9,color:"#FBBF24",fontSize:12.5}}>€{sCover.toLocaleString("en-IE")} lump sum on diagnosis of 50+ serious illnesses</div>
        </>}
        {tab==="ip" && <>
          <Slider label="Annual Income" val={inc} min={20000} max={250000} step={5000} set={setInc} fmt={v=>`€${(v/1000).toFixed(0)}k`}/>
          <div style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
              <span style={{color:"#5C7A9A",fontSize:12.5}}>Deferred Period</span>
              <span style={{color:"#00A878",fontWeight:700,fontSize:14}}>{defer} weeks</span>
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {[4,8,13,26,52].map(w=><button key={w} onClick={()=>setDefer(w)} style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${defer===w?"#00A87866":"rgba(255,255,255,0.1)"}`,background:defer===w?"#E8F8F3":"transparent",color:defer===w?"#00A878":"#5C7A9A",fontSize:12.5,fontWeight:600,cursor:"pointer"}}>{w}wks</button>)}
            </div>
            <div style={{color:"#94A8BE",fontSize:11,marginTop:5}}>Longer deferral = lower premium. Most employers pay 13 weeks sick pay.</div>
          </div>
          <Slider label="Benefit Term (years)" val={iTerm} min={5} max={40} set={setIT}/>
          <div style={{padding:"8px 12px",background:"rgba(52,211,153,0.06)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:9,color:"#00A878",fontSize:12.5}}>Max benefit: €{Math.round(inc*.75).toLocaleString("en-IE")}/yr · Premiums tax deductible</div>
        </>}
      </div>

      {/* Quotes */}
      <QuoteTable quotes={tab==="life"?lifeQ_:tab==="si"?siQ_:ipQ_} color={color}/>
    </div>
  );
}

// ─── CHAT ─────────────────────────────────────────────────────────────────────
function Chat({mod, profile, convs, setConvs, onBack, goal}) {
  const ac = mod.color;
  const msgs = convs[mod.id] || [];
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [searches, setSearches] = useState([]);
  const [panel, setPanel] = useState(null);
  const isProtection = mod.id === "protection";
  const bottom = useRef(null);
  const taRef = useRef(null);
  const didAutoSend = useRef(false);

  useEffect(()=>{ bottom.current?.scrollIntoView({behavior:"smooth"}); }, [msgs, loading]);

  // Auto-send the goal's first question if this is a fresh goal-focused session
  useEffect(()=>{
    if (goal?.firstQ && msgs.length === 0 && !didAutoSend.current) {
      didAutoSend.current = true;
      send(goal.firstQ);
    }
  }, []);

  const send = async (text) => {
    const t = (text||input).trim();
    if (!t || loading) return;
    setInput("");
    setSearches([]);
    const nm = [...msgs, {role:"user", content:t}];
    setConvs(p=>({...p, [mod.id]:nm}));
    setLoading(true);
    try {
      const reply = await callClaude(nm, sysPrompt(mod.id, profile, goal), (qs)=>setSearches(s=>[...s,...qs]));
      setConvs(p=>({...p, [mod.id]:[...nm, {role:"assistant", content:reply}]}));
    } catch {
      setConvs(p=>({...p, [mod.id]:[...nm, {role:"assistant", content:"Connection issue — please try again."}]}));
    }
    setLoading(false);
    setSearches([]);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:"#F7F9FC",overflow:"hidden"}}>
      <style>{G}</style>
      <div style={{background:BRAND.navy,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px"}}>
          <button onClick={onBack} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:10,padding:"9px 13px",cursor:"pointer",fontSize:13,fontWeight:800,flexShrink:0}}>← Back</button>
          <div style={{width:40,height:40,borderRadius:12,background:mod.bg||"#E8F8F3",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{goal?goal.icon:mod.icon}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{color:"#fff",fontWeight:800,fontSize:15,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{goal?goal.label:mod.label}{profile?.name?` · ${profile.name}`:""}</div>
            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:1}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:"#00A878",display:"inline-block"}}/>
              <span style={{color:"rgba(255,255,255,0.55)",fontSize:11,fontWeight:700}}>Live search · Ireland 🇮🇪</span>
            </div>
          </div>
          {msgs.length>0&&<button onClick={()=>setConvs(p=>({...p,[mod.id]:[]}))} style={{background:"#E4ECF4",border:"none",color:"rgba(255,255,255,0.6)",fontSize:12,cursor:"pointer",fontWeight:700,padding:"7px 11px",borderRadius:8,flexShrink:0}}>Clear</button>}
        </div>
        {isProtection&&(
          <div style={{display:"flex",borderTop:"1px solid rgba(255,255,255,0.1)",overflowX:"auto"}}>
            {[{id:null,l:"💬 Chat"},{id:"calc",l:"🛡️ Calculator"},{id:"providers",l:"🏢 Providers"},{id:"funds",l:"📈 Funds"}].map(t=>(
              <button key={String(t.id)} onClick={()=>setPanel(t.id)} style={{padding:"11px 15px",border:"none",borderBottom:panel===t.id?`3px solid ${mod.color}`:"3px solid transparent",background:"transparent",color:panel===t.id?"#fff":"rgba(255,255,255,0.45)",fontWeight:panel===t.id?800:600,fontSize:13,cursor:"pointer",whiteSpace:"nowrap",transition:"all .2s",fontFamily:"'Nunito',sans-serif"}}>{t.l}</button>
            ))}
          </div>
        )}
      </div>
      {panel&&isProtection&&(
        <div style={{flex:1,overflowY:"auto",padding:"16px 16px 24px",background:"#F7F9FC"}}>
          {panel==="calc"&&<Calculator profile={profile}/>}
          {panel==="providers"&&<ProviderList/>}
          {panel==="funds"&&<FundList/>}
        </div>
      )}
      {!panel&&(
        <>
          <div style={{flex:1,overflowY:"auto",padding:"16px",WebkitOverflowScrolling:"touch"}}>
            {msgs.length===0&&(
              <div style={{textAlign:"center",paddingTop:20,animation:"fadeUp .4s ease"}}>
                <div style={{width:68,height:68,borderRadius:20,background:mod.bg||"#E8F8F3",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,margin:"0 auto 16px",boxShadow:"0 4px 20px rgba(15,41,66,0.1)"}}>{goal?goal.icon:mod.icon}</div>
                <div style={{fontFamily:"'Playfair Display',serif",color:BRAND.navy,fontSize:22,fontWeight:800,marginBottom:8,lineHeight:1.2}}>{goal?goal.label:(profile?.name?`Hi ${profile.name}!`:mod.label)}</div>
                <div style={{color:BRAND.textSub,fontSize:14,maxWidth:320,margin:"0 auto 24px",lineHeight:1.7,fontWeight:500}}>{goal?goal.desc:(isProtection?"Ask me how much cover you need — I'll give you recommended amounts and real prices.":"Ask me anything about "+mod.label.toLowerCase()+" in Ireland.")}</div>
                <div style={{display:"flex",flexDirection:"column",gap:9,maxWidth:420,margin:"0 auto"}}>
                  {STARTERS[mod.id]?.map((q,i)=>(
                    <button key={i} onClick={()=>send(q)} style={{background:"#fff",border:`2px solid ${BRAND.border}`,color:BRAND.textMain,borderRadius:13,padding:"14px 18px",cursor:"pointer",fontSize:14.5,fontWeight:700,textAlign:"left",lineHeight:1.45,boxShadow:"0 2px 8px rgba(15,41,66,0.06)",transition:"all .2s"}}
                      onMouseOver={e=>{e.currentTarget.style.borderColor=mod.color;e.currentTarget.style.boxShadow=`0 4px 16px rgba(15,41,66,0.12)`;}}
                      onMouseOut={e=>{e.currentTarget.style.borderColor=BRAND.border;e.currentTarget.style.boxShadow="0 2px 8px rgba(15,41,66,0.06)";}}>
                      <span style={{color:mod.color,marginRight:10,fontSize:16}}>→</span>{q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m,i)=>{
              const isU=m.role==="user";
              return(
                <div key={i} style={{display:"flex",justifyContent:isU?"flex-end":"flex-start",marginBottom:14,animation:"fadeUp .3s ease"}}>
                  {!isU&&<div style={{width:36,height:36,borderRadius:"50%",background:mod.bg||"#E8F8F3",border:`2px solid ${mod.color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,marginRight:10}}>{mod.icon}</div>}
                  <div style={{maxWidth:"82%",background:isU?BRAND.navy:"#fff",color:isU?"#fff":BRAND.textMain,borderRadius:isU?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"13px 17px",fontSize:15,lineHeight:1.7,border:isU?"none":`1px solid ${BRAND.border}`,whiteSpace:"pre-wrap",fontWeight:500,boxShadow:isU?"0 4px 18px rgba(15,41,66,0.22)":"0 2px 10px rgba(15,41,66,0.08)"}}>{m.content}</div>
                </div>
              );
            })}
            {loading&&(
              <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:14}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:mod.bg||"#E8F8F3",border:`2px solid ${mod.color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{mod.icon}</div>
                <div style={{background:"#fff",border:`1px solid ${BRAND.border}`,borderRadius:"18px 18px 18px 4px",padding:"14px 18px",boxShadow:"0 2px 10px rgba(15,41,66,0.08)"}}>
                  {searches.length>0?<div><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}><span>🔍</span><span style={{color:BRAND.teal,fontSize:13.5,fontWeight:800}}>Checking latest information…</span></div>{searches.slice(-2).map((q,i)=><div key={i} style={{color:BRAND.textMuted,fontSize:12.5}}>› {q}</div>)}</div>:<Dots color={mod.color}/>}
                </div>
              </div>
            )}
            <div ref={bottom}/>
          </div>
          <div style={{padding:"12px 14px 16px",borderTop:`2px solid ${BRAND.border}`,background:"#fff",flexShrink:0}}>
            <div style={{display:"flex",gap:10,alignItems:"flex-end",background:"#F7F9FC",border:`2px solid ${BRAND.border}`,borderRadius:14,padding:"9px 9px 9px 16px",transition:"border-color .2s,box-shadow .2s"}}
              onFocusCapture={e=>{e.currentTarget.style.borderColor=mod.color;e.currentTarget.style.boxShadow=`0 0 0 3px ${mod.color}22`;}}
              onBlurCapture={e=>{e.currentTarget.style.borderColor=BRAND.border;e.currentTarget.style.boxShadow="none";}}>
              <textarea ref={taRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Type your question here…" rows={1} style={{flex:1,background:"transparent",border:"none",outline:"none",color:BRAND.textMain,fontSize:15,resize:"none",lineHeight:1.5,maxHeight:110,overflowY:"auto",paddingTop:3,fontWeight:600}}/>
              <button onClick={()=>send()} disabled={!input.trim()||loading} style={{width:44,height:44,borderRadius:12,border:"none",flexShrink:0,background:input.trim()&&!loading?mod.color:"#E4ECF4",color:input.trim()&&!loading?"#fff":BRAND.textMuted,cursor:input.trim()&&!loading?"pointer":"not-allowed",fontSize:20,fontWeight:900,transition:"all .2s",boxShadow:input.trim()&&!loading?`0 4px 16px ${mod.color}55`:"none"}}>↑</button>
            </div>
            <div style={{textAlign:"center",color:BRAND.textMuted,fontSize:11.5,marginTop:8,fontWeight:600}}>Prices shown are estimates — confirmed when you apply directly with the provider</div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── PROVIDER LIST ────────────────────────────────────────────────────────────
const PROVIDER_DATA = [
  {id:"irishLife",name:"Irish Life",logo:"🟢",rating:"A",share:"35%",type:"Life, Pension, Investment, Health",
   url:"https://www.irishlife.ie",quoteUrl:"https://www.irishlife.ie/life-insurance/get-a-quote/",pensionUrl:"https://www.irishlife.ie/pensions/get-a-quote/",
   notes:"Market leader. Offers Protect & Grow serious illness with comprehensive illness definitions. PRSA available online in minutes.",
   strengths:["Largest Irish insurer","Widest product range","Strong MyLife digital platform","ILIM investment funds"]},
  {id:"zurich",name:"Zurich Life",logo:"🔵",rating:"AA-",share:"18%",type:"Life, Pension, Investment",
   url:"https://www.zurich.ie",quoteUrl:"https://www.zurich.ie/insurance/life-insurance/",pensionUrl:"https://www.zurich.ie/pensions/",
   notes:"Particularly strong for executive pensions and ARFs. Excellent investment platform with 80+ funds.",
   strengths:["AA- financial rating","Strong investment platform","Competitive pension charges","80+ investment funds"]},
  {id:"aviva",name:"Aviva Life",logo:"🟡",rating:"A+",share:"14%",type:"Life, Pension, Investment",
   url:"https://www.aviva.ie",quoteUrl:"https://www.aviva.ie/insurance/life-insurance/",pensionUrl:"https://www.aviva.ie/pensions/",
   notes:"Often most competitive for income protection. Strong mortgage protection rates for younger borrowers.",
   strengths:["Competitive IP pricing","Strong underwriting flexibility","Good mortgage protection rates","A+ rating"]},
  {id:"royalLondon",name:"Royal London",logo:"🟣",rating:"A+",share:"10%",type:"Life, Pension",
   url:"https://www.royallondon.com/ireland",quoteUrl:"https://www.royallondon.com/ireland/insurance/",pensionUrl:"https://www.royallondon.com/ireland/pensions/",
   notes:"Mutual insurer — no shareholders, profits returned to members. 50+ conditions on serious illness cover.",
   strengths:["Mutual — no shareholders","50+ SI conditions","Competitive pricing","Strong for self-employed"]},
  {id:"nnLife",name:"NN Life",logo:"🟠",rating:"A",share:"8%",type:"Life, Pension",
   url:"https://www.nn.ie",quoteUrl:"https://www.nn.ie/life-insurance/",pensionUrl:"https://www.nn.ie/pensions/",
   notes:"Formerly ING Life. Often competitive for standard risks. Good online application process.",
   strengths:["Competitive term rates","Good for standard risks","Simple online journey","Flexible underwriting"]},
  {id:"vhi",name:"Vhi Healthcare",logo:"🩵",rating:"N/A",share:"50% (health)",type:"Health Insurance",
   url:"https://www.vhi.ie",quoteUrl:"https://www.vhi.ie/health-insurance",
   notes:"Ireland's largest health insurer, state-backed. Broadest hospital network. Community-rated plans.",
   strengths:["State-backed","Broadest network","50% market share","Community-rated"]},
  {id:"laya",name:"Laya Healthcare",logo:"💙",rating:"N/A",share:"26% (health)",type:"Health Insurance",
   url:"https://www.layahealthcare.ie",quoteUrl:"https://www.layahealthcare.ie/healthinsurance/",
   notes:"Part of AXA. Good value plans. Strong digital tools. Laya Flex plans popular.",
   strengths:["AXA group backing","Good value plans","Strong digital tools","Laya Flex plans"]},
  {id:"fbd",name:"FBD Insurance",logo:"🔴",rating:"A-",share:"12% (general)",type:"General Insurance",
   url:"https://www.fbd.ie",quoteUrl:"https://www.fbd.ie/insurance/",
   notes:"Ireland's only publicly-quoted Irish-owned insurer. Strong for farm, rural, and business insurance.",
   strengths:["Irish-owned & listed","Strong farm/rural cover","Business insurance","Local presence"]},
];

function ProviderList() {
  const [sel, setSel] = useState(null);
  if (sel) {
    const p = PROVIDER_DATA.find(x=>x.id===sel);
    return (
      <div>
        <button onClick={()=>setSel(null)} style={{background:"#F7F9FC",border:"1px solid #E4ECF4",color:"#5C7A9A",borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:12,fontWeight:600,marginBottom:14}}>← All Providers</button>
        <div style={{background:"#fff",border:"1px solid #E4ECF4",borderRadius:14,padding:"18px 16px"}}>
          <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:14}}>
            <span style={{fontSize:36}}>{p.logo}</span>
            <div>
              <div style={{color:"#0F2942",fontWeight:700,fontSize:20,fontFamily:"'Playfair Display',serif"}}>{p.name}</div>
              <div style={{color:"#5C7A9A",fontSize:12.5}}>{p.share} market share · Rated {p.rating}</div>
            </div>
          </div>
          <div style={{color:"#5C7A9A",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",marginBottom:6}}>Products</div>
          <div style={{color:"#5C7A9A",fontSize:13,marginBottom:14}}>{p.type}</div>
          <div style={{color:"#5C7A9A",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>Key Strengths</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:14}}>
            {p.strengths.map(s=><div key={s} style={{background:"#E8F8F3",border:"1px solid rgba(45,212,191,0.2)",borderRadius:8,padding:"5px 10px",color:"#5C7A9A",fontSize:12.5}}>✓ {s}</div>)}
          </div>
          <div style={{padding:"11px 13px",background:"#fff",border:"1px solid #E4ECF4",borderRadius:10,color:"#5C7A9A",fontSize:13,lineHeight:1.6,marginBottom:14}}>💡 {p.notes}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <a href={p.quoteUrl} target="_blank" rel="noopener noreferrer" style={{flex:"1 1 140px",display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 14px",background:"#E8F8F3",border:"1px solid rgba(45,212,191,0.3)",borderRadius:10,color:"#00A878",fontSize:13,fontWeight:700,textDecoration:"none"}}>Get a Quote →</a>
            {p.pensionUrl && <a href={p.pensionUrl} target="_blank" rel="noopener noreferrer" style={{flex:"1 1 140px",display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 14px",background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.3)",borderRadius:10,color:"#FBBF24",fontSize:13,fontWeight:700,textDecoration:"none"}}>Pension Info →</a>}
            <a href={p.url} target="_blank" rel="noopener noreferrer" style={{flex:"1 1 140px",display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 14px",background:"#F7F9FC",border:"1px solid #E4ECF4",borderRadius:10,color:"#5C7A9A",fontSize:13,fontWeight:700,textDecoration:"none"}}>Visit Website →</a>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{paddingBottom:20}}>
      <div style={{color:"#5C7A9A",fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",marginBottom:12}}>Irish Financial Providers</div>
      {PROVIDER_DATA.map(p=>(
        <div key={p.id} onClick={()=>setSel(p.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"#fff",border:"2px solid #E4ECF4",borderRadius:14,marginBottom:10,cursor:"pointer",transition:"all .2s",boxShadow:"0 1px 8px rgba(15,41,66,0.06)"}}
          onMouseOver={e=>e.currentTarget.style.borderColor="rgba(167,139,250,0.3)"}
          onMouseOut={e=>{e.currentTarget.style.borderColor="#E4ECF4";e.currentTarget.style.boxShadow="0 2px 8px rgba(15,41,66,0.06)";}}>
          <span style={{fontSize:28,flexShrink:0}}>{p.logo}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{color:"#0F2942",fontWeight:600,fontSize:14}}>{p.name}</div>
            <div style={{color:"#5C7A9A",fontSize:11.5}}>{p.type}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{color:"#5C7A9A",fontSize:12.5,fontWeight:600}}>{p.share}</div>
            <div style={{color:"#5C7A9A",fontSize:11}}>Rated {p.rating}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── FUND LIST ────────────────────────────────────────────────────────────────
const RC = {1:"#00A878",2:"#6EE7B7",3:"#FBBF24",4:"#F59E0B",5:"#F97316",6:"#EF4444",7:"#DC2626"};
const RL = {1:"Very Low",2:"Low",3:"Low-Med",4:"Medium",5:"Med-High",6:"High",7:"Very High"};
const FUNDS = [
  {id:"f1",name:"Irish Life Consensus Fund",provider:"Irish Life (ILIM)",type:"Multi-Asset",risk:4,ter:0.75,desc:"Tracks average Irish pension fund allocation. Diversified across global equities, bonds and property.",access:"PRSA, Pension, ARF, Bond",popular:true},
  {id:"f2",name:"Zurich Balanced Fund",provider:"Zurich Life",type:"Multi-Asset",risk:4,ter:0.80,desc:"Actively managed balanced portfolio with global equity and bond exposure.",access:"PRSA, Pension, ARF",popular:true},
  {id:"f3",name:"ILIM Indexed World Equity",provider:"Irish Life (ILIM)",type:"Index/Passive",risk:6,ter:0.35,desc:"Ultra low-cost passive fund tracking global equities (MSCI World). UCITS compliant.",access:"PRSA, Pension, ARF, Bond",popular:true},
  {id:"f4",name:"Irish Life Global Equity",provider:"Irish Life (ILIM)",type:"Global Equity",risk:6,ter:0.65,desc:"Passive global equity fund tracking MSCI World Index. 1,600+ companies.",access:"PRSA, Pension, ARF, Bond"},
  {id:"f5",name:"Zurich ESG Managed Fund",provider:"Zurich Life",type:"ESG/Sustainable",risk:4,ter:0.95,desc:"Invests in companies with strong ESG credentials. Excludes fossil fuels.",access:"PRSA, Pension, ARF"},
  {id:"f6",name:"Aviva Responsible Growth",provider:"Aviva Life",type:"ESG/Sustainable",risk:5,ter:1.0,desc:"Sustainable multi-asset fund with exclusion screens for tobacco, weapons, high-carbon.",access:"PRSA, Pension"},
  {id:"f7",name:"Irish Life Property Fund",provider:"Irish Life (ILIM)",type:"Property",risk:4,ter:1.1,desc:"Irish and UK commercial property — offices, retail, industrial. Regular income element.",access:"PRSA, Pension, ARF, Bond"},
  {id:"f8",name:"Irish Life Cash Fund",provider:"Irish Life (ILIM)",type:"Cash",risk:1,ter:0.30,desc:"Capital preservation. Short-term deposits and money market instruments.",access:"PRSA, Pension, ARF, Bond"},
  {id:"f9",name:"An Post State Savings",provider:"An Post / NTMA",type:"State Savings",risk:1,ter:0,desc:"Government-backed. DIRT-exempt. 3, 5 and 10-year bonds, instalment savings, prize bonds.",access:"Direct with An Post",popular:true},
  {id:"f10",name:"Zurich Prisma 4 PRSA",provider:"Zurich Life",type:"PRSA",risk:4,ter:1.0,desc:"PRSA linked to Zurich's Prisma multi-asset range. Tax-efficient pension saving.",access:"Direct or via broker"},
];

function FundList() {
  const [riskF, setRiskF] = useState("all");
  const [sel, setSel] = useState(null);
  const filtered = FUNDS.filter(f=>riskF==="all"||f.risk===Number(riskF));

  if (sel) {
    const f = FUNDS.find(x=>x.id===sel);
    return (
      <div>
        <button onClick={()=>setSel(null)} style={{background:"#F7F9FC",border:"1px solid #E4ECF4",color:"#5C7A9A",borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:12,fontWeight:600,marginBottom:14}}>← All Funds</button>
        <div style={{background:"#fff",border:"1px solid #E4ECF4",borderRadius:14,padding:"18px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,gap:10}}>
            <div>
              <div style={{color:"#0F2942",fontWeight:700,fontSize:18,fontFamily:"'Playfair Display',serif",marginBottom:6}}>{f.name}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <span style={{background:`${RC[f.risk]}18`,border:`1px solid ${RC[f.risk]}33`,color:RC[f.risk],fontSize:11,borderRadius:6,padding:"2px 8px",fontWeight:600}}>Risk {f.risk}/7 — {RL[f.risk]}</span>
                <span style={{background:"#E8F8F3",border:"1px solid rgba(52,211,153,0.3)",color:"#00A878",fontSize:11,borderRadius:6,padding:"2px 8px",fontWeight:600}}>{f.type}</span>
                {f.popular&&<span style={{background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.3)",color:"#FBBF24",fontSize:11,borderRadius:6,padding:"2px 8px",fontWeight:600}}>⭐ Popular</span>}
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{color:"#5C7A9A",fontSize:11}}>Annual charge</div>
              <div style={{color:"#F472B6",fontWeight:700,fontSize:22,fontFamily:"'Playfair Display',serif"}}>{f.ter===0?"Free":f.ter+"%"}</div>
            </div>
          </div>
          <div style={{color:"#5C7A9A",fontSize:13.5,lineHeight:1.7,marginBottom:14}}>{f.desc}</div>
          <div style={{color:"#5C7A9A",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",marginBottom:7}}>How to Access</div>
          <div style={{color:"#1A3A5C",fontSize:13,marginBottom:14}}>{f.access}</div>
          <div style={{color:"#5C7A9A",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",marginBottom:4}}>Provider</div>
          <div style={{color:"#1A3A5C",fontSize:13,marginBottom:14}}>{f.provider}</div>
          <div style={{padding:"10px 12px",background:"rgba(251,191,36,0.05)",border:"1px solid rgba(251,191,36,0.18)",borderRadius:9,color:"#FBBF24",fontSize:11.5,lineHeight:1.5}}>⚠️ Past performance is not a guide to future returns. Read the KIID before investing.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{paddingBottom:20}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <div style={{color:"#5C7A9A",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",flexShrink:0}}>Filter by risk</div>
        <select value={riskF} onChange={e=>setRiskF(e.target.value)} style={{flex:1,background:"#F7F9FC",border:"2px solid #E4ECF4",borderRadius:8,padding:"7px 10px",color:"#0F2942",fontSize:13,outline:"none"}}>
          <option value="all">All risk levels</option>
          {[1,2,3,4,5,6,7].map(r=><option key={r} value={r}>Risk {r} — {RL[r]}</option>)}
        </select>
      </div>
      {filtered.map(f=>(
        <div key={f.id} onClick={()=>setSel(f.id)} style={{padding:"14px 16px",background:"#fff",border:"2px solid #E4ECF4",borderRadius:14,marginBottom:10,cursor:"pointer",transition:"all .2s",boxShadow:"0 1px 8px rgba(15,41,66,0.06)"}}
          onMouseOver={e=>e.currentTarget.style.borderColor="rgba(52,211,153,0.3)"}
          onMouseOut={e=>e.currentTarget.style.borderColor="#E4ECF4"}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div style={{color:"#0F2942",fontWeight:600,fontSize:14,paddingRight:8}}>{f.name}{f.popular&&<span style={{color:"#FBBF24",marginLeft:6,fontSize:12}}>⭐</span>}</div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{color:"#F472B6",fontWeight:700,fontSize:14}}>{f.ter===0?"Free":f.ter+"%"}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
            <span style={{background:`${RC[f.risk]}15`,border:`1px solid ${RC[f.risk]}33`,color:RC[f.risk],fontSize:10.5,borderRadius:5,padding:"2px 7px",fontWeight:600}}>Risk {f.risk} — {RL[f.risk]}</span>
            <span style={{background:"#F7F9FC",color:"#5C7A9A",fontSize:10.5,borderRadius:5,padding:"2px 7px"}}>{f.type}</span>
          </div>
          <div style={{color:"#5C7A9A",fontSize:12.5}}>{f.provider}</div>
        </div>
      ))}
    </div>
  );
}

// ─── GOALS DASHBOARD ──────────────────────────────────────────────────────────
const GOAL_TPLS = [
  {id:"emergency",label:"Emergency Fund",      icon:"🛡️",color:"#00A878",bg:"#E8F8F3",mod:"budgeting",
   desc:"Build a safety net of 3–6 months' expenses",
   firstQ:"How do I build an emergency fund? How much do I need and what's the best way to save for it in Ireland?"},
  {id:"house",    label:"Buy a Home",          icon:"🏠",color:"#0F2942",bg:"#EAF0F8",mod:"mortgages",
   desc:"Get on the property ladder in Ireland",
   firstQ:"I want to buy a home in Ireland. How much can I borrow, what deposit do I need, and what schemes are available to me?"},
  {id:"retire",   label:"Retire Comfortably",  icon:"🏖️",color:"#F5A623",bg:"#FEF8EE",mod:"pensions",
   desc:"Plan and fund the retirement you want",
   firstQ:"I want to retire comfortably in Ireland. How much should I be saving into my pension, and am I on track?"},
  {id:"invest",   label:"Grow Investments",    icon:"📈",color:"#7C5CBF",bg:"#F3EFFF",mod:"savings",
   desc:"Put your money to work and grow your wealth",
   firstQ:"I want to start growing my investments in Ireland. What are my options and how should I get started?"},
  {id:"debt",      label:"Become Debt Free",       icon:"✂️",color:"#E8476A",bg:"#FEF0F3",mod:"budgeting",
   desc:"Clear debt and take back control",
   firstQ:"I want to become debt free. Can you help me create a plan to pay off my debts as quickly as possible?"},
  {id:"protect",   label:"Protect My Family",       icon:"❤️",color:"#E8476A",bg:"#FEF0F3",mod:"protection",
   desc:"Make sure your family is covered no matter what",
   firstQ:"I want to make sure my family is properly protected. How much cover do I need and what will it cost?"},
  {id:"publicsector",label:"Public Sector Benefits", icon:"🏛️",color:"#0EA5E9",bg:"#E0F2FE",mod:"publicsector",
   desc:"Understand your pension and benefits as a public sector worker",
   firstQ:"I work in the public sector in Ireland. Can you explain my pension scheme, what I'll receive at retirement, and what other benefits I'm entitled to?"},
];

function GoalsFocus({profile, convs, setConvs, onOpenMod, onShowAll, ret, healthScore, onCheckIn}) {
  const selectedGoals = GOAL_TPLS.filter(g => (profile.goals||[]).includes(g.id));
  const name = profile.name || "there";
  if (selectedGoals.length === 0) { onShowAll(); return null; }

  return (
    <div style={{minHeight:"100vh",background:"#F7F9FC",fontFamily:"'Nunito',sans-serif"}}>
      <style>{G}</style>
      {/* Top bar */}
      <div style={{background:BRAND.navy,padding:"0 20px"}}>
        <div style={{maxWidth:600,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:"#00A878",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>💚</div>
            <div>
              <div style={{color:"#fff",fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:800,letterSpacing:"-.3px"}}>MoneyMentor</div>
              <div style={{color:"rgba(255,255,255,0.5)",fontSize:10.5,fontWeight:600,letterSpacing:".05em"}}>IRELAND 🇮🇪</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {(ret?.streakCount||0)>0&&<div style={{background:"rgba(245,166,35,0.2)",border:"1px solid rgba(245,166,35,0.4)",borderRadius:8,padding:"5px 9px",display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:13}}>🔥</span><span style={{color:"#F5A623",fontWeight:800,fontSize:12}}>{ret.streakCount}</span></div>}
            <button onClick={onShowAll} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>All Topics</button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{background:`linear-gradient(135deg, ${BRAND.navy} 0%, #1A3A5C 100%)`,padding:"28px 20px 32px"}}>
        <div style={{maxWidth:600,margin:"0 auto",textAlign:"center"}}>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",fontWeight:700,letterSpacing:".08em",marginBottom:8}}>WELCOME BACK</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:800,color:"#fff",marginBottom:6,lineHeight:1.2}}>Hello, {name}! 👋</div>
              <div style={{color:"rgba(255,255,255,0.65)",fontSize:14}}>
                {!ret?.lastCheckIn||Math.floor((Date.now()-new Date(ret.lastCheckIn).getTime())/86400000)>=7?"Your weekly check-in is ready 🗓️":"Your goals are waiting — let's keep going."}
              </div>
            </div>
            {healthScore&&<div style={{textAlign:"center",flexShrink:0}}><div style={{position:"relative",width:56,height:56}}><svg width="56" height="56" style={{transform:"rotate(-90deg)"}}><circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5"/><circle cx="28" cy="28" r="22" fill="none" stroke={healthScore>=70?"#00A878":healthScore>=40?"#F5A623":"#E8476A"} strokeWidth="5" strokeDasharray={`${(healthScore/100)*138.2} 138.2`} strokeLinecap="round"/></svg><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:"#fff"}}>{healthScore}</div></div><div style={{color:"rgba(255,255,255,0.6)",fontSize:10,fontWeight:700,marginTop:3}}>Money Score</div></div>}
          </div>
          {onCheckIn&&(!ret?.lastCheckIn||Math.floor((Date.now()-new Date(ret?.lastCheckIn).getTime())/86400000)>=7)&&(
            <button onClick={onCheckIn} style={{marginTop:14,width:"100%",padding:"12px",background:"#00A878",border:"none",borderRadius:12,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 4px 16px rgba(0,168,120,0.4)"}}>
              <span>🗓️</span> Start This Week's Check-In (+25 pts)
            </button>
          )}
        </div>
      </div>

      {/* Goals */}
      <div style={{maxWidth:600,margin:"0 auto",padding:"24px 16px 40px"}}>
        <div style={{fontSize:12,color:BRAND.textMuted,fontWeight:800,letterSpacing:".08em",textTransform:"uppercase",marginBottom:14}}>Your Financial Goals</div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {selectedGoals.map((g,i) => {
            const mod = MODS.find(m => m.id === g.mod);
            const msgCount = (convs[g.mod]||[]).length;
            const hasChat = msgCount > 0;
            return (
              <div key={g.id} onClick={()=>{ if(mod) onOpenMod(mod, g); }}
                style={{background:"#fff",borderRadius:16,padding:"18px 20px",cursor:"pointer",
                  boxShadow:"0 2px 12px rgba(15,41,66,0.08)",border:`2px solid ${hasChat?g.color+"44":"#E4ECF4"}`,
                  transition:"all .2s",animation:`fadeUp .4s ease ${i*.08}s both`}}
                onMouseOver={e=>{e.currentTarget.style.borderColor=g.color;e.currentTarget.style.boxShadow=`0 6px 24px rgba(15,41,66,0.14)`;e.currentTarget.style.transform="translateY(-2px)";}}
                onMouseOut={e=>{e.currentTarget.style.borderColor=hasChat?g.color+"44":"#E4ECF4";e.currentTarget.style.boxShadow="0 2px 12px rgba(15,41,66,0.08)";e.currentTarget.style.transform="none";}}>
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:52,height:52,borderRadius:14,background:g.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{g.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <div style={{color:BRAND.textMain,fontWeight:800,fontSize:16}}>{g.label}</div>
                      {hasChat && <span style={{background:g.color,color:"#fff",fontSize:10,borderRadius:20,padding:"2px 8px",fontWeight:800}}>{Math.floor(msgCount/2)} chats</span>}
                    </div>
                    <div style={{color:BRAND.textSub,fontSize:13.5,marginBottom:10,lineHeight:1.5}}>{g.desc}</div>
                    <div style={{display:"inline-flex",alignItems:"center",gap:6,background:g.bg,borderRadius:8,padding:"6px 12px"}}>
                      <span style={{color:g.color,fontWeight:800,fontSize:13}}>{hasChat?"Continue conversation →":"Start talking →"}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Explore more */}
        <div style={{marginTop:28,textAlign:"center"}}>
          <div style={{color:BRAND.textMuted,fontSize:13,marginBottom:12}}>Want to explore other topics?</div>
          <button onClick={onShowAll} style={{background:"#fff",border:`2px solid ${BRAND.border}`,color:BRAND.textSub,borderRadius:12,padding:"12px 24px",cursor:"pointer",fontSize:14,fontWeight:700,boxShadow:"0 2px 8px rgba(15,41,66,0.06)"}}>
            Browse All Advisors →
          </button>
        </div>
      </div>
    </div>
  );
}

function Goals({goals, setGoals, onOpenMod}) {
  const [adding, setAdding] = useState(false);
  const [ng, setNg] = useState({tplId:"",label:"",target:"",current:"0",deadline:""});
  const total = goals.reduce((s,g)=>s+(Number(g.current)||0),0);
  const tTotal = goals.reduce((s,g)=>s+(Number(g.target)||0),0);
  const pct = tTotal>0?Math.min(100,Math.round((total/tTotal)*100)):0;

  return (
    <div>
      {/* Summary */}
      <div style={{background:"linear-gradient(135deg,#0F2942 0%,#1A3A5C 100%)",border:"none",borderRadius:18,padding:"20px",marginBottom:18,boxShadow:"0 6px 24px rgba(15,41,66,0.2)"}}>
        <div style={{color:"#5C7A9A",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",marginBottom:10}}>Overall Progress</div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <div style={{flex:1,height:7,background:"#fff",borderRadius:4,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:"linear-gradient(90deg,#2DD4BF,#818CF8)",transition:"width .5s"}}/></div>
          <span style={{color:"#0F2942",fontWeight:700,fontSize:16,fontFamily:"'Playfair Display',serif"}}>{pct}%</span>
        </div>
        <div style={{display:"flex",gap:18}}>
          <div><div style={{color:"#5C7A9A",fontSize:10.5}}>SAVED</div><div style={{color:"#00A878",fontWeight:700,fontSize:17,fontFamily:"'Playfair Display',serif"}}>€{total.toLocaleString("en-IE")}</div></div>
          <div><div style={{color:"#5C7A9A",fontSize:10.5}}>TARGET</div><div style={{color:"#0F2942",fontWeight:700,fontSize:17,fontFamily:"'Playfair Display',serif"}}>€{tTotal.toLocaleString("en-IE")}</div></div>
          <div><div style={{color:"#5C7A9A",fontSize:10.5}}>GOALS</div><div style={{color:"#0F2942",fontWeight:700,fontSize:17,fontFamily:"'Playfair Display',serif"}}>{goals.length}</div></div>
        </div>
      </div>

      {/* Goals */}
      {goals.map(g=>{
        const tpl = GOAL_TPLS.find(t=>t.id===g.tplId)||{color:"#00A878",icon:"🎯",mod:"budgeting"};
        const p = g.target>0?Math.min(100,Math.round((Number(g.current)/Number(g.target))*100)):0;
        return (
          <div key={g.id} style={{background:"#fff",border:"2px solid #E4ECF4",borderRadius:14,padding:"16px",marginBottom:12,boxShadow:"0 1px 8px rgba(15,41,66,0.06)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div style={{display:"flex",gap:9,alignItems:"center"}}>
                <div style={{width:34,height:34,borderRadius:9,background:`${tpl.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{tpl.icon}</div>
                <div><div style={{color:"#0F2942",fontWeight:600,fontSize:14}}>{g.label}</div>{g.deadline&&<div style={{color:"#5C7A9A",fontSize:11}}>by {g.deadline}</div>}</div>
              </div>
              <button onClick={()=>setGoals(p=>p.filter(x=>x.id!==g.id))} style={{background:"transparent",border:"none",color:"#94A8BE",cursor:"pointer",fontSize:17,lineHeight:1}}>×</button>
            </div>
            <div style={{marginBottom:9}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#5C7A9A",fontSize:12}}>€{Number(g.current).toLocaleString("en-IE")}</span><span style={{color:tpl.color,fontSize:12,fontWeight:600}}>{p}%</span></div>
              <div style={{height:5,background:"#fff",borderRadius:3,overflow:"hidden"}}><div style={{width:`${p}%`,height:"100%",background:tpl.color,transition:"width .5s"}}/></div>
              <div style={{textAlign:"right",color:"#94A8BE",fontSize:10.5,marginTop:2}}>Target: €{Number(g.target).toLocaleString("en-IE")}</div>
            </div>
            <div style={{display:"flex",gap:7}}>
              <input type="number" value={g.current} onChange={e=>setGoals(p=>p.map(x=>x.id===g.id?{...x,current:e.target.value}:x))} placeholder="Current €" style={{flex:1,background:"#F7F9FC",border:"1px solid #E4ECF4",borderRadius:7,padding:"6px 9px",color:"#0F2942",fontSize:13,outline:"none"}}/>
              <button onClick={()=>{ const m=MODS.find(m=>m.id===tpl.mod); if(m)onOpenMod(m); }} style={{background:`${tpl.color}18`,border:`1px solid ${tpl.color}44`,color:tpl.color,borderRadius:7,padding:"6px 10px",fontSize:12,cursor:"pointer",fontWeight:600}}>Advice →</button>
            </div>
          </div>
        );
      })}

      {/* Add goal */}
      {!adding ? (
        <button onClick={()=>setAdding(true)} style={{width:"100%",padding:"13px",background:"#fff",border:"2px dashed #CBD5E0",borderRadius:12,color:"#5C7A9A",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span style={{color:"#00A878",fontSize:18}}>+</span> Add a goal
        </button>
      ) : (
        <div style={{background:"#F7F9FC",border:"1px solid rgba(45,212,191,0.3)",borderRadius:12,padding:"16px"}}>
          <div style={{color:"#0F2942",fontWeight:600,fontSize:14,marginBottom:12}}>New Goal</div>
          <div style={{marginBottom:9}}>
            <label style={{color:"#5C7A9A",fontSize:11.5,display:"block",marginBottom:4}}>Type</label>
            <select value={ng.tplId} onChange={e=>{const t=GOAL_TPLS.find(x=>x.id===e.target.value);setNg(n=>({...n,tplId:e.target.value,label:t?.label||n.label}));}} style={{width:"100%",background:"#F7F9FC",border:"2px solid #E4ECF4",borderRadius:8,padding:"8px 10px",color:"#0F2942",fontSize:13,outline:"none"}}>
              <option value="">Select type…</option>
              {GOAL_TPLS.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
            </select>
          </div>
          {[{k:"label",l:"Goal name",ph:"e.g. House deposit",t:"text"},{k:"target",l:"Target (€)",ph:"e.g. 40000",t:"number"},{k:"current",l:"Current (€)",ph:"e.g. 5000",t:"number"},{k:"deadline",l:"Target date",ph:"e.g. Dec 2027",t:"text"}].map(f=>(
            <div key={f.k} style={{marginBottom:9}}>
              <label style={{color:"#5C7A9A",fontSize:11.5,display:"block",marginBottom:4}}>{f.l}</label>
              <input type={f.t} value={ng[f.k]} onChange={e=>setNg(n=>({...n,[f.k]:e.target.value}))} placeholder={f.ph} style={{width:"100%",background:"#F7F9FC",border:"2px solid #E4ECF4",borderRadius:8,padding:"8px 10px",color:"#0F2942",fontSize:13,outline:"none"}}/>
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={()=>{if(!ng.label||!ng.target)return;setGoals(p=>[...p,{...ng,id:Date.now()}]);setAdding(false);setNg({tplId:"",label:"",target:"",current:"0",deadline:""});}} style={{flex:1,padding:"9px",background:"#00A878",border:"none",borderRadius:9,color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer"}}>Add Goal</button>
            <button onClick={()=>setAdding(false)} style={{padding:"9px 14px",background:"#F7F9FC",border:"1px solid #E4ECF4",borderRadius:9,color:"#5C7A9A",fontWeight:600,fontSize:13,cursor:"pointer"}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────
function History({convs, setConvs, onOpenMod}) {
  const total = Object.values(convs).reduce((s,m)=>s+(m?.length||0),0);
  return (
    <div>
      {MODS.map(mod=>{
        const msgs = convs[mod.id]||[];
        if (!msgs.length) return null;
        return (
          <div key={mod.id} style={{background:"#fff",border:"2px solid #E4ECF4",borderRadius:14,marginBottom:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(15,41,66,0.06)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderBottom:"1px solid #E4ECF4",cursor:"pointer"}} onClick={()=>onOpenMod(mod)}>
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                <div style={{width:30,height:30,borderRadius:8,background:`${mod.color}18`,border:`1.5px solid ${mod.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:mod.color}}>{mod.icon}</div>
                <div><div style={{color:"#0F2942",fontWeight:600,fontSize:13.5}}>{mod.label}</div><div style={{color:"#5C7A9A",fontSize:11}}>{Math.floor(msgs.length/2)} exchanges</div></div>
              </div>
              <div style={{display:"flex",gap:7}}>
                <button onClick={e=>{e.stopPropagation();onOpenMod(mod);}} style={{background:`${mod.color}18`,border:`1px solid ${mod.color}44`,color:mod.color,borderRadius:7,padding:"4px 10px",fontSize:11.5,cursor:"pointer",fontWeight:600}}>Continue →</button>
                <button onClick={e=>{e.stopPropagation();setConvs(p=>({...p,[mod.id]:[]}))} } style={{background:"transparent",border:"none",color:"#F87171",fontSize:12,cursor:"pointer",fontWeight:600}}>Clear</button>
              </div>
            </div>
            <div style={{padding:"10px 14px",maxHeight:160,overflowY:"auto"}}>
              {msgs.slice(-4).map((m,i)=>(
                <div key={i} style={{display:"flex",gap:7,marginBottom:6}}>
                  <span style={{fontSize:10,fontWeight:700,color:m.role==="user"?mod.color:"#5C7A9A",minWidth:42,paddingTop:1,flexShrink:0}}>{m.role==="user"?"You":"Advisor"}</span>
                  <span style={{color:"#5C7A9A",fontSize:12.5,lineHeight:1.5}}>{m.content.slice(0,100)}{m.content.length>100?"…":""}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {total===0&&<div style={{textAlign:"center",padding:"40px 20px"}}><div style={{fontSize:32,marginBottom:10}}>💬</div><div style={{color:"#0F2942",fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:7}}>No conversations yet</div><div style={{color:"#5C7A9A",fontSize:13}}>Start chatting with an advisor to build your history</div></div>}
    </div>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
const OB_STEPS = [
  {id:"welcome",title:"Your money,\nclearer than ever",sub:"MoneyMentor gives you personalised financial guidance tailored to Ireland — in plain English, no jargon.",fields:[]},
  {id:"basics",title:"Let's get to know you",sub:"We'll use this to personalise your advice.",fields:[{k:"name",l:"Your first name",t:"text",ph:"e.g. Seán"},{k:"age",l:"Your age",t:"number",ph:"e.g. 35"}]},
  {id:"money",title:"Your finances",sub:"Rough figures are fine — this helps us give relevant advice.",fields:[{k:"income",l:"Approximate gross annual income (€)",t:"number",ph:"e.g. 60,000"},{k:"employment",l:"Your employment status",t:"select",opts:["PAYE Employee (Private Sector)","Public Sector — Civil Service","Public Sector — Teacher","Public Sector — Nurse / HSE","Public Sector — Garda","Public Sector — Defence Forces","Public Sector — Local Authority","Public Sector — Other","Self-employed / Sole Trader","Company Director","Part-time","Not currently working","Retired"]}]},
  {id:"life",title:"Your life situation",sub:"This helps us tailor your protection and mortgage advice.",fields:[{k:"dependants",l:"Do you have dependants?",t:"select",opts:["No dependants","1 child","2 children","3+ children","Other dependants"]},{k:"homeowner",l:"Are you a homeowner?",t:"select",opts:["No — renting privately","No — living with family","Yes — with a mortgage","Yes — mortgage free"]}]},
  {id:"goals",title:"What are your goals?",sub:"Pick everything you'd like to work towards. You can change these any time.",fields:[{k:"goals",t:"goals"}]},
];

function Onboarding({onDone}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({});
  const [anim, setAnim] = useState(false);
  const cur = OB_STEPS[step];
  const isLast = step===OB_STEPS.length-1;
  const next = ()=>{ setAnim(true); setTimeout(()=>{ setAnim(false); isLast?onDone(data):setStep(s=>s+1); }, 220); };
  const sf = (k,v) => setData(d=>({...d,[k]:v}));
  const pct = Math.round((step/(OB_STEPS.length-1))*100);

  return (
    <div style={{minHeight:"100vh",background:"#F7F9FC",display:"flex",flexDirection:"column"}}>
      <style>{G}</style>

      {/* Top brand bar */}
      <div style={{background:BRAND.navy,padding:"14px 20px",display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:32,height:32,borderRadius:9,background:"#00A878",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>💚</div>
        <div style={{fontFamily:"'Playfair Display',serif",color:"#fff",fontSize:18,fontWeight:800,letterSpacing:"-.3px"}}>MoneyMentor</div>
      </div>

      {/* Progress bar */}
      {step > 0 && (
        <div style={{height:4,background:"#E4ECF4"}}>
          <div style={{height:"100%",width:`${pct}%`,background:"#00A878",transition:"width .4s ease",borderRadius:"0 4px 4px 0"}}/>
        </div>
      )}

      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 20px"}}>
        <div style={{width:"100%",maxWidth:440,opacity:anim?0:1,transition:"opacity .22s",animation:"fadeUp .4s ease"}}>

          {step===0 ? (
            /* Welcome screen */
            <div style={{textAlign:"center"}}>
              <div style={{width:80,height:80,borderRadius:22,background:"#00A878",display:"flex",alignItems:"center",justifyContent:"center",fontSize:38,margin:"0 auto 24px",boxShadow:"0 8px 32px rgba(0,168,120,.3)"}}>💚</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:800,color:BRAND.navy,marginBottom:12,lineHeight:1.2,whiteSpace:"pre-line"}}>{cur.title}</div>
              <div style={{color:BRAND.textSub,fontSize:15,lineHeight:1.7,marginBottom:32,maxWidth:360,margin:"0 auto 32px"}}>{cur.sub}</div>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:32,textAlign:"left"}}>
                {[["🇮🇪","Built specifically for Ireland"],["💬","Plain English — no financial jargon"],["🔍","Live market data & real prices"],["🎯","Personalised to your goals"]].map(([icon,text])=>(
                  <div key={text} style={{display:"flex",alignItems:"center",gap:12,background:"#fff",borderRadius:12,padding:"12px 16px",boxShadow:"0 1px 6px rgba(15,41,66,0.07)"}}>
                    <span style={{fontSize:20}}>{icon}</span>
                    <span style={{color:BRAND.textMain,fontWeight:700,fontSize:14}}>{text}</span>
                  </div>
                ))}
              </div>
              <button onClick={next} style={{width:"100%",padding:"16px",background:BRAND.teal,border:"none",borderRadius:14,color:"#fff",fontWeight:800,fontSize:16,cursor:"pointer",boxShadow:"0 6px 24px rgba(0,168,120,.35)",fontFamily:"'Nunito',sans-serif"}}>
                Get Started — it's free →
              </button>
            </div>
          ) : (
            /* Form steps */
            <div style={{background:"#fff",borderRadius:20,padding:"28px 24px",boxShadow:"0 4px 24px rgba(15,41,66,0.1)"}}>
              <div style={{fontSize:12,color:BRAND.textMuted,fontWeight:800,letterSpacing:".07em",marginBottom:16}}>STEP {step} OF {OB_STEPS.length-1}</div>
              <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:800,color:BRAND.navy,marginBottom:8,lineHeight:1.25}}>{cur.title}</h2>
              <p style={{color:BRAND.textSub,fontSize:14,marginBottom:24,lineHeight:1.6}}>{cur.sub}</p>

              <div style={{marginBottom:24}}>
                {cur.fields.map(f=>{
                  if(f.t==="goals") return (
                    <div key="goals" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      {GOAL_TPLS.map(g=>{ const sel=(data.goals||[]).includes(g.id); return(
                        <div key={g.id} onClick={()=>{const c=data.goals||[];sf("goals",sel?c.filter(x=>x!==g.id):[...c,g.id]);}}
                          style={{background:sel?g.bg:"#F7F9FC",border:`2px solid ${sel?g.color:BRAND.border}`,borderRadius:12,padding:"14px 12px",cursor:"pointer",transition:"all .2s",textAlign:"center"}}>
                          <div style={{fontSize:22,marginBottom:6}}>{g.icon}</div>
                          <div style={{color:sel?g.color:BRAND.textMain,fontSize:12.5,fontWeight:800,lineHeight:1.3}}>{g.label}</div>
                        </div>
                      );})}
                    </div>
                  );
                  if(f.t==="select") return (
                    <div key={f.k} style={{marginBottom:14}}>
                      <label style={{color:BRAND.textMain,fontSize:13.5,fontWeight:700,display:"block",marginBottom:6}}>{f.l}</label>
                      <select value={data[f.k]||""} onChange={e=>sf(f.k,e.target.value)}
                        style={{width:"100%",background:"#F7F9FC",border:`2px solid ${BRAND.border}`,borderRadius:10,padding:"12px 14px",color:data[f.k]?BRAND.textMain:BRAND.textMuted,fontSize:15,outline:"none",fontWeight:600}}>
                        <option value="" disabled>Tap to select…</option>
                        {f.opts.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  );
                  return (
                    <div key={f.k} style={{marginBottom:14}}>
                      <label style={{color:BRAND.textMain,fontSize:13.5,fontWeight:700,display:"block",marginBottom:6}}>{f.l}</label>
                      <input type={f.t} value={data[f.k]||""} onChange={e=>sf(f.k,e.target.value)} placeholder={f.ph}
                        onFocus={e=>{e.target.style.borderColor=BRAND.teal;e.target.style.boxShadow="0 0 0 3px rgba(0,168,120,.15)";}}
                        onBlur={e=>{e.target.style.borderColor=BRAND.border;e.target.style.boxShadow="none";}}
                        style={{width:"100%",background:"#F7F9FC",border:`2px solid ${BRAND.border}`,borderRadius:10,padding:"12px 14px",color:BRAND.textMain,fontSize:15,outline:"none",fontWeight:600,transition:"border-color .2s"}}/>
                    </div>
                  );
                })}
              </div>

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                {step>0
                  ? <button onClick={()=>setStep(s=>s-1)} style={{background:"#F7F9FC",border:`2px solid ${BRAND.border}`,color:BRAND.textSub,borderRadius:10,padding:"12px 18px",cursor:"pointer",fontSize:14,fontWeight:700}}>← Back</button>
                  : <div/>}
                <button onClick={next} style={{flex:1,padding:"14px",background:BRAND.teal,border:"none",borderRadius:10,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:"0 4px 16px rgba(0,168,120,.3)",fontFamily:"'Nunito',sans-serif"}}>
                  {isLast?"Start Planning 🎯":"Continue →"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── RETENTION ENGINE ─────────────────────────────────────────────────────────

const WEEKLY_TIPS = [
  { week: 0,  icon: "💡", title: "The 50/30/20 Rule",        body: "Split your take-home pay: 50% needs (rent, bills, food), 30% wants, 20% savings & debt. Even small steps count — start with 5% savings if that's all you can manage right now." },
  { week: 1,  icon: "📉", title: "USC & PRSI Explained",      body: "USC (Universal Social Charge) and PRSI are deducted before you see your pay. On €50k, you lose roughly €11k in tax, USC, and PRSI. Check your payslip — make sure your tax credits are applied correctly via Revenue MyAccount." },
  { week: 2,  icon: "🏦", title: "Emergency Fund First",      body: "Before investing anything, build 3 months' essential expenses in a separate savings account. An Post State Savings or a regular bank savings account works fine — the goal is accessibility, not return." },
  { week: 3,  icon: "🔒", title: "Pension Tax Relief",        body: "Every €100 you put into a pension costs you only €60 if you're a higher-rate taxpayer — the government tops up the rest. If your employer matches contributions, that's free money. Always contribute at least enough to get the full employer match." },
  { week: 4,  icon: "🏠", title: "Help to Buy Scheme",        body: "First-time buyers of new builds can claim back up to €30,000 in income tax paid. You must have paid enough tax — check your eligibility at Revenue.ie. This can dramatically reduce your deposit requirement." },
  { week: 5,  icon: "📊", title: "DIRT Tax on Savings",       body: "Interest on Irish deposit accounts is taxed at 33% DIRT automatically. An Post State Savings are exempt from DIRT — making them often the best option for short-term cash savings in Ireland." },
  { week: 6,  icon: "⚠️", title: "The ETF Tax Trap",          body: "ETFs in Ireland are taxed at 41% exit tax (vs 33% DIRT on deposits) and have an 8-year deemed disposal rule — even if you don't sell. For most Irish investors, maxing your pension first makes more sense before investing in ETFs." },
  { week: 7,  icon: "🛡️", title: "Income Protection",        body: "If you're unable to work due to illness, your employer may only pay you for 6 weeks. Income protection pays up to 75% of your salary until you return to work or retire. Premiums are tax deductible at your marginal rate in Ireland." },
  { week: 8,  icon: "📈", title: "Compound Interest",         body: "€200/month invested at 6% return over 30 years grows to over €200,000. The secret is starting early — the last 10 years of a 30-year investment generates more than the first 20. Start small, start now." },
  { week: 9,  icon: "🏡", title: "Mortgage Overpayment",      body: "Even €50/month extra off your mortgage can save thousands in interest and years off your term. Check your mortgage terms — most allow overpayments without penalty. Use the savings to build equity faster." },
  { week: 10, icon: "💼", title: "AVCs for Public Sector",    body: "If you joined the public sector after January 2013 you're in the Single Scheme, which may give you a lower pension than older colleagues. AVCs through Cornmarket let you top this up with full tax relief." },
  { week: 11, icon: "🌱", title: "Review Every Year",         body: "A 1-hour financial review every January can be worth thousands. Check: pension contributions, mortgage rate (are you still on a good deal?), insurance renewals, and whether your emergency fund is still topped up." },
];

const LEARNING_PATHS = [
  {
    id: "basics", label: "Money Basics", icon: "🌱", color: "#00A878",
    desc: "Master the essentials of managing money in Ireland",
    levels: [
      { id: "b1", title: "Understand your payslip", points: 10, mod: "budgeting", q: "Can you explain PAYE, PRSI and USC on my payslip and how they're calculated?" },
      { id: "b2", title: "Build your first budget", points: 15, mod: "budgeting", q: "Help me set up a 50/30/20 budget based on my income." },
      { id: "b3", title: "Start an emergency fund", points: 15, mod: "budgeting", q: "How do I build a 3-month emergency fund? Where should I keep it in Ireland?" },
      { id: "b4", title: "Understand DIRT tax", points: 10, mod: "savings",   q: "How does DIRT tax work on savings accounts in Ireland?" },
      { id: "b5", title: "Get tax credits right",  points: 20, mod: "budgeting", q: "What tax credits am I entitled to in Ireland and how do I claim them through Revenue?" },
    ]
  },
  {
    id: "protection", label: "Protection", icon: "🛡️", color: "#E8476A",
    desc: "Make sure you and your family are covered",
    levels: [
      { id: "p1", title: "Know your sick pay rights",        points: 10, mod: "protection",   q: "What sick pay am I entitled to in Ireland and what happens when it runs out?" },
      { id: "p2", title: "Understand life assurance",        points: 15, mod: "protection",   q: "Do I need life assurance and how much cover should I have?" },
      { id: "p3", title: "Serious illness cover explained",  points: 15, mod: "protection",   q: "What is serious illness cover in Ireland and do I need it?" },
      { id: "p4", title: "Set up income protection",         points: 20, mod: "protection",   q: "How much income protection do I need and what will it cost me?" },
      { id: "p5", title: "Review your mortgage protection",  points: 10, mod: "protection",   q: "What is mortgage protection and is what I have adequate?" },
    ]
  },
  {
    id: "wealth", label: "Building Wealth", icon: "📈", color: "#7C5CBF",
    desc: "Invest and grow your money the smart Irish way",
    levels: [
      { id: "w1", title: "Max your pension first",           points: 15, mod: "pensions", q: "Why should I prioritise my pension before other investments in Ireland?" },
      { id: "w2", title: "Understand the ETF tax rules",     points: 20, mod: "savings",  q: "Explain the 41% exit tax and 8-year deemed disposal rule on ETFs in Ireland." },
      { id: "w3", title: "An Post State Savings",            points: 10, mod: "savings",  q: "What are An Post State Savings and are they worth using?" },
      { id: "w4", title: "AVCs and extra pension top-ups",   points: 20, mod: "pensions", q: "What are AVCs and how do they work as a tax-efficient way to save more for retirement?" },
      { id: "w5", title: "Build an investment strategy",     points: 25, mod: "savings",  q: "I want to invest €300/month in Ireland. What's the most tax-efficient strategy?" },
    ]
  },
  {
    id: "property", label: "Property", icon: "🏠", color: "#0F2942",
    desc: "Navigate the Irish property market with confidence",
    levels: [
      { id: "pr1", title: "Central Bank mortgage rules",     points: 10, mod: "mortgages", q: "Explain the Central Bank LTI and LTV mortgage rules in Ireland." },
      { id: "pr2", title: "Help to Buy scheme",              points: 15, mod: "mortgages", q: "How does the Help to Buy scheme work and do I qualify?" },
      { id: "pr3", title: "First Home Scheme explained",     points: 15, mod: "mortgages", q: "What is the First Home Scheme and how is it different from Help to Buy?" },
      { id: "pr4", title: "Calculate what you can afford",   points: 20, mod: "mortgages", q: "Based on my income, how much can I borrow for a mortgage in Ireland?" },
      { id: "pr5", title: "Budget for buying costs",         points: 20, mod: "mortgages", q: "What are all the costs involved in buying a home in Ireland beyond the deposit?" },
    ]
  },
];

const CHECK_IN_QUESTIONS = [
  { id: "spend",  q: "How did your spending feel this week?",       opts: ["Under control 💪","About normal 👍","Overspent a bit 😬","Really overspent 😰"] },
  { id: "save",   q: "Did you put any money into savings this week?",opts: ["Yes, as planned ✅","A little 🌱","Not this week ❌","I don't have a savings habit yet"] },
  { id: "goal",   q: "How are you feeling about your financial goals?",opts:["Making great progress 🚀","Moving slowly 🐢","Stuck, need help 🆘","Haven't started yet"] },
  { id: "stress", q: "How stressed are you about money right now?",  opts: ["Not at all 😊","A little 😐","Quite stressed 😟","Very stressed 😰"] },
];

const BADGES = [
  { id: "first_chat",   icon: "💬", label: "First Conversation",  desc: "Had your first MoneyMentor chat",       points: 10 },
  { id: "week_streak",  icon: "🔥", label: "7-Day Streak",         desc: "Opened MoneyMentor 7 days in a row",    points: 50 },
  { id: "checkin_1",    icon: "✅", label: "First Check-In",       desc: "Completed your first weekly check-in",  points: 20 },
  { id: "checkin_4",    icon: "🏅", label: "Monthly Check-In",     desc: "4 weekly check-ins completed",          points: 100 },
  { id: "goal_set",     icon: "🎯", label: "Goal Setter",          desc: "Set your first financial goal",         points: 15 },
  { id: "goal_50",      icon: "⭐", label: "Halfway There",        desc: "Reached 50% on a financial goal",       points: 30 },
  { id: "goal_done",    icon: "🏆", label: "Goal Achieved!",       desc: "Completed a financial goal",            points: 200 },
  { id: "path_done",    icon: "🎓", label: "Learning Complete",    desc: "Finished a learning path",              points: 150 },
  { id: "lesson_5",     icon: "📚", label: "5 Lessons Done",       desc: "Completed 5 learning lessons",          points: 40 },
  { id: "all_topics",   icon: "🌟", label: "Explorer",             desc: "Asked questions in all 7 topic areas",  points: 75 },
];

// ─── RETENTION STATE HELPERS ──────────────────────────────────────────────────

function useRetention(profile) {
  const [ret, setRet] = useLS("mm_retention_v1", {
    streakCount: 0, lastVisit: null, totalDays: 0,
    checkIns: [], lastCheckIn: null,
    completedLessons: [], earnedBadges: [],
    healthScore: null, weeklyTipIndex: 0,
    totalPoints: 0,
  });

  // Update streak on mount
  useEffect(() => {
    const today = new Date().toDateString();
    setRet(r => {
      const last = r.lastVisit;
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      let streak = r.streakCount || 0;
      if (last === today) return r; // already visited today
      if (last === yesterday) streak += 1;
      else if (last && last !== today) streak = 1;
      else streak = 1;
      return { ...r, lastVisit: today, streakCount: streak, totalDays: (r.totalDays||0) + 1,
               weeklyTipIndex: Math.floor(((r.totalDays||0) + 1) / 7) % WEEKLY_TIPS.length };
    });
  }, []);

  const completeLesson = useCallback((lessonId) => {
    setRet(r => {
      if (r.completedLessons.includes(lessonId)) return r;
      const lessons = [...r.completedLessons, lessonId];
      const path = LEARNING_PATHS.find(p => p.levels.some(l => l.id === lessonId));
      const lesson = path?.levels.find(l => l.id === lessonId);
      const pts = (r.totalPoints||0) + (lesson?.points||10);
      // Check badge conditions
      const badges = [...(r.earnedBadges||[])];
      if (lessons.length === 1 && !badges.includes("lesson_5")) { /* first */ }
      if (lessons.length >= 5 && !badges.includes("lesson_5")) badges.push("lesson_5");
      if (path && path.levels.every(l => lessons.includes(l.id)) && !badges.includes("path_done")) badges.push("path_done");
      return { ...r, completedLessons: lessons, totalPoints: pts, earnedBadges: badges };
    });
  }, []);

  const addBadge = useCallback((badgeId) => {
    setRet(r => {
      if ((r.earnedBadges||[]).includes(badgeId)) return r;
      const badge = BADGES.find(b => b.id === badgeId);
      return { ...r, earnedBadges: [...(r.earnedBadges||[]), badgeId], totalPoints: (r.totalPoints||0) + (badge?.points||10) };
    });
  }, []);

  const saveCheckIn = useCallback((answers) => {
    setRet(r => {
      const today = new Date().toDateString();
      const checkIns = [...(r.checkIns||[]), { date: today, answers }];
      const badges = [...(r.earnedBadges||[])];
      if (!badges.includes("checkin_1")) badges.push("checkin_1");
      if (checkIns.length >= 4 && !badges.includes("checkin_4")) badges.push("checkin_4");
      return { ...r, checkIns, lastCheckIn: today, earnedBadges: badges, totalPoints: (r.totalPoints||0) + 25 };
    });
  }, []);

  // Compute health score from profile + retention data
  const healthScore = useMemo(() => {
    if (!profile) return null;
    let score = 40; // base
    const income = Number(profile.income) || 0;
    if (income > 0) score += 10;
    if (profile.homeowner === "Yes — mortgage free") score += 15;
    else if (profile.homeowner === "Yes — with a mortgage") score += 5;
    if (profile.employment && !profile.employment.includes("Not currently")) score += 5;
    if ((ret.checkIns||[]).length > 0) {
      const last = ret.checkIns[ret.checkIns.length - 1];
      if (last?.answers?.save?.includes("Yes")) score += 10;
      if (last?.answers?.spend?.includes("Under control")) score += 10;
      if (last?.answers?.stress?.includes("Not at all")) score += 5;
      if (last?.answers?.stress?.includes("Very stressed")) score -= 10;
    }
    if ((ret.completedLessons||[]).length > 0) score += Math.min(20, ret.completedLessons.length * 3);
    return Math.max(10, Math.min(99, score));
  }, [profile, ret.checkIns, ret.completedLessons]);

  return { ret, setRet, completeLesson, addBadge, saveCheckIn, healthScore };
}

// ─── WEEKLY CHECK-IN COMPONENT ────────────────────────────────────────────────

function WeeklyCheckIn({ onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const q = CHECK_IN_QUESTIONS[step];
  const isLast = step === CHECK_IN_QUESTIONS.length - 1;

  const pick = (opt) => {
    const newAnswers = { ...answers, [q.id]: opt };
    setAnswers(newAnswers);
    if (isLast) { onComplete(newAnswers); }
    else setStep(s => s + 1);
  };

  const feedback = {
    spend: answers.spend?.includes("Under control") ? "Great discipline! 💪" : answers.spend?.includes("Overspent") ? "That's okay — awareness is the first step. Let's look at your budget." : null,
    save:  answers.save?.includes("Yes") ? "Brilliant — every bit counts! 🌱" : answers.save?.includes("Not this week") ? "No worries — let's set a small automatic transfer to make it easier." : null,
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,41,66,0.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#fff",borderRadius:20,padding:"28px 24px",maxWidth:420,width:"100%",boxShadow:"0 20px 60px rgba(15,41,66,0.3)",animation:"fadeUp .35s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <div style={{fontSize:11,fontWeight:800,letterSpacing:".08em",color:BRAND.textMuted,textTransform:"uppercase"}}>WEEKLY CHECK-IN</div>
            <div style={{fontFamily:"'Playfair Display',serif",color:BRAND.navy,fontSize:20,fontWeight:800,marginTop:2}}>Quick Money Check 🗓️</div>
          </div>
          <button onClick={onSkip} style={{background:"transparent",border:"none",color:BRAND.textMuted,cursor:"pointer",fontSize:22,lineHeight:1}}>×</button>
        </div>

        {/* Progress dots */}
        <div style={{display:"flex",gap:6,marginBottom:24}}>
          {CHECK_IN_QUESTIONS.map((_,i) => (
            <div key={i} style={{flex:1,height:4,borderRadius:4,background:i<=step?BRAND.teal:BRAND.border,transition:"background .3s"}}/>
          ))}
        </div>

        <div style={{color:BRAND.textMain,fontSize:17,fontWeight:700,marginBottom:16,lineHeight:1.4}}>{q.q}</div>

        <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:16}}>
          {q.opts.map(opt => (
            <button key={opt} onClick={() => pick(opt)} style={{
              padding:"13px 16px",background:"#F7F9FC",border:`2px solid ${BRAND.border}`,
              borderRadius:12,cursor:"pointer",textAlign:"left",color:BRAND.textMain,
              fontSize:14.5,fontWeight:600,transition:"all .2s",
            }}
              onMouseOver={e=>{e.currentTarget.style.borderColor=BRAND.teal;e.currentTarget.style.background="#E8F8F3";}}
              onMouseOut={e=>{e.currentTarget.style.borderColor=BRAND.border;e.currentTarget.style.background="#F7F9FC";}}
            >{opt}</button>
          ))}
        </div>

        {feedback[q.id] && (
          <div style={{padding:"10px 14px",background:"#E8F8F3",border:"1px solid #00A87833",borderRadius:10,color:BRAND.teal,fontSize:13.5,fontWeight:600}}>
            {feedback[q.id]}
          </div>
        )}

        <div style={{textAlign:"center",marginTop:16,color:BRAND.textMuted,fontSize:12,fontWeight:600}}>
          Takes less than 2 minutes · +25 pts for completing
        </div>
      </div>
    </div>
  );
}

// ─── LEARNING PATHS COMPONENT ─────────────────────────────────────────────────

function LearningPaths({ completedLessons, onStartLesson }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <div style={{paddingBottom:16}}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {LEARNING_PATHS.map(path => {
          const done = path.levels.filter(l => completedLessons.includes(l.id)).length;
          const total = path.levels.length;
          const pct = Math.round((done/total)*100);
          const isOpen = expanded === path.id;
          const nextLesson = path.levels.find(l => !completedLessons.includes(l.id));

          return (
            <div key={path.id} style={{background:"#fff",border:`2px solid ${isOpen?path.color:BRAND.border}`,borderRadius:16,overflow:"hidden",boxShadow:"0 2px 10px rgba(15,41,66,0.07)",transition:"border-color .2s"}}>
              <div onClick={()=>setExpanded(isOpen?null:path.id)} style={{padding:"16px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:46,height:46,borderRadius:13,background:`${path.color}18`,border:`2px solid ${path.color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{path.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
                    <div style={{color:BRAND.textMain,fontWeight:800,fontSize:15}}>{path.label}</div>
                    <div style={{color:path.color,fontWeight:800,fontSize:13}}>{done}/{total}</div>
                  </div>
                  <div style={{height:6,background:BRAND.border,borderRadius:4,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:path.color,borderRadius:4,transition:"width .5s"}}/>
                  </div>
                  <div style={{color:BRAND.textSub,fontSize:12,marginTop:4}}>{path.desc}</div>
                </div>
              </div>

              {isOpen && (
                <div style={{borderTop:`1px solid ${BRAND.border}`,padding:"12px 18px 16px",background:"#F7F9FC"}}>
                  {path.levels.map((lesson, i) => {
                    const isDone = completedLessons.includes(lesson.id);
                    const isNext = lesson.id === nextLesson?.id;
                    return (
                      <div key={lesson.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<path.levels.length-1?`1px solid ${BRAND.border}`:"none"}}>
                        <div style={{width:28,height:28,borderRadius:"50%",background:isDone?path.color:isNext?`${path.color}22`:"#E4ECF4",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:isNext?`2px solid ${path.color}`:"none"}}>
                          {isDone ? <span style={{color:"#fff",fontSize:13,fontWeight:800}}>✓</span> : <span style={{color:isNext?path.color:BRAND.textMuted,fontSize:12,fontWeight:800}}>{i+1}</span>}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{color:isDone?BRAND.textSub:BRAND.textMain,fontWeight:isDone?600:700,fontSize:13.5,textDecoration:isDone?"line-through":"none"}}>{lesson.title}</div>
                          <div style={{color:BRAND.textMuted,fontSize:11.5}}>+{lesson.points} pts</div>
                        </div>
                        {!isDone && (
                          <button onClick={()=>onStartLesson(lesson)} style={{background:isNext?path.color:"#F7F9FC",border:`2px solid ${isNext?path.color:BRAND.border}`,color:isNext?"#fff":BRAND.textSub,borderRadius:9,padding:"7px 14px",cursor:"pointer",fontSize:13,fontWeight:700,flexShrink:0,transition:"all .2s"}}>
                            {isNext?"Start →":"Go →"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── BADGES COMPONENT ─────────────────────────────────────────────────────────

function BadgesPanel({ earnedBadges }) {
  return (
    <div style={{paddingBottom:16}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        {BADGES.map(badge => {
          const earned = earnedBadges.includes(badge.id);
          return (
            <div key={badge.id} style={{background:earned?"#fff":"#F7F9FC",border:`2px solid ${earned?BRAND.teal:BRAND.border}`,borderRadius:14,padding:"12px 14px",textAlign:"center",minWidth:80,flex:"1 1 80px",opacity:earned?1:.5,transition:"all .2s",boxShadow:earned?"0 2px 10px rgba(0,168,120,0.12)":"none"}}>
              <div style={{fontSize:24,marginBottom:5}}>{badge.icon}</div>
              <div style={{color:earned?BRAND.navy:BRAND.textMuted,fontSize:11.5,fontWeight:800,lineHeight:1.3}}>{badge.label}</div>
              {earned && <div style={{color:BRAND.teal,fontSize:10,marginTop:3,fontWeight:700}}>+{badge.points}pts</div>}
            </div>
          );
        })}
      </div>
      {earnedBadges.length === 0 && (
        <div style={{textAlign:"center",padding:"20px",color:BRAND.textMuted,fontSize:14}}>
          Complete your first conversation or check-in to earn your first badge! 🏅
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [profile, setProfile] = useLS("fp_ie2_profile", null);
  const [goals,   setGoals]   = useLS("fp_ie2_goals", []);
  const [convs,   setConvs]   = useLS("fp_ie2_convs", {});
  const [activeMod, setActiveMod] = useState(null);
  const [activeGoal, setActiveGoal] = useState(null);
  const [tab, setTab] = useState("home");
  const [showAll, setShowAll] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInDone, setCheckInDone] = useState(false);

  const { ret, setRet, completeLesson, addBadge, saveCheckIn, healthScore } = useRetention(profile);

  // Show weekly check-in prompt if it's been 7+ days since last check-in
  useEffect(() => {
    if (!profile) return;
    const today = new Date().toDateString();
    const last = ret.lastCheckIn;
    if (!last) { setTimeout(() => setShowCheckIn(true), 3000); return; }
    const daysSince = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
    if (daysSince >= 7) setTimeout(() => setShowCheckIn(true), 2000);
  }, [profile]);

  // Badge: first chat
  useEffect(() => {
    const totalMsgs = Object.values(convs).reduce((s,m)=>s+(m?.length||0),0);
    if (totalMsgs > 0) addBadge("first_chat");
  }, [convs]);

  // Badge: 7-day streak
  useEffect(() => {
    if (ret.streakCount >= 7) addBadge("week_streak");
  }, [ret.streakCount]);

  // Badge: all topics used
  useEffect(() => {
    const usedTopics = MODS.filter(m => (convs[m.id]||[]).length > 0).length;
    if (usedTopics >= MODS.length) addBadge("all_topics");
  }, [convs]);

  if (!profile) return <Onboarding onDone={p => { setProfile(p); setShowAll(false); }}/>;

  const openMod = (mod, goal=null) => { setActiveMod(mod); setActiveGoal(goal); };

  if (activeMod) return <Chat mod={activeMod} goal={activeGoal} profile={profile} convs={convs} setConvs={setConvs} onBack={()=>{ setActiveMod(null); setActiveGoal(null); }}/>;

  const hasGoals = (profile.goals||[]).length > 0;

  if (hasGoals && !showAll && tab === "home") {
    return (
      <>
        {showCheckIn && !checkInDone && (
          <WeeklyCheckIn
            onComplete={ans => { saveCheckIn(ans); setShowCheckIn(false); setCheckInDone(true); }}
            onSkip={() => setShowCheckIn(false)}
          />
        )}
        <GoalsFocus profile={profile} convs={convs} setConvs={setConvs} onOpenMod={openMod} onShowAll={()=>setShowAll(true)}
          ret={ret} healthScore={healthScore} onCheckIn={()=>setShowCheckIn(true)}/>
      </>
    );
  }

  // Weekly tip for this week
  const tip = WEEKLY_TIPS[ret.weeklyTipIndex % WEEKLY_TIPS.length];

  // Next recommended lesson
  const nextLesson = (() => {
    for (const path of LEARNING_PATHS) {
      const next = path.levels.find(l => !(ret.completedLessons||[]).includes(l.id));
      if (next) return { path, lesson: next };
    }
    return null;
  })();

  // Check-in due?
  const checkInDue = (() => {
    if (!ret.lastCheckIn) return true;
    return Math.floor((Date.now() - new Date(ret.lastCheckIn).getTime()) / 86400000) >= 7;
  })();

  return (
    <div style={{minHeight:"100vh",background:"#F7F9FC",fontFamily:"'Nunito',sans-serif"}}>
      <style>{G}</style>

      {showCheckIn && !checkInDone && (
        <WeeklyCheckIn
          onComplete={ans => { saveCheckIn(ans); setShowCheckIn(false); setCheckInDone(true); }}
          onSkip={() => setShowCheckIn(false)}
        />
      )}

      {/* Brand top bar */}
      <div style={{background:BRAND.navy,padding:"0 20px"}}>
        <div style={{maxWidth:800,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:10,background:"#00A878",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>💚</div>
            <div>
              <div style={{color:"#fff",fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:800,letterSpacing:"-.3px",lineHeight:1}}>MoneyMentor</div>
              <div style={{color:"rgba(255,255,255,0.45)",fontSize:10,fontWeight:700,letterSpacing:".06em"}}>IRELAND 🇮🇪</div>
            </div>
          </div>
          <div style={{display:"flex",gap:7,alignItems:"center"}}>
            {/* Streak badge */}
            {ret.streakCount > 0 && (
              <div style={{background:"rgba(245,166,35,0.2)",border:"1px solid rgba(245,166,35,0.4)",borderRadius:8,padding:"5px 10px",display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:14}}>🔥</span>
                <span style={{color:"#F5A623",fontWeight:800,fontSize:12}}>{ret.streakCount}</span>
              </div>
            )}
            {/* Points */}
            <div style={{background:"rgba(0,168,120,0.2)",border:"1px solid rgba(0,168,120,0.4)",borderRadius:8,padding:"5px 10px",display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:12}}>⭐</span>
              <span style={{color:"#6FDFBC",fontWeight:800,fontSize:12}}>{ret.totalPoints||0}pts</span>
            </div>
            {hasGoals && <button onClick={()=>{setShowAll(false);setTab("home");}} style={{background:"rgba(0,168,120,0.25)",border:"1px solid rgba(0,168,120,0.5)",color:"#6FDFBC",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:800}}>← My Goals</button>}
            <button onClick={()=>{setProfile(null);setShowAll(false);}} style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.7)",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>✎ Edit</button>
          </div>
        </div>
      </div>

      {/* Profile + Health Score strip */}
      <div style={{background:"#fff",borderBottom:"1px solid #E4ECF4",padding:"14px 20px"}}>
        <div style={{maxWidth:800,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",color:BRAND.navy,fontSize:17,fontWeight:800}}>Hello, {profile.name||"there"}! 👋</div>
            <div style={{color:BRAND.textSub,fontSize:13,marginTop:2}}>{profile.employment?`${profile.employment} · `:""}{profile.income?`€${Number(profile.income).toLocaleString("en-IE")} p.a.`:""}</div>
          </div>
          {healthScore && (
            <div style={{textAlign:"center",cursor:"pointer",flexShrink:0}} onClick={()=>setTab("score")}>
              <div style={{position:"relative",width:56,height:56,margin:"0 auto"}}>
                <svg width="56" height="56" style={{transform:"rotate(-90deg)"}}>
                  <circle cx="28" cy="28" r="22" fill="none" stroke={BRAND.border} strokeWidth="5"/>
                  <circle cx="28" cy="28" r="22" fill="none" stroke={healthScore>=70?"#00A878":healthScore>=40?"#F5A623":"#E8476A"} strokeWidth="5"
                    strokeDasharray={`${(healthScore/100)*138.2} 138.2`} strokeLinecap="round"/>
                </svg>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:BRAND.navy}}>{healthScore}</div>
              </div>
              <div style={{color:BRAND.textSub,fontSize:10.5,fontWeight:700,marginTop:3}}>Money Score</div>
            </div>
          )}
        </div>
      </div>

      <div style={{maxWidth:800,margin:"0 auto",padding:"16px 14px 80px"}}>

        {/* Tabs — now with Learn and Score */}
        <div style={{display:"flex",gap:3,marginBottom:16,background:"#fff",border:"1px solid #E4ECF4",borderRadius:12,padding:4,boxShadow:"0 1px 4px rgba(15,41,66,0.06)",overflowX:"auto"}}>
          {[
            {id:"home",   l:"Advisors"},
            {id:"learn",  l:"📚 Learn"},
            {id:"goals",  l:`Tracker${goals.length>0?` (${goals.length})`:""}`},
            {id:"badges", l:`🏅 Badges${(ret.earnedBadges||[]).length>0?` (${ret.earnedBadges.length})`:""}`},
            {id:"history",l:`History${Object.values(convs).some(m=>m?.length>0)?" ●":""}`},
          ].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:"0 0 auto",padding:"9px 12px",borderRadius:8,border:"none",background:tab===t.id?BRAND.navy:"transparent",color:tab===t.id?"#fff":BRAND.textSub,fontWeight:tab===t.id?800:600,fontSize:13,cursor:"pointer",transition:"all .2s",fontFamily:"'Nunito',sans-serif",whiteSpace:"nowrap"}}>{t.l}</button>
          ))}
        </div>

        {/* HOME TAB */}
        {tab==="home" && (
          <div style={{animation:"fadeUp .4s ease"}}>

            {/* Weekly Check-In Banner */}
            {checkInDue && !checkInDone && (
              <div onClick={()=>setShowCheckIn(true)} style={{background:`linear-gradient(135deg, #0F2942, #1A3A5C)`,borderRadius:16,padding:"16px 20px",marginBottom:16,cursor:"pointer",display:"flex",alignItems:"center",gap:14,boxShadow:"0 4px 20px rgba(15,41,66,0.2)"}}>
                <div style={{fontSize:32,flexShrink:0}}>🗓️</div>
                <div style={{flex:1}}>
                  <div style={{color:"#fff",fontWeight:800,fontSize:15,marginBottom:3}}>Weekly Check-In Ready</div>
                  <div style={{color:"rgba(255,255,255,0.65)",fontSize:13}}>2 minutes · Track your progress · +25 points</div>
                </div>
                <div style={{background:BRAND.teal,color:"#fff",borderRadius:10,padding:"8px 14px",fontWeight:800,fontSize:13,flexShrink:0}}>Start →</div>
              </div>
            )}
            {checkInDone && (
              <div style={{background:"#E8F8F3",border:"2px solid #00A87833",borderRadius:16,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:22}}>✅</span>
                <div style={{color:BRAND.teal,fontWeight:700,fontSize:14}}>Check-in complete! +25 points earned this week.</div>
              </div>
            )}

            {/* Weekly Tip */}
            <div style={{background:"#fff",border:`2px solid ${BRAND.border}`,borderRadius:16,padding:"16px 18px",marginBottom:16,boxShadow:"0 2px 10px rgba(15,41,66,0.06)"}}>
              <div style={{fontSize:10.5,fontWeight:800,letterSpacing:".08em",color:BRAND.textMuted,textTransform:"uppercase",marginBottom:8}}>💡 TIP OF THE WEEK</div>
              <div style={{color:BRAND.navy,fontWeight:800,fontSize:15,marginBottom:6}}>{tip.icon} {tip.title}</div>
              <div style={{color:BRAND.textSub,fontSize:13.5,lineHeight:1.6}}>{tip.body}</div>
            </div>

            {/* Next Recommended Lesson */}
            {nextLesson && (
              <div onClick={()=>{
                const mod = MODS.find(m=>m.id===nextLesson.lesson.mod);
                if (mod) { openMod(mod, { label: nextLesson.lesson.title, desc: nextLesson.path.desc, firstQ: nextLesson.lesson.q, icon: nextLesson.path.icon }); completeLesson(nextLesson.lesson.id); }
              }} style={{background:`linear-gradient(135deg, ${nextLesson.path.color}12, ${nextLesson.path.color}06)`,border:`2px solid ${nextLesson.path.color}33`,borderRadius:16,padding:"16px 18px",marginBottom:16,cursor:"pointer",display:"flex",alignItems:"center",gap:14,boxShadow:"0 2px 10px rgba(15,41,66,0.06)"}}>
                <div style={{width:46,height:46,borderRadius:13,background:`${nextLesson.path.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{nextLesson.path.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:10.5,fontWeight:800,letterSpacing:".08em",color:nextLesson.path.color,textTransform:"uppercase",marginBottom:4}}>NEXT LESSON · {nextLesson.path.label.toUpperCase()}</div>
                  <div style={{color:BRAND.navy,fontWeight:800,fontSize:15}}>{nextLesson.lesson.title}</div>
                  <div style={{color:BRAND.textSub,fontSize:12.5,marginTop:2}}>+{nextLesson.lesson.points} points · 2–3 mins</div>
                </div>
                <div style={{background:nextLesson.path.color,color:"#fff",borderRadius:10,padding:"8px 14px",fontWeight:800,fontSize:13,flexShrink:0}}>Go →</div>
              </div>
            )}

            {/* Advisor Cards */}
            <div style={{fontSize:11,fontWeight:800,letterSpacing:".07em",color:BRAND.textMuted,textTransform:"uppercase",marginBottom:10}}>YOUR ADVISORS</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:12}}>
              {MODS.map((m,i)=>{
                const cc=(convs[m.id]||[]).length;
                return (
                  <div key={m.id} onClick={()=>openMod(m)}
                    style={{background:"#fff",border:"2px solid #E4ECF4",borderRadius:18,padding:"18px",cursor:"pointer",transition:"all .25s",animation:`fadeUp .4s ease ${i*.05}s both`,position:"relative",boxShadow:"0 2px 12px rgba(15,41,66,0.07)"}}
                    onMouseOver={e=>{e.currentTarget.style.borderColor=m.color;e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=`0 8px 28px rgba(15,41,66,0.12)`;}}
                    onMouseOut={e=>{e.currentTarget.style.borderColor="#E4ECF4";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 2px 12px rgba(15,41,66,0.07)";}}>
                    {cc>0&&<div style={{position:"absolute",top:12,right:12,background:`${m.color}22`,border:`1px solid ${m.color}44`,color:m.color,fontSize:10,borderRadius:5,padding:"2px 6px",fontWeight:700}}>{Math.floor(cc/2)} chats</div>}
                    <div style={{width:42,height:42,borderRadius:12,background:`${m.color}18`,border:`1.5px solid ${m.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,marginBottom:12}}>{m.icon}</div>
                    <div style={{color:"#0F2942",fontWeight:700,fontSize:15,fontFamily:"'Playfair Display',serif",marginBottom:3}}>{m.label}</div>
                    <div style={{color:"#5C7A9A",fontSize:12.5,marginBottom:12,lineHeight:1.5}}>{m.desc}</div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span style={{color:m.color,fontSize:12.5,fontWeight:700}}>{cc>0?"Continue →":"Ask anything →"}</span>
                      <span style={{background:`${m.color}18`,border:`1px solid ${m.color}33`,color:m.color,fontSize:10,borderRadius:5,padding:"2px 7px",fontWeight:700}}>🔍 Live</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab==="learn" && <LearningPaths completedLessons={ret.completedLessons||[]} onStartLesson={lesson=>{
          const mod = MODS.find(m=>m.id===lesson.mod);
          const path = LEARNING_PATHS.find(p=>p.levels.some(l=>l.id===lesson.id));
          if (mod) { openMod(mod, { label: lesson.title, desc: path?.desc||"", firstQ: lesson.q, icon: path?.icon||mod.icon }); completeLesson(lesson.id); }
        }}/>}

        {tab==="goals" && <Goals goals={goals} setGoals={setGoals} onOpenMod={m=>openMod(m)}/>}

        {tab==="badges" && <BadgesPanel earnedBadges={ret.earnedBadges||[]}/>}

        {tab==="history" && <History convs={convs} setConvs={setConvs} onOpenMod={m=>openMod(m)}/>}

        <div style={{textAlign:"center",marginTop:36,color:BRAND.textMuted,fontSize:11.5,borderTop:"1px solid #E4ECF4",paddingTop:18,fontWeight:600}}>
          Prices are indicative estimates — confirmed when you apply directly with your chosen provider
        </div>
      </div>
    </div>
  );
}
