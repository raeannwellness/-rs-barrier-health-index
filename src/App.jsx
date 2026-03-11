import { useState, useRef, useEffect } from "react";

// ─── CONFIGURATION ────────────────────────────────────────────────────────────
const MAILERLITE_URL = "/api/subscribe";
const CONTACT_EMAIL = "hello@ritualscript.com";

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the Ritual Script Barrier Health Index — an evidence-based skin barrier assessment tool created by Ritual Script Skincare, founded by Rachel, an Advanced Pharmacy Technician and Certified Skincare Coach.

You have already received structured answers from the user about their primary concern, duration, and routine complexity. Now conduct a warm, intelligent 3-question conversational follow-up to gather the depth needed for a real barrier assessment.

CONVERSATION PHASE (3 questions max, one at a time):
Ask targeted, evidence-based questions about:
- Specific symptoms: stinging from plain water or gentle products, post-cleanse tightness duration, sudden flushing, sensitivity to previously tolerated products
- Active ingredients currently in use (retinoids, AHAs, BHAs, vitamin C, niacinamide, etc.)
- Environmental or lifestyle factors: climate, stress, diet changes, new products introduced

After exactly 3 conversational questions and answers, generate the full assessment using EXACTLY this format with no markdown symbols:

---ASSESSMENT_START---
BARRIER HEALTH SCORE: [ONE OF: Optimal / Stressed / Compromised / Severely Impaired]

RECOVERY TIMELINE: [e.g., "Estimated 14-21 days with proper barrier support" or "28-45 days based on typical epidermal turnover — individual results vary"]

WHAT YOUR SKIN MAY BE TELLING YOU:
[2-3 sentences explaining what may be happening at the barrier level in plain but informed language. Reference specific things they mentioned. Frame as observation, not diagnosis.]

KEY PATTERNS IDENTIFIED:
[3-4 specific patterns observed from their responses, each 1 sentence]

WHAT TO CONSIDER PAUSING:
[2-3 specific things to consider stopping or reducing, with brief rationale. Frame as suggestions not prescriptions.]

BARRIER RECOVERY SUGGESTIONS:
[3-4 ingredient or product type recommendations with brief evidence-based rationale for each]

ROUTINE ADJUSTMENTS TO EXPLORE:
[2-3 specific timing or application changes worth trying]

YOUR RECOMMENDED NEXT STEP:
[A warm, genuine recommendation. If Compromised or Severely Impaired, recommend the Ritual Reset program. If Stressed, recommend Scripted Insight for personalized guidance. If Optimal, suggest The Vault resources at ritualscript.com. Never pushy — frame as a helpful logical next step.]

IMPORTANT REMINDER:
This assessment is educational in nature and is based on the information you shared. It does not constitute medical advice. If you are experiencing persistent or severe skin concerns, please consult a licensed dermatologist.
---ASSESSMENT_END---

TONE: Warm, informed, confident but never prescriptive. Like a knowledgeable friend with a pharmacy background who genuinely cares. Never robotic. Reference specific things they told you to make it feel truly personalized. Never use the words clinical, diagnose, triage, or prescribe.`;

// ─── STRUCTURED QUESTIONS ─────────────────────────────────────────────────────
const STRUCTURED_QUESTIONS = [
  {
    id: "concern",
    question: "What best describes your primary skin concern right now?",
    subtitle: "Choose the one that feels most urgent",
    options: [
      { label: "Redness & Reactivity", icon: "🔴", desc: "Flushing, stinging, sudden sensitivity" },
      { label: "Breakouts & Congestion", icon: "⚪", desc: "Acne, clogged pores, bumpy texture" },
      { label: "Dryness & Dehydration", icon: "💧", desc: "Tightness, flaking, dull appearance" },
      { label: "Nothing Works Anymore", icon: "😔", desc: "Skin has become unpredictable and reactive" },
    ],
  },
  {
    id: "duration",
    question: "How long have you been experiencing this?",
    subtitle: "Duration helps us understand where your barrier may be in its recovery stage",
    options: [
      { label: "Just started", icon: "⚡", desc: "Within the last 2 weeks" },
      { label: "A few weeks", icon: "📅", desc: "2–8 weeks" },
      { label: "Several months", icon: "🗓️", desc: "2–6 months" },
      { label: "Over a year", icon: "⏳", desc: "Chronic, ongoing issue" },
    ],
  },
  {
    id: "routine",
    question: "How would you describe your current skincare routine?",
    subtitle: "Routine complexity is a key barrier health indicator",
    options: [
      { label: "Minimal", icon: "✨", desc: "Cleanser, moisturizer, SPF — that's it" },
      { label: "Moderate", icon: "🌿", desc: "5–7 products, a few actives" },
      { label: "Extensive", icon: "🧴", desc: "8+ steps, multiple actives" },
      { label: "Currently Stripped Back", icon: "🔄", desc: "Simplified after a bad reaction" },
    ],
  },
];

// ─── SCORE STYLES ─────────────────────────────────────────────────────────────
const SCORE_STYLES = {
  "Optimal": { bg: "#e8f5e9", color: "#2e7d32", icon: "✅" },
  "Stressed": { bg: "#fff8e1", color: "#f57f17", icon: "⚠️" },
  "Compromised": { bg: "#fce4ec", color: "#c62828", icon: "🔴" },
  "Severely Impaired": { bg: "#f3e5f5", color: "#6a1b9a", icon: "🆘" },
};

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

const parseAssessment = (text) => {
  const start = text.indexOf("---ASSESSMENT_START---");
  const end = text.indexOf("---ASSESSMENT_END---");
  if (start === -1) return null;
  const content = text.slice(start + 22, end === -1 ? undefined : end).trim();
  const scoreMatch = content.match(/BARRIER HEALTH SCORE:\s*(.+)/);
  return { content, score: scoreMatch ? scoreMatch[1].trim() : null };
};

export default function BarrierHealthIndex() {
  const [phase, setPhase] = useState("intro");
  const [structuredStep, setStructuredStep] = useState(0);
  const [structuredAnswers, setStructuredAnswers] = useState({});
  const [messages, setMessages] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [pendingAssessmentText, setPendingAssessmentText] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, phase]);

  const callClaude = async (history) => {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: history,
      }),
    });
    const data = await response.json();
    return data.content?.[0]?.text || "I'm having trouble connecting. Please try again.";
  };

  const startChat = async () => {
    setPhase("chat");
    setLoading(true);
    const summary = `Here are my initial answers:
- Primary concern: ${structuredAnswers.concern}
- Duration: ${structuredAnswers.duration}
- Routine complexity: ${structuredAnswers.routine}

Please begin your follow-up questions.`;
    const initialHistory = [{ role: "user", content: summary }];
    const reply = await callClaude(initialHistory);
    setConversationHistory([...initialHistory, { role: "assistant", content: reply }]);
    setMessages([{ role: "assistant", content: reply }]);
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput("");
    const newMessages = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setLoading(true);
    const newHistory = [...conversationHistory, { role: "user", content: userMessage }];
    const reply = await callClaude(newHistory);
    const parsed = parseAssessment(reply);
    if (parsed) {
      const preText = reply.slice(0, reply.indexOf("---ASSESSMENT_START---")).trim();
      setMessages([...newMessages, ...(preText ? [{ role: "assistant", content: preText }] : [])]);
      setPendingAssessmentText(parsed.content);
      setLoading(false);
      setPhase("email");
    } else {
      setConversationHistory([...newHistory, { role: "assistant", content: reply }]);
      setMessages([...newMessages, { role: "assistant", content: reply }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const submitEmail = async () => {
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError("");
    setSubmittingEmail(true);
    const scoreMatch = pendingAssessmentText.match(/BARRIER HEALTH SCORE:\s*(.+)/);
    const score = scoreMatch ? scoreMatch[1].trim() : "Unknown";
    try {
      await fetch(ZAPIER_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, barrier_score: score,
          primary_concern: structuredAnswers.concern,
          duration: structuredAnswers.duration,
          routine: structuredAnswers.routine,
          full_report: pendingAssessmentText,
          source: "Barrier Health Index",
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (e) { /* silently fail */ }
    setUserEmail(email);
    setAssessment({ content: pendingAssessmentText, score });
    setSubmittingEmail(false);
    setPhase("report");
  };

  const formatReport = (content) => {
    return content.split("\n").filter(l => l.trim()).map((line, i) => {
      if (line.match(/^BARRIER HEALTH SCORE:/)) return null;
      const isHeader = line.match(/^[A-Z][A-Z\s&:—\-]+$/) ||
        (line.endsWith(":") && line === line.toUpperCase() && line.length < 60) ||
        (line.match(/^[A-Z][A-Z\s&\-]+:/) && !line.match(/^[A-Z][a-z]/) && line.length < 70);
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

  const progressWidth = phase === "structured"
    ? `${(structuredStep / (STRUCTURED_QUESTIONS.length + 3)) * 100}%`
    : phase === "chat" ? "65%" : phase === "email" ? "88%" : "100%";

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
        .msg-in{animation:fadeUp .35s ease forwards}
        .opt:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(74,110,78,.15)!important;border-color:#7a9e7e!important}
        .opt.sel{border-color:#4a6e4e!important;background:linear-gradient(135deg,#e8f0e9,#d4e4d5)!important}
        .pbtn:hover:not(:disabled){background:#3d5940!important;transform:translateY(-1px)}
        .pbtn:disabled{opacity:.45;cursor:default;transform:none!important}
        .sbtn:hover:not(:disabled){background:#3d5940!important}
        textarea:focus,input[type=email]:focus{outline:none!important;border-color:#7a9e7e!important;box-shadow:0 0 0 3px rgba(122,158,126,.15)!important}
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
              Advanced Pharmacy Technician &amp; Certified Skincare Coach
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
        {["structured","chat","email","report"].includes(phase) && (
          <div style={{height:"3px",background:"#e4ede4"}}>
            <div style={{height:"100%",background:"linear-gradient(90deg,#4a6e4e,#7a9e7e)",
              width:progressWidth,transition:"width .5s ease"}}/>
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
                Your skin has a story to tell.
              </h2>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"13.5px",color:"#6a7a65",
                lineHeight:"1.8",margin:"0 0 10px",fontWeight:"300",
                maxWidth:"460px",marginLeft:"auto",marginRight:"auto"}}>
                This assessment uses evidence-based reasoning — not a generic quiz — to help you understand what your skin barrier is telling you and what it genuinely needs.
              </p>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"13px",color:"#8a9a85",
                lineHeight:"1.7",margin:"0 0 30px",fontWeight:"300"}}>
                Takes about 5 minutes. You'll receive a personalized Barrier Health Score and a full evidence-based report — delivered to your inbox.
              </p>
              <button className="pbtn"
                onClick={()=>setPhase("structured")}
                style={{background:"#4a6e4e",color:"#f5f0e8",border:"none",
                  padding:"16px 44px",borderRadius:"50px",
                  fontFamily:"'Jost',sans-serif",fontSize:"11px",
                  letterSpacing:"2.5px",textTransform:"uppercase",
                  cursor:"pointer",transition:"all .25s ease",fontWeight:"500"}}>
                Begin Assessment
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

          {/* STRUCTURED */}
          {phase==="structured"&&(
            <div className="fade-up" key={structuredStep}>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"10px",letterSpacing:"2.5px",
                textTransform:"uppercase",color:"#7a9e7e",margin:"0 0 10px"}}>
                Question {structuredStep+1} of {STRUCTURED_QUESTIONS.length}
              </p>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"22px",
                fontWeight:"400",color:"#3d5940",margin:"0 0 6px",lineHeight:1.3}}>
                {STRUCTURED_QUESTIONS[structuredStep].question}
              </h2>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"12px",color:"#8a9a85",
                margin:"0 0 22px",fontWeight:"300"}}>
                {STRUCTURED_QUESTIONS[structuredStep].subtitle}
              </p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"28px"}}>
                {STRUCTURED_QUESTIONS[structuredStep].options.map(opt=>{
                  const qId=STRUCTURED_QUESTIONS[structuredStep].id;
                  const sel=structuredAnswers[qId]===opt.label;
                  return(
                    <div key={opt.label}
                      className={`opt${sel?" sel":""}`}
                      onClick={()=>setStructuredAnswers(p=>({...p,[qId]:opt.label}))}
                      style={{padding:"16px",borderRadius:"14px",
                        border:`1.5px solid ${sel?"#4a6e4e":"rgba(145,175,145,.25)"}`,
                        background:sel?"linear-gradient(135deg,#e8f0e9,#d4e4d5)":"white",
                        cursor:"pointer",transition:"all .2s ease",
                        boxShadow:"0 2px 10px rgba(0,0,0,.04)"}}>
                      <div style={{fontSize:"22px",marginBottom:"6px"}}>{opt.icon}</div>
                      <div style={{fontFamily:"'Jost',sans-serif",fontSize:"13px",
                        fontWeight:"500",color:"#3d4a3a",marginBottom:"4px"}}>{opt.label}</div>
                      <div style={{fontFamily:"'Jost',sans-serif",fontSize:"11px",
                        color:"#8a9a85",fontWeight:"300",lineHeight:1.4}}>{opt.desc}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                {structuredStep>0
                  ?<button onClick={()=>setStructuredStep(s=>s-1)}
                      style={{background:"none",border:"none",fontFamily:"'Jost',sans-serif",
                        fontSize:"12px",color:"#8a9a85",cursor:"pointer",padding:0}}>← Back</button>
                  :<div/>}
                <button className="pbtn"
                  disabled={!structuredAnswers[STRUCTURED_QUESTIONS[structuredStep].id]}
                  onClick={()=>{
                    if(structuredStep<STRUCTURED_QUESTIONS.length-1){
                      setStructuredStep(s=>s+1);
                    }else{
                      startChat();
                    }
                  }}
                  style={{background:"#4a6e4e",color:"#f5f0e8",border:"none",
                    padding:"13px 32px",borderRadius:"50px",
                    fontFamily:"'Jost',sans-serif",fontSize:"11px",
                    letterSpacing:"2px",textTransform:"uppercase",
                    cursor:"pointer",transition:"all .25s ease",fontWeight:"500"}}>
                  {structuredStep<STRUCTURED_QUESTIONS.length-1?"Continue →":"Begin Deep Assessment →"}
                </button>
              </div>
            </div>
          )}

          {/* CHAT */}
          {phase==="chat"&&(
            <div>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"10px",letterSpacing:"2px",
                textTransform:"uppercase",color:"#7a9e7e",margin:"0 0 14px"}}>
                Personalized Follow-Up
              </p>
              <div style={{height:"340px",overflowY:"auto",display:"flex",
                flexDirection:"column",gap:"14px",paddingRight:"4px",marginBottom:"16px"}}>
                {messages.map((msg,i)=>(
                  <div key={i} className="msg-in"
                    style={{display:"flex",
                      justifyContent:msg.role==="user"?"flex-end":"flex-start",
                      animationDelay:`${Math.min(i*.04,.15)}s`}}>
                    {msg.role==="assistant"&&(
                      <div style={{width:"30px",height:"30px",
                        background:"linear-gradient(135deg,#6a8f6e,#4a6e4e)",
                        borderRadius:"50%",display:"flex",alignItems:"center",
                        justifyContent:"center",fontSize:"13px",
                        marginRight:"10px",flexShrink:0,marginTop:"2px"}}>🌿</div>
                    )}
                    <div style={{maxWidth:"78%",padding:"12px 16px",
                      borderRadius:msg.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",
                      background:msg.role==="user"
                        ?"linear-gradient(135deg,#4a6e4e,#3d5940)":"white",
                      color:msg.role==="user"?"#f5f0e8":"#3d4a3a",
                      fontFamily:"'Jost',sans-serif",fontSize:"13.5px",
                      lineHeight:"1.7",fontWeight:"300",
                      boxShadow:msg.role==="user"
                        ?"0 2px 12px rgba(60,80,55,.2)":"0 2px 12px rgba(0,0,0,.05)",
                      border:msg.role==="assistant"?"1px solid rgba(165,190,165,.2)":"none",
                      whiteSpace:"pre-wrap"}}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading&&(
                  <div className="msg-in" style={{display:"flex",alignItems:"flex-start"}}>
                    <div style={{width:"30px",height:"30px",
                      background:"linear-gradient(135deg,#6a8f6e,#4a6e4e)",
                      borderRadius:"50%",display:"flex",alignItems:"center",
                      justifyContent:"center",fontSize:"13px",
                      marginRight:"10px",flexShrink:0}}>🌿</div>
                    <div style={{background:"white",borderRadius:"18px 18px 18px 4px",
                      border:"1px solid rgba(165,190,165,.2)",
                      boxShadow:"0 2px 12px rgba(0,0,0,.05)"}}>
                      <TypingIndicator/>
                    </div>
                  </div>
                )}
                <div ref={bottomRef}/>
              </div>
              <div style={{display:"flex",gap:"10px",alignItems:"flex-end"}}>
                <textarea ref={inputRef} value={input}
                  onChange={e=>setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Share what your skin has been doing..."
                  rows={2}
                  style={{flex:1,padding:"12px 16px",borderRadius:"14px",
                    border:"1.5px solid rgba(145,175,145,.3)",background:"white",
                    fontFamily:"'Jost',sans-serif",fontSize:"13.5px",
                    color:"#3d4a3a",fontWeight:"300",lineHeight:"1.5",
                    transition:"all .2s ease",boxShadow:"0 1px 6px rgba(0,0,0,.04)"}}/>
                <button className="sbtn" onClick={sendMessage}
                  disabled={loading||!input.trim()}
                  style={{background:loading||!input.trim()?"#b5c9b7":"#4a6e4e",
                    color:"white",border:"none",width:"46px",height:"46px",
                    borderRadius:"12px",
                    cursor:loading||!input.trim()?"default":"pointer",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    transition:"all .2s ease",flexShrink:0}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
                      stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"10px",
                color:"#b0bfa8",margin:"8px 0 0",letterSpacing:".3px"}}>
                Press Enter to send
              </p>
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
                Your Assessment Is Ready
              </h2>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"13.5px",color:"#6a7a65",
                lineHeight:"1.8",margin:"0 0 28px",fontWeight:"300"}}>
                Enter your email to reveal your Barrier Health Score and full personalized report. A copy will also be sent to your inbox.
              </p>
              <div style={{maxWidth:"360px",margin:"0 auto"}}>
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
                  disabled={submittingEmail||!email.trim()}
                  style={{width:"100%",background:"#4a6e4e",color:"#f5f0e8",
                    border:"none",padding:"15px",borderRadius:"50px",
                    fontFamily:"'Jost',sans-serif",fontSize:"11px",
                    letterSpacing:"2.5px",textTransform:"uppercase",
                    cursor:submittingEmail||!email.trim()?"default":"pointer",
                    transition:"all .25s ease",fontWeight:"500"}}>
                  {submittingEmail?"Preparing your report...":"Reveal My Barrier Health Report →"}
                </button>
              </div>
              <p style={{fontFamily:"'Jost',sans-serif",fontSize:"10px",
                color:"#b0bfa8",marginTop:"14px",letterSpacing:".3px"}}>
                No spam. Unsubscribe anytime. By submitting you agree to receive skincare guidance from Ritual Script.
              </p>
            </div>
          )}

          {/* REPORT */}
          {phase==="report"&&assessment&&(()=>{
            const ss=SCORE_STYLES[assessment.score]||SCORE_STYLES["Stressed"];
            return(
              <div className="fade-up">
                {/* Score badge */}
                <div style={{background:ss.bg,border:`1.5px solid ${ss.color}28`,
                  borderRadius:"16px",padding:"20px 24px",marginBottom:"28px",
                  display:"flex",alignItems:"center",gap:"16px"}}>
                  <div style={{width:"54px",height:"54px",borderRadius:"50%",
                    background:`${ss.color}16`,display:"flex",alignItems:"center",
                    justifyContent:"center",fontSize:"24px",flexShrink:0}}>
                    {ss.icon}
                  </div>
                  <div>
                    <div style={{fontFamily:"'Jost',sans-serif",fontSize:"9px",
                      letterSpacing:"2.5px",textTransform:"uppercase",
                      color:ss.color,opacity:.75,marginBottom:"4px"}}>
                      Your Barrier Health Score
                    </div>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",
                      fontSize:"28px",fontWeight:"400",color:ss.color,lineHeight:1}}>
                      {assessment.score}
                    </div>
                  </div>
                </div>

                {/* Report content */}
                <div style={{maxHeight:"380px",overflowY:"auto",
                  paddingRight:"8px",marginBottom:"24px"}}>
                  {formatReport(assessment.content)}
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
                  <a href={`mailto:${CONTACT_EMAIL}?subject=Barrier Health Assessment Follow-Up&body=Hi Rachel,%0D%0A%0D%0AI just completed the Barrier Health Assessment. My score was: ${assessment.score}.%0D%0A%0D%0AI have a question about my results.`}
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
                  A copy of this report has been sent to {userEmail} &nbsp;·&nbsp;
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
