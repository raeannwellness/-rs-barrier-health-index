import { useState, useRef, useEffect } from "react";

// ─── CONFIGURATION ────────────────────────────────────────────────────────────
const MAILERLITE_URL = "/api/subscribe";
const CONTACT_EMAIL = "hello@ritualscript.com";

// ─── QUESTION FLOW ─────────────────────────────────────────────────────────────
// Scoring scale is intentionally 0 / 1 / 3 / 4 — NOT a continuous 0–4 scale.
// The gap between 1 and 3 is deliberate: it keeps vague "sometimes" answers
// from softening the score, and gives real weight to meaningful strain signals.
// Do not "fix" this by adding a value of 2 — it is not missing, it is by design.

const QUESTIONS = [
  {
    id: "q1", domain: "reactivity", section: "Reactivity",
    question: "How often do skincare products sting, burn, or feel uncomfortable when you apply them?",
    options: [
      { label: "Never", value: 4 },
      { label: "Occasionally, with specific products", value: 3 },
      { label: "Fairly often, even with gentle products", value: 1 },
      { label: "Almost every time, even with very simple products or water", value: 0 },
    ],
  },
  {
    id: "q2", domain: "reactivity", section: "Reactivity",
    question: "Have products your skin used to tolerate started to feel irritating?",
    options: [
      { label: "No — my skin responds about the same as usual", value: 4 },
      { label: "A little — one or two products feel different lately", value: 2 },
      { label: "Yes — several products that used to be fine now bother me", value: 1 },
      { label: "Yes — almost everything feels irritating right now", value: 0 },
    ],
  },
  {
    id: "q3", domain: "dryness", section: "Dryness & Texture",
    question: "How does your skin feel after cleansing?",
    options: [
      { label: "Comfortable, with no noticeable tightness", value: 4 },
      { label: "Slightly tight for a few minutes", value: 3 },
      { label: "Tight for 20 minutes or longer", value: 1 },
      { label: "Tight and uncomfortable for a long time, even after moisturizing", value: 0 },
    ],
  },
  {
    id: "q4", domain: "dryness", section: "Dryness & Texture",
    question: "Do you notice flaking or rough patches that do not settle with moisturizer?",
    options: [
      { label: "No noticeable flaking or rough patches", value: 4 },
      { label: "Occasional flaking that settles with moisturizer", value: 3 },
      { label: "Persistent flaking in a few areas", value: 1 },
      { label: "Frequent flaking or roughness that does not settle easily", value: 0 },
    ],
  },
  {
    id: "q5", domain: "redness", section: "Triggers & Routine Habits",
    question: "How often does your skin flush, redden, or feel reactive after heat, cold, wind, or sweat?",
    options: [
      { label: "Rarely or never", value: 4 },
      { label: "Occasionally, usually with stronger triggers", value: 3 },
      { label: "Fairly often, even with mild triggers", value: 1 },
      { label: "Frequently — it feels unpredictable", value: 0 },
    ],
  },
  {
    id: "q6", domain: "cleanser", section: "Triggers & Routine Habits",
    question: "Which description is closest to your current cleansing routine?",
    options: [
      { label: "Gentle cleanser, once or twice daily, with lukewarm water", value: 4 },
      { label: "Standard cleanser, usually twice daily", value: 3 },
      { label: "Foaming or exfoliating cleanser, hot water, or frequent cleansing", value: 1 },
      { label: "Not sure — I use whatever is on hand, or I scrub regularly", value: 0 },
    ],
  },
  {
    id: "q7", domain: "moisturizer", section: "Triggers & Routine Habits",
    question: "How often does moisturizer fit into your routine?",
    options: [
      { label: "Morning and night, most days", value: 4 },
      { label: "Once daily or most days", value: 3 },
      { label: "Only when my skin feels dry", value: 1 },
      { label: "I skip it often because it feels unnecessary, too heavy, or hard to tolerate", value: 0 },
    ],
  },
  {
    id: "q8", domain: "actives", section: "Triggers & Routine Habits",
    helper: "This isn't about whether actives are good or bad — it's about how much change your barrier is being asked to handle right now.",
    question: "How many active products are you currently using in a typical week?",
    subtitle: "Examples: retinoids, exfoliating acids, vitamin C, strong scrubs, or peel-style products.",
    options: [
      { label: "None, or only gentle basics", value: 4 },
      { label: "1–2 active products, spaced apart", value: 3 },
      { label: "3 or more active products, several times a week", value: 1 },
      { label: "I recently added several new active products at once", value: 0 },
    ],
  },
  {
    id: "q9", domain: "spf", section: "Triggers & Routine Habits",
    question: "How does sunscreen fit into your routine right now?",
    options: [
      { label: "I wear it daily, and it feels comfortable", value: 4 },
      { label: "I wear it most days, and it usually feels comfortable", value: 3 },
      { label: "I wear it inconsistently, or it sometimes stings", value: 1 },
      { label: "I rarely wear it — it feels uncomfortable, breaks me out, or is hard to tolerate", value: 0 },
    ],
  },
  {
    id: "q10", domain: "lifestyle", section: "Triggers & Routine Habits",
    question: "Have stress, sleep, travel, or seasonal changes seemed to affect your skin recently?",
    options: [
      { label: "Not that I have noticed", value: 4 },
      { label: "Slightly, during specific stretches", value: 3 },
      { label: "Yes, noticeably", value: 1 },
      { label: "Yes, significantly — ongoing stress, poor sleep, travel, or major seasonal changes", value: 0 },
    ],
  },
];

// Flow interleaves the two optional free-text moments between questions.
const FLOW = [
  { type: "question", ...QUESTIONS[0] },
  { type: "question", ...QUESTIONS[1] },
  { type: "freetext", id: "freetext_reactivity", prompt: "Anything else worth mentioning about how your skin reacts?" },
  { type: "question", ...QUESTIONS[2] },
  { type: "question", ...QUESTIONS[3] },
  { type: "question", ...QUESTIONS[4] },
  { type: "question", ...QUESTIONS[5] },
  { type: "question", ...QUESTIONS[6] },
  { type: "question", ...QUESTIONS[7] },
  { type: "question", ...QUESTIONS[8] },
  { type: "question", ...QUESTIONS[9] },
  { type: "freetext", id: "freetext_final", prompt: "Is there anything else you'd like us to consider when writing your report?" },
];

// ─── DOMAINS & WEIGHTS ─────────────────────────────────────────────────────────
const DOMAINS = {
  reactivity: { label: "Product Reactivity", weight: 0.22, questionIds: ["q1", "q2"] },
  dryness: { label: "Dryness & Flaking", weight: 0.20, questionIds: ["q3", "q4"] },
  redness: { label: "Redness & Sensitivity", weight: 0.14, questionIds: ["q5"] },
  cleanser: { label: "Cleansing Habits", weight: 0.12, questionIds: ["q6"] },
  moisturizer: { label: "Moisturizer Consistency", weight: 0.12, questionIds: ["q7"] },
  actives: { label: "Active Ingredient Load", weight: 0.10, questionIds: ["q8"] },
  spf: { label: "SPF Habits", weight: 0.05, questionIds: ["q9"] },
  lifestyle: { label: "Lifestyle & Triggers", weight: 0.05, questionIds: ["q10"] },
};

// ─── SCORE TIERS (ordered best → worst) ────────────────────────────────────────
const TIERS = [
  {
    label: "Resilient Barrier", min: 85, max: 100,
    what: "Your answers suggest your barrier is generally steady and responsive. The focus should be consistency, prevention, and thoughtful product changes rather than major routine shifts.",
    bg: "#e8f0e9", color: "#3d5940", icon: "🌿",
    retake: "in about 90 days, or at the start of a new season",
  },
  {
    label: "Generally Supported", min: 70, max: 84,
    what: "Your barrier appears mostly supported, with a few patterns worth watching. Small refinements may help reduce occasional dryness, tightness, or reactivity.",
    bg: "#eef3ec", color: "#4a6e4e", icon: "🍃",
    retake: "in about 60 to 90 days",
  },
  {
    label: "Needs Barrier Support", min: 55, max: 69,
    what: "Your answers suggest several signs that your barrier may need a simpler, more supportive routine. This is the ideal zone for education, routine review, and gentle habit changes.",
    bg: "#faf3ea", color: "#8a6d3a", icon: "📋",
    retake: "in about 4 to 6 weeks",
  },
  {
    label: "Barrier Under Strain", min: 40, max: 54,
    what: "Your barrier may be feeling stressed, especially if you're noticing frequent stinging, tightness, flaking, or product intolerance. The priority is reducing routine pressure and rebuilding consistency.",
    bg: "#f7eced", color: "#A0505E", icon: "⚠️",
    retake: "in about 3 to 4 weeks",
  },
  {
    label: "High Support Needed", min: 0, max: 39,
    what: "Your answers suggest a high level of barrier discomfort or reactivity. Keep recommendations conservative, and consider professional care if symptoms are persistent or severe.",
    bg: "#f3e0e2", color: "#7d3f49", icon: "🩹",
    retake: "in about 2 to 3 weeks",
  },
];

// ─── SCORING ENGINE ─────────────────────────────────────────────────────────────
function getTierIndexFromScore(score) {
  return TIERS.findIndex(t => score >= t.min && score <= t.max);
}

function scoreAssessment(answers) {
  const domainScores = {};
  Object.entries(DOMAINS).forEach(([key, d]) => {
    const sum = d.questionIds.reduce((acc, qid) => acc + (answers[qid] ?? 0), 0);
    const maxPossible = d.questionIds.length * 4;
    domainScores[key] = Math.round((sum / maxPossible) * 100);
  });

  const rawScore = Math.round(
    Object.entries(DOMAINS).reduce((acc, [key, d]) => acc + domainScores[key] * d.weight, 0)
  );

  const rawTierIndex = getTierIndexFromScore(rawScore);

  // ── Severity caps ──
  // Rule 1 — Active Reactivity + Dryness: cannot score better than "Barrier Under Strain" (index 3)
  const rule1 = (answers.q1 === 0 || answers.q2 === 0) && (answers.q3 <= 1 || answers.q4 <= 1);
  // Rule 2 — Severe Reactivity Alone: cannot score better than "Needs Barrier Support" (index 2)
  const rule2 = answers.q1 === 0 && answers.q2 <= 1;

  let requiredMinIndex = -1;
  if (rule1) requiredMinIndex = Math.max(requiredMinIndex, 3);
  if (rule2) requiredMinIndex = Math.max(requiredMinIndex, 2);

  const finalTierIndex = Math.max(rawTierIndex, requiredMinIndex);
  const capped = finalTierIndex > rawTierIndex;

  // Top contributing factors — lowest-scoring domains first
  const sortedDomains = Object.entries(domainScores)
    .sort((a, b) => a[1] - b[1])
    .map(([key]) => DOMAINS[key].label);

  return {
    score: rawScore,
    tier: TIERS[finalTierIndex],
    capped,
    domainScores,
    topFactors: sortedDomains.slice(0, 3),
    topFactor: sortedDomains[0],
  };
}

// ─── AI REPORT SYSTEM PROMPT ────────────────────────────────────────────────────
const buildReportSystemPrompt = () => `You are writing the personalized narrative report for the Ritual Script Barrier Health Index. You are NOT deciding the score or category — those are fixed facts given to you and must be used exactly as provided, never recalculated or contradicted.

You will receive: the user's Barrier Health Score, their category, their top three contributing factors, and optionally some free-text context they provided about their skin.

Write ONLY the sections below, in this exact order, using EXACTLY this format with no markdown symbols:

---REPORT_START---
WHAT THIS SCORE SUGGESTS:
[2-3 sentences building on the category description already shown to the user. Do not repeat the category description verbatim — add depth.]

WHAT SEEMS TO BE CONTRIBUTING MOST:
[Discuss the three given top factors in plain language, 1-2 sentences each. If free-text context was provided, let it quietly inform this section without quoting it directly or writing phrases like "you mentioned" or "as you said."]

YOUR FIRST THREE NEXT STEPS:
[3 specific, practical actions for this week, grounded in the top factors]

WHAT TO PAUSE OR SIMPLIFY FOR NOW:
[2-3 common barrier stressors worth pausing — new actives, over-exfoliating, adding multiple products at once — tailored to what's relevant here]

WHEN TO SEEK PROFESSIONAL CARE:
[Brief, calm guidance: persistent, severe, painful, rapidly worsening, or unexplained symptoms warrant a dermatologist or licensed provider]

RELATED RITUAL SCRIPT RESOURCES:
[1-2 sentences pointing toward The Vault for relevant free education based on the top factors]

YOUR NEXT STEP:
[Warm, non-pushy invitation. If category is "Barrier Under Strain" or "High Support Needed," mention Scripted Insight or The Ritual Reset. If "Needs Barrier Support," mention Scripted Insight. If "Generally Supported" or "Resilient Barrier," point to The Vault and Skin Lab as ways to keep learning.]
---REPORT_END---

RULES:
- This is educational, not medical. Never diagnose. Use "may suggest," "your answers indicate," "patterns to consider."
- Never promise a product, routine, or guidance service will raise the score. Use "may help you understand," "can support more informed decisions."
- Warm, plain-language, calm — even for lower scores. Never alarming, never clinical, never robotic.
- Never use the words clinical, diagnose, triage, prescribe, or severely compromised.
- Do not quote the user's free text back to them directly anywhere in this report — it has already been shown to them separately.`;

const TypingIndicator = () => (
  <div style={{ display: "flex", gap: "5px", padding: "14px 18px", alignItems: "center" }}>
    {[0, 1, 2].map(i => (
      <div key={i} style={{
        width: "7px", height: "7px", borderRadius: "50%", background: "#7a9e7e",
        animation: "bounce 1.2s infinite", animationDelay: `${i * 0.2}s`,
      }} />
    ))}
  </div>
);

const parseReport = (text) => {
  const start = text.indexOf("---REPORT_START---");
  const end = text.indexOf("---REPORT_END---");
  if (start === -1) return text;
  return text.slice(start + 19, end === -1 ? undefined : end).trim();
};

export default function BarrierHealthIndex() {
  const [phase, setPhase] = useState("intro"); // intro | quiz | teaser | email | generating | report
  const [flowIndex, setFlowIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [freeText, setFreeText] = useState({ freetext_reactivity: "", freetext_final: "" });
  const [textInput, setTextInput] = useState("");
  const [result, setResult] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reportText, setReportText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [phase]);

  const currentStep = FLOW[flowIndex];
  const progressPct = Math.round(((flowIndex + 1) / FLOW.length) * 100);

  const goNext = () => {
    if (flowIndex < FLOW.length - 1) {
      setTextInput("");
      setFlowIndex(i => i + 1);
    } else {
      const scored = scoreAssessment(answers);
      setResult(scored);
      setPhase("teaser");
    }
  };

  const goBack = () => {
    if (flowIndex > 0) setFlowIndex(i => i - 1);
  };

  const selectAnswer = (qid, value) => {
    setAnswers(prev => ({ ...prev, [qid]: value }));
  };

  const submitFreeText = (skip = false) => {
    setFreeText(prev => ({ ...prev, [currentStep.id]: skip ? "" : textInput.trim() }));
    goNext();
  };

  const generateReport = async () => {
    setSubmitting(true);
    setPhase("generating");
    try {
      const userPayload = `Barrier Health Score: ${result.score}
Category: ${result.tier.label}
Category description already shown to user: ${result.tier.what}
Top contributing factors: ${result.topFactors.join(", ")}
${freeText.freetext_reactivity ? `Free-text context (reactivity section): ${freeText.freetext_reactivity}` : ""}
${freeText.freetext_final ? `Free-text context (final): ${freeText.freetext_final}` : ""}
First name: ${firstName || "there"}

Write the report now.`;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: buildReportSystemPrompt(),
          messages: [{ role: "user", content: userPayload }],
        }),
      });
      const data = await response.json();
      const raw = data.content?.[0]?.text || "";
      const parsed = parseReport(raw);
      setReportText(parsed || "We ran into trouble generating your full narrative report, but your Barrier Health Score above is accurate. Please reach out and we'll follow up personally.");

      // Sign up for The Script + deliver full report data
      try {
        await fetch(MAILERLITE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email, first_name: firstName,
            barrier_score: result.score,
            barrier_category: result.tier.label,
            top_factors: result.topFactors.join(", "),
            free_text_reactivity: freeText.freetext_reactivity,
            free_text_final: freeText.freetext_final,
            full_report: parsed,
            source: "Barrier Health Index",
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (e) { /* silently fail — report still displays on screen */ }

      setPhase("report");
    } catch (e) {
      setReportText("We ran into trouble generating your full narrative report, but your Barrier Health Score above is accurate. Please reach out and we'll follow up personally.");
      setPhase("report");
    }
    setSubmitting(false);
  };

  const submitEmail = () => {
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    if (!firstName.trim()) {
      setEmailError("Please enter your first name.");
      return;
    }
    setEmailError("");
    generateReport();
  };

  const formatReport = (content) => {
    return content.split("\n").filter(l => l.trim()).map((line, i) => {
      const isHeader = line.match(/^[A-Z][A-Z\s&:,\-]+:$/) && line.length < 60;
      if (isHeader) {
        return (
          <div key={i} style={{
            fontFamily: "'Jost', sans-serif", fontSize: "9.5px",
            letterSpacing: "2.5px", textTransform: "uppercase",
            color: "#6a8f6e", marginTop: "22px", marginBottom: "8px", fontWeight: "600",
          }}>{line.replace(/:$/, "")}</div>
        );
      }
      return (
        <p key={i} style={{
          fontFamily: "'Jost', sans-serif", fontSize: "13.5px",
          color: "#3d4a3a", lineHeight: "1.8", margin: "0 0 8px", fontWeight: "300",
        }}>{line}</p>
      );
    });
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(145deg, #f7f3ee 0%, #ede8df 50%, #e8f0e9 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Georgia', serif", padding: "24px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap');
        @keyframes bounce { 0%,60%,100%{transform:translateY(0);opacity:.5} 30%{transform:translateY(-6px);opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .fade-up{animation:fadeUp .45s ease forwards}
        .fade-in{animation:fadeIn .4s ease forwards}
        .opt:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(74,110,78,.15)!important;border-color:#7a9e7e!important}
        .opt.sel{border-color:#4a6e4e!important;background:linear-gradient(135deg,#e8f0e9,#d4e4d5)!important}
        .pbtn:hover:not(:disabled){background:#3d5940!important;transform:translateY(-1px)}
        .pbtn:disabled{opacity:.45;cursor:default;transform:none!important}
        .skipbtn:hover{color:#3d5940!important}
        textarea:focus,input[type=email]:focus,input[type=text]:focus{outline:none!important;border-color:#7a9e7e!important;box-shadow:0 0 0 3px rgba(122,158,126,.15)!important}
        textarea{resize:none}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#c5d5c6;border-radius:4px}
        a.clink:hover{color:#4a6e4e!important}
      `}</style>

      <div style={{
        width: "100%", maxWidth: "680px",
        background: "rgba(251,248,243,.96)",
        borderRadius: "24px",
        boxShadow: "0 24px 80px rgba(50,70,45,.14),0 4px 20px rgba(0,0,0,.06)",
        overflow: "hidden",
        border: "1px solid rgba(175,200,165,.25)",
      }}>

        {/* HEADER */}
        <div style={{
          background: "linear-gradient(135deg,#3d5940 0%,#4a6e4e 55%,#5c7f60 100%)",
          padding: "28px 36px 24px", position: "relative", overflow: "hidden",
        }}>
          {[["-40px","auto","auto","-40px","180px",.06],["-20px","auto","20px","auto","80px",.04],["auto","80px","-20px","auto","100px",.05]]
            .map(([t,r,b,l,s,o],i)=>(
              <div key={i} style={{position:"absolute",width:s,height:s,borderRadius:"50%",
                background:`rgba(255,255,255,${o})`,top:t,right:r,bottom:b,left:l}}/>
            ))}
          <div style={{position:"relative"}}>
            <div style={{fontFamily:"'Jost',sans-serif",fontSize:"9px",letterSpacing:"3.5px",
              color:"rgba(208,228,198,.8)",textTransform:"uppercase",marginBottom:"6px"}}>
              Ritual Script Skincare
            </div>
            <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"30px",fontWeight:"300",
              color:"#f5f0e8",margin:"0 0 4px",letterSpacing:".5px",lineHeight:1.2}}>
              Barrier Health Index
            </h1>
            <p style={{fontFamily:"'Jost',sans-serif",fontSize:"12px",
              color:"rgba(208,228,198,.75)",margin:0,fontWeight:"300",letterSpacing:".3px"}}>
              Certified Skincare Coach &amp; Licensed Advanced Pharmacy Technician
            </p>
          </div>
          <a href={`mailto:${CONTACT_EMAIL}`} className="clink"
            style={{position:"absolute",top:"20px",right:"28px",
              fontFamily:"'Jost',sans-serif",fontSize:"10px",letterSpacing:"1px",
              color:"rgba(208,228,198,.7)",textDecoration:"none",
              display:"flex",alignItems:"center",gap:"5px",transition:"color .2s"}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                stroke="currentColor" strokeWidth="2"/>
              <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Questions?
          </a>
        </div>

        {/* PROGRESS */}
        {["quiz","teaser","email","generating","report"].includes(phase) && (
          <div style={{height:"3px",background:"#e4ede4"}}>
            <div style={{height:"100%",background:"linear-gradient(90deg,#4a6e4e,#7a9e7e)",
              width: phase==="quiz" ? `${progressPct}%` : "100%", transition:"width .4s ease"}}/>
          </div>
        )}

        {/* BODY */}
        <div style={{padding:"32px 36px"}}>

          {/* INTRO */}
          {phase==="intro"&&(
            <div className="fade-in" style={{textAlign:"center"}}>
              <div style={{width:"72px",height:"72px",margin:"0 auto 22px",
                background:"linear-gradient(135deg,#e8f0e9,#c8deca)",
                borderRadius:"50%",display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:"30px"}}>🌿</div>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"24px",
                fontWeight:"400",fontStyle:"italic",color:"#3d5940",margin:"0 0 14px"}}>
                Know your Barrier Health Score.
              </h2>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"13.5px",color:"#6a7a65",
                lineHeight:"1.8",margin:"0 0 10px",fontWeight:"300",
                maxWidth:"460px",marginLeft:"auto",marginRight:"auto"}}>
                A short, education-first assessment to help you understand how supported your skin barrier feels right now.
              </p>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"13px",color:"#8a9a85",
                lineHeight:"1.7",margin:"0 0 30px",fontWeight:"300"}}>
                This tool is educational and not diagnostic. Your score is based on your answers about comfort, reactivity, routine habits, and recent skin patterns.
              </p>
              <button className="pbtn"
                onClick={()=>setPhase("quiz")}
                style={{background:"#4a6e4e",color:"#f5f0e8",border:"none",
                  padding:"16px 44px",borderRadius:"50px",
                  fontFamily:"'Jost',sans-serif",fontSize:"11px",
                  letterSpacing:"2.5px",textTransform:"uppercase",
                  cursor:"pointer",transition:"all .25s ease",fontWeight:"500"}}>
                Start the Assessment
              </button>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"10px",color:"#b0bfa8",
                marginTop:"16px",letterSpacing:".3px"}}>
                Educational in nature · Not medical advice ·{" "}
                <a href={`mailto:${CONTACT_EMAIL}`}
                  style={{color:"#8a9e84",textDecoration:"none"}}>
                  Questions? {CONTACT_EMAIL}
                </a>
              </p>
            </div>
          )}

          {/* QUIZ — QUESTION STEP */}
          {phase==="quiz" && currentStep.type==="question" && (
            <div className="fade-up" key={currentStep.id}>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"10px",letterSpacing:"2.5px",
                textTransform:"uppercase",color:"#7a9e7e",margin:"0 0 10px"}}>
                {currentStep.section} · Question {flowIndex+1} of {FLOW.length}
              </p>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"21px",
                fontWeight:"400",color:"#3d5940",margin:"0 0 6px",lineHeight:1.3}}>
                {currentStep.question}
              </h2>
              {currentStep.subtitle && (
                <p style={{fontFamily:"'Jost',sans-serif",fontSize:"12px",color:"#8a9a85",
                  margin:"0 0 4px",fontWeight:"300"}}>{currentStep.subtitle}</p>
              )}
              {currentStep.helper && (
                <p style={{fontFamily:"'Jost',sans-serif",fontSize:"11.5px",color:"#a0ac9a",
                  margin:"0 0 18px",fontWeight:"300",fontStyle:"italic"}}>{currentStep.helper}</p>
              )}
              <div style={{display:"grid",gridTemplateColumns:"1fr",gap:"10px",margin:"22px 0 28px"}}>
                {currentStep.options.map(opt=>{
                  const sel = answers[currentStep.id]===opt.value;
                  return(
                    <div key={opt.label}
                      className={`opt${sel?" sel":""}`}
                      onClick={()=>selectAnswer(currentStep.id, opt.value)}
                      style={{padding:"15px 18px",borderRadius:"12px",
                        border:`1.5px solid ${sel?"#4a6e4e":"rgba(145,175,145,.25)"}`,
                        background:sel?"linear-gradient(135deg,#e8f0e9,#d4e4d5)":"white",
                        cursor:"pointer",transition:"all .2s ease",
                        boxShadow:"0 2px 10px rgba(0,0,0,.04)",
                        fontFamily:"'Jost',sans-serif",fontSize:"13.5px",
                        fontWeight:"400",color:"#3d4a3a",lineHeight:1.4}}>
                      {opt.label}
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                {flowIndex>0
                  ?<button onClick={goBack}
                      style={{background:"none",border:"none",fontFamily:"'Jost',sans-serif",
                        fontSize:"12px",color:"#8a9a85",cursor:"pointer",padding:0}}>← Back</button>
                  :<div/>}
                <button className="pbtn"
                  disabled={answers[currentStep.id]===undefined}
                  onClick={goNext}
                  style={{background:"#4a6e4e",color:"#f5f0e8",border:"none",
                    padding:"13px 32px",borderRadius:"50px",
                    fontFamily:"'Jost',sans-serif",fontSize:"11px",
                    letterSpacing:"2px",textTransform:"uppercase",
                    cursor:"pointer",transition:"all .25s ease",fontWeight:"500"}}>
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* QUIZ — FREE TEXT STEP */}
          {phase==="quiz" && currentStep.type==="freetext" && (
            <div className="fade-up" key={currentStep.id}>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"10px",letterSpacing:"2.5px",
                textTransform:"uppercase",color:"#7a9e7e",margin:"0 0 10px"}}>
                Optional
              </p>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"21px",
                fontWeight:"400",color:"#3d5940",margin:"0 0 10px",lineHeight:1.3}}>
                {currentStep.prompt}
              </h2>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"11.5px",color:"#a0ac9a",
                margin:"0 0 18px",fontWeight:"300",fontStyle:"italic"}}>
                Your response may appear as-is in your personalized report.
              </p>
              <textarea
                value={textInput}
                onChange={e=>setTextInput(e.target.value)}
                placeholder="Share anything you'd like — totally optional"
                rows={4}
                style={{width:"100%",padding:"14px 16px",borderRadius:"14px",
                  border:"1.5px solid rgba(145,175,145,.3)",background:"white",
                  fontFamily:"'Jost',sans-serif",fontSize:"13.5px",
                  color:"#3d4a3a",fontWeight:"300",lineHeight:"1.6",
                  transition:"all .2s ease",boxShadow:"0 1px 6px rgba(0,0,0,.04)",
                  boxSizing:"border-box",marginBottom:"22px"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                {flowIndex>0
                  ?<button onClick={goBack}
                      style={{background:"none",border:"none",fontFamily:"'Jost',sans-serif",
                        fontSize:"12px",color:"#8a9a85",cursor:"pointer",padding:0}}>← Back</button>
                  :<div/>}
                <div style={{display:"flex",gap:"14px",alignItems:"center"}}>
                  <button className="skipbtn" onClick={()=>submitFreeText(true)}
                    style={{background:"none",border:"none",fontFamily:"'Jost',sans-serif",
                      fontSize:"11.5px",color:"#a0ac9a",cursor:"pointer",padding:0,
                      letterSpacing:"1px",transition:"color .2s ease"}}>Skip</button>
                  <button className="pbtn" onClick={()=>submitFreeText(false)}
                    style={{background:"#4a6e4e",color:"#f5f0e8",border:"none",
                      padding:"13px 32px",borderRadius:"50px",
                      fontFamily:"'Jost',sans-serif",fontSize:"11px",
                      letterSpacing:"2px",textTransform:"uppercase",
                      cursor:"pointer",transition:"all .25s ease",fontWeight:"500"}}>
                    Continue →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TEASER RESULT */}
          {phase==="teaser" && result && (
            <div className="fade-up" style={{textAlign:"center"}}>
              <div style={{background:result.tier.bg,border:`1.5px solid ${result.tier.color}28`,
                borderRadius:"18px",padding:"28px 24px",marginBottom:"24px"}}>
                <div style={{fontSize:"30px",marginBottom:"10px"}}>{result.tier.icon}</div>
                <div style={{fontFamily:"'Jost',sans-serif",fontSize:"9px",
                  letterSpacing:"2.5px",textTransform:"uppercase",
                  color:result.tier.color,opacity:.75,marginBottom:"6px"}}>
                  Your Barrier Health Score
                </div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",
                  fontSize:"44px",fontWeight:"500",color:result.tier.color,lineHeight:1,marginBottom:"8px"}}>
                  {result.score}
                </div>
                <div style={{fontFamily:"'Jost',sans-serif",fontSize:"15px",
                  fontWeight:"600",color:result.tier.color,marginBottom:"14px"}}>
                  {result.tier.label}
                </div>
                <p style={{fontFamily:"'Jost',sans-serif",fontSize:"13px",
                  color:"#3d4a3a",lineHeight:"1.7",fontWeight:"300",margin:0}}>
                  {result.tier.what}
                </p>
                {result.capped && (
                  <p style={{fontFamily:"'Jost',sans-serif",fontSize:"11px",fontStyle:"italic",
                    color:result.tier.color,opacity:.85,marginTop:"12px",lineHeight:"1.6"}}>
                    Your numerical score reflects the full set of answers, but your category was adjusted because your responses suggest significant current reactivity.
                  </p>
                )}
              </div>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"12.5px",color:"#6a7a65",
                lineHeight:"1.7",fontWeight:"300",margin:"0 0 6px"}}>
                Biggest contributor: <strong style={{color:"#3d5940",fontWeight:"600"}}>{result.topFactor}</strong>
              </p>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"12px",color:"#8a9a85",
                margin:"0 0 20px",fontWeight:"300"}}>
                Suggested retake: <strong style={{color:"#6a7a65",fontWeight:"500"}}>{result.tier.retake}</strong>
              </p>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"12px",color:"#a0ac9a",
                margin:"0 0 28px",fontWeight:"300"}}>
                Enter your details to receive your full Barrier Health Report — including your top contributing factors, first steps, and what to pause for now.
              </p>
              <button className="pbtn" onClick={()=>setPhase("email")}
                style={{background:"#4a6e4e",color:"#f5f0e8",border:"none",
                  padding:"16px 44px",borderRadius:"50px",
                  fontFamily:"'Jost',sans-serif",fontSize:"11px",
                  letterSpacing:"2.5px",textTransform:"uppercase",
                  cursor:"pointer",transition:"all .25s ease",fontWeight:"500"}}>
                Get My Full Report →
              </button>
            </div>
          )}

          {/* EMAIL GATE */}
          {phase==="email"&&(
            <div className="fade-up" style={{textAlign:"center"}}>
              <div style={{width:"68px",height:"68px",margin:"0 auto 22px",
                background:"linear-gradient(135deg,#e8f0e9,#c8deca)",
                borderRadius:"50%",display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:"28px"}}>📋</div>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"24px",
                fontWeight:"400",color:"#3d5940",margin:"0 0 10px"}}>
                Almost There
              </h2>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"13.5px",color:"#6a7a65",
                lineHeight:"1.8",margin:"0 0 28px",fontWeight:"300"}}>
                Enter your details to unlock your full Barrier Health Report and join The Script — Ritual Script's monthly education newsletter.
              </p>
              <div style={{maxWidth:"360px",margin:"0 auto"}}>
                <input type="text" placeholder="First name"
                  value={firstName} onChange={e=>setFirstName(e.target.value)}
                  style={{width:"100%",padding:"14px 18px",borderRadius:"12px",
                    border:"1.5px solid rgba(145,175,145,.35)",
                    fontFamily:"'Jost',sans-serif",fontSize:"14px",
                    color:"#3d4a3a",fontWeight:"300",background:"white",
                    marginBottom:"10px",boxSizing:"border-box",transition:"all .2s ease"}}/>
                <input type="email" placeholder="your@email.com"
                  value={email} onChange={e=>setEmail(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&submitEmail()}
                  style={{width:"100%",padding:"14px 18px",borderRadius:"12px",
                    border:`1.5px solid ${emailError?"#c62828":"rgba(145,175,145,.35)"}`,
                    fontFamily:"'Jost',sans-serif",fontSize:"14px",
                    color:"#3d4a3a",fontWeight:"300",background:"white",
                    marginBottom:"8px",boxSizing:"border-box",transition:"all .2s ease"}}/>
                {emailError&&(
                  <p style={{fontFamily:"'Jost',sans-serif",fontSize:"11px",
                    color:"#c62828",margin:"0 0 10px",textAlign:"left"}}>
                    {emailError}
                  </p>
                )}
                <button className="pbtn" onClick={submitEmail}
                  disabled={submitting}
                  style={{width:"100%",background:"#4a6e4e",color:"#f5f0e8",
                    border:"none",padding:"15px",borderRadius:"50px",
                    fontFamily:"'Jost',sans-serif",fontSize:"11px",
                    letterSpacing:"2.5px",textTransform:"uppercase",
                    cursor:submitting?"default":"pointer",
                    transition:"all .25s ease",fontWeight:"500"}}>
                  Reveal My Barrier Health Report →
                </button>
              </div>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"10px",
                color:"#b0bfa8",marginTop:"14px",letterSpacing:".3px"}}>
                No spam. Unsubscribe anytime. By submitting you agree to receive The Script and occasional skincare guidance from Ritual Script.
              </p>
            </div>
          )}

          {/* GENERATING */}
          {phase==="generating"&&(
            <div className="fade-in" style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{display:"flex",justifyContent:"center",marginBottom:"18px"}}>
                <TypingIndicator/>
              </div>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"13px",color:"#6a7a65",
                fontWeight:"300"}}>Writing your personalized report...</p>
            </div>
          )}

          {/* FULL REPORT */}
          {phase==="report" && result &&(()=>{
            const t = result.tier;
            const hasFreeText = freeText.freetext_reactivity || freeText.freetext_final;
            return(
              <div className="fade-up">
                {/* Score badge */}
                <div style={{background:t.bg,border:`1.5px solid ${t.color}28`,
                  borderRadius:"16px",padding:"20px 24px",marginBottom:"24px",
                  display:"flex",alignItems:"center",gap:"16px"}}>
                  <div style={{width:"54px",height:"54px",borderRadius:"50%",
                    background:`${t.color}16`,display:"flex",alignItems:"center",
                    justifyContent:"center",fontSize:"24px",flexShrink:0}}>
                    {t.icon}
                  </div>
                  <div>
                    <div style={{fontFamily:"'Jost',sans-serif",fontSize:"9px",
                      letterSpacing:"2.5px",textTransform:"uppercase",
                      color:t.color,opacity:.75,marginBottom:"4px"}}>
                      Your Barrier Health Score
                    </div>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",
                      fontSize:"28px",fontWeight:"500",color:t.color,lineHeight:1}}>
                      {result.score} — {t.label}
                    </div>
                  </div>
                </div>

                {/* In Their Own Words */}
                {hasFreeText && (
                  <div style={{background:"white",border:"1px solid rgba(145,175,145,.25)",
                    borderRadius:"12px",padding:"18px 20px",marginBottom:"22px"}}>
                    <div style={{fontFamily:"'Jost',sans-serif",fontSize:"9.5px",
                      letterSpacing:"2.5px",textTransform:"uppercase",
                      color:"#A0505E",marginBottom:"10px",fontWeight:"600"}}>
                      In Their Own Words
                    </div>
                    {freeText.freetext_reactivity && (
                      <p style={{fontFamily:"'Jost',sans-serif",fontSize:"13px",fontStyle:"italic",
                        color:"#3d4a3a",lineHeight:"1.7",margin:"0 0 10px"}}>"{freeText.freetext_reactivity}"</p>
                    )}
                    {freeText.freetext_final && (
                      <p style={{fontFamily:"'Jost',sans-serif",fontSize:"13px",fontStyle:"italic",
                        color:"#3d4a3a",lineHeight:"1.7",margin:0}}>"{freeText.freetext_final}"</p>
                    )}
                  </div>
                )}

                {/* Report content */}
                <div style={{maxHeight:"380px",overflowY:"auto",
                  paddingRight:"8px",marginBottom:"24px"}}>
                  {formatReport(reportText)}
                  <div style={{marginTop:"18px",paddingTop:"14px",borderTop:"1px solid rgba(165,190,165,.25)"}}>
                    <div style={{fontFamily:"'Jost',sans-serif",fontSize:"9.5px",
                      letterSpacing:"2.5px",textTransform:"uppercase",
                      color:"#6a8f6e",marginBottom:"6px",fontWeight:"600"}}>Suggested Retake</div>
                    <p style={{fontFamily:"'Jost',sans-serif",fontSize:"13.5px",
                      color:"#3d4a3a",lineHeight:"1.8",margin:0,fontWeight:"300"}}>
                      Based on your current Barrier Health Score, consider retaking this assessment {result.tier.retake} to see how your barrier is responding.
                    </p>
                  </div>
                  <div ref={bottomRef}/>
                </div>

                {/* CTAs */}
                <div style={{display:"flex",gap:"12px",flexWrap:"wrap",marginBottom:"16px"}}>
                  <a href="https://ritualscript.com" target="_blank" rel="noreferrer"
                    style={{flex:1,minWidth:"160px",background:"#4a6e4e",
                      color:"#f5f0e8",padding:"13px 20px",borderRadius:"50px",
                      fontFamily:"'Jost',sans-serif",fontSize:"10px",
                      letterSpacing:"2px",textTransform:"uppercase",
                      textDecoration:"none",textAlign:"center",
                      fontWeight:"500",transition:"all .2s ease"}}>
                    Explore Ritual Script →
                  </a>
                  <a href={`mailto:${CONTACT_EMAIL}?subject=Barrier Health Assessment Follow-Up&body=Hi Rachel,%0D%0A%0D%0AI just completed the Barrier Health Assessment. My score was: ${result.score} (${t.label}).%0D%0A%0D%0AI have a question about my results.`}
                    style={{flex:1,minWidth:"160px",background:"white",
                      color:"#4a6e4e",padding:"13px 20px",borderRadius:"50px",
                      fontFamily:"'Jost',sans-serif",fontSize:"10px",
                      letterSpacing:"2px",textTransform:"uppercase",
                      textDecoration:"none",textAlign:"center",
                      fontWeight:"500",border:"1.5px solid #7a9e7e",
                      transition:"all .2s ease"}}>
                    Ask a Question ✉
                  </a>
                </div>

                <p style={{fontFamily:"'Jost',sans-serif",fontSize:"10px",
                  color:"#b0bfa8",letterSpacing:".3px",lineHeight:1.6,textAlign:"center"}}>
                  A copy of this report has been sent to {email} &nbsp;·&nbsp;
                  This assessment is educational in nature and does not constitute medical advice.
                </p>
              </div>
            );
          })()}

        </div>

        {/* FOOTER */}
        <div style={{padding:"12px 36px",
          borderTop:"1px solid rgba(165,195,160,.15)",
          background:"rgba(238,244,237,.5)",
          display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <p style={{fontFamily:"'Jost',sans-serif",fontSize:"9.5px",
            color:"#a8b8a4",margin:0,letterSpacing:".5px"}}>
            Ritual Script Skincare · Barrier-First · Evidence-Based
          </p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="clink"
            style={{fontFamily:"'Jost',sans-serif",fontSize:"9.5px",
              color:"#a8b8a4",textDecoration:"none",
              transition:"color .2s ease",letterSpacing:".3px"}}>
            {CONTACT_EMAIL}
          </a>
        </div>

      </div>
    </div>
  );
}
