import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import jsPDF from "jspdf";
import {
  FaUser, FaVirus, FaMapMarkerAlt, FaFileAlt,
  FaMicroscope, FaCheckCircle, FaUserMd, FaDownload,
  FaPaperPlane, FaMicrophone, FaBook, FaFlask,
  FaExternalLinkAlt
} from "react-icons/fa";

import Sidebar from "./Sidebar";
import ChatHero from "./ChatHero";

const API_BASE = "http://localhost:5000";

/* ─── pure helpers (outside component) ───────────────────────── */

const simplifyMedicalText = (text) => {
  if (!text) return "";
  const s = text
    .replace(/metastatic|malignancy|carcinoma|adenocarcinoma/gi, "advanced cancer")
    .replace(/biomarker|sequencing|genomic/gi, "genetic signature")
    .replace(/standard of care|protocol|regimen/gi, "usual treatment path")
    .replace(/contraindicated|adverse indication/gi, "not a good fit")
    .replace(/prognosis|survival outcomes/gi, "expected future health")
    .replace(/hematologic|neutropenia/gi, "blood-related")
    .replace(/adverse events|toxicity/gi, "side effects")
    .replace(/therapeutic/gi, "healing")
    .replace(/efficacy/gi, "how well it works")
    .replace(/\[.*?\]/g, "").trim();
  const sents = s.match(/[^.!?]+[.!?]+/g) || [s];
  return sents.slice(0, 4).join(" ").trim();
};

const cleanText = (t = "") =>
  t.replace(/[^\x00-\x7F]/g,"").replace(/\b([A-Z])\s(?=[a-z])/g,"$1")
   .replace(/\$\$.*?\$\$/g,"").replace(/•/g,"-").replace(/[ØÝì=]/g,"")
   .replace(/\s+/g," ").trim();

const getRiskColor = (l) => l >= 75 ? "#ef4444" : l >= 50 ? "#f59e0b" : "#22c55e";

// try multiple backend field-name variants
const pick = (obj, ...keys) => {
  for (const k of keys) if (obj[k] != null) return obj[k];
  return undefined;
};

/* parseEvidence — paste this right after the pick() function */
const parseEvidence = (data) => {
  const text = data.aiResponse || data.response || "";

  // 1. Use structured arrays if backend provides them
  let papers = pick(data, "topPapers", "primarySources", "papers", "sources");
  let trials = pick(data, "clinicalTrials", "clinical_trials", "trials");

  // 2. Parse papers from "Key Research Insights:" bullets in AI text
  if (!Array.isArray(papers) || papers.length === 0) {
    const kri = text.indexOf("Key Research Insights");
    if (kri !== -1) {
      const end = text.search(/Clinical Trials|Interpretation|Conclusion|\n\n[^\s•]/i);
      const section = text.slice(kri, end > kri ? end : kri + 600);
      papers = section
        .split("•")
        .slice(1)
        .map(b => b.trim())
        .filter(b => b.length > 15)
        .map(b => {
          const ym = b.match(/\((\d{4})\)/);
          const title = b.replace(/\(\d{4}\).*$/, "").replace(/highlights.*$/i, "").trim();
          return {
            title   : title.slice(0, 120) || b.slice(0, 80),
            authors : "",
            year    : ym ? ym[1] : "",
            snippet : b.slice(0, 160),
            url     : null,
          };
        })
        .filter(p => p.title.length > 5);
    }
  }

  // 3. Parse trials from "Clinical Trials:" bullets in AI text
  if (!Array.isArray(trials) || trials.length === 0) {
    const ct = text.indexOf("Clinical Trials");
    if (ct !== -1) {
      const end = text.search(/Interpretation|Conclusion|\n\n[^\s•]/i);
      const section = text.slice(ct, end > ct ? end : ct + 400);
      trials = section
        .split("•")
        .slice(1)
        .map(b => b.trim())
        .filter(b => b.length > 8)
        .map(b => {
          const sm = b.match(/\(([A-Z]+)\)/);
          const title = b.replace(/\([A-Z]+\)/, "").trim();
          return {
            title    : title.slice(0, 120) || b.slice(0, 80),
            status   : sm ? sm[1] : "UNKNOWN",
            location : "India",
          };
        })
        .filter(t => t.title.length > 5);
    }
  }

  return {
    papers : Array.isArray(papers) ? papers : [],
    trials : Array.isArray(trials) ? trials : [],
  };
};



/* ─── Claude API: extract structured takeaways + insight ───────── */
const extractWithClaude = async (aiText, patientName, disease, location) => {
  try {
    const prompt = `You are a clinical AI assistant. Given this medical AI response, extract:
1. KEY TAKEAWAYS: exactly 3-4 concise, clinically meaningful bullet points a doctor would act on. Each should be 1 sentence, specific, and actionable or informative.
2. PERSONALIZED INSIGHT: 1-2 sentences specifically relevant to the patient "${patientName}" with condition "${disease}" ${location ? `in ${location}` : ""}. Make it feel genuinely personalized, not generic.

Return ONLY valid JSON, no markdown, no explanation:
{
  "keyTakeaways": ["...", "...", "..."],
  "personalizedInsight": "..."
}

Medical AI response to analyze:
"""
${aiText.slice(0, 3000)}
"""`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const raw = (data.content || []).map(b => b.text || "").join("").trim();
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      takeaways : Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
      insight   : typeof parsed.personalizedInsight === "string" ? parsed.personalizedInsight : "",
    };
  } catch (e) {
    console.warn("Claude extraction failed:", e);
    return { takeaways: [], insight: "" };
  }
};

const LOADING_STEPS = [
  "Scanning clinical knowledge base...",
  "Cross-referencing biomarkers...",
  "Analyzing trial outcomes...",
  "Synthesizing AI diagnosis...",
  "Processing Clinical Data...",
];

/* ════════════════════════════════════════════════════════════════
   ChatPage
════════════════════════════════════════════════════════════════ */
function ChatPage() {
  const location = useLocation();
  const endRef   = useRef(null);

  const [messages,            setMessages]            = useState([]);
  const [input,               setInput]               = useState("");
  const [loading,             setLoading]             = useState(false);
  const [listening,           setListening]           = useState(false);
  const [darkMode,            setDarkMode]            = useState(false);
  const [privacyMode,         setPrivacyMode]         = useState(false);
  const [patientMode,         setPatientMode]         = useState(false);
  const [currentCase,         setCurrentCase]         = useState(null);
  const [localHistory,        setLocalHistory]        = useState([]);
  const [riskLevel,           setRiskLevel]           = useState(60);
  const [keyTakeaways,        setKeyTakeaways]        = useState([]);
  const [personalizedInsight, setPersonalizedInsight] = useState("");
  const [evidence,            setEvidence]            = useState({ papers: [], trials: [] });

  /* auto-scroll */
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  /* CSS keyframes */
  useEffect(() => {
    const id = "cura-kf";
    if (!document.getElementById(id)) {
      const s = document.createElement("style"); s.id = id;
      s.textContent = `
        @keyframes curaBounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-8px);opacity:1}}
        @keyframes curaFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes micPulse{0%,100%{box-shadow:0 0 0 4px rgba(239,68,68,0.25)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0.1)}}
        @keyframes recDot{0%,100%{opacity:1}50%{opacity:0.2}}
      `;
      document.head.appendChild(s);
    }
    return () => { const el = document.getElementById("cura-kf"); if (el) el.remove(); };
  }, []);

  /* load history sidebar on mount */
  useEffect(() => {
    fetch(`${API_BASE}/api/history`)
      .then(r => r.json())
      .then(data => setLocalHistory(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  /* ── restore session when arriving from HistoryPage "Continue" ── */
  useEffect(() => {
    if (!location.state?.resumeChat) return;
    const { prevMessages, patientName, disease,
            riskLevel: rl, keyTakeaways: kt,
            personalizedInsight: pi, primarySources, clinicalTrials } = location.state;
    setMessages(prevMessages || []);
    setCurrentCase({ patientName, disease });
    setRiskLevel(rl ?? 60);
    setKeyTakeaways(kt || []);
    setPersonalizedInsight(pi || "");
    setEvidence(parseEvidence({
      aiResponse     : location.state.response || location.state.aiResponse || "",
      topPapers      : primarySources,
      clinicalTrials : clinicalTrials,
    }));
    window.history.replaceState({}, ""); // clear so refresh doesn't re-restore
  }, [location.state]);

  /* ── AnimatedLoadingText ── */
  const AnimatedLoadingText = () => {
    const [idx, setIdx] = useState(0);
    useEffect(() => {
      const iv = setInterval(() => setIdx(i => (i + 1) % LOADING_STEPS.length), 1400);
      return () => clearInterval(iv);
    }, []);
    return (
      <span key={idx} style={{ fontStyle:"italic", fontSize:"0.84rem", color:"#e2e8f0", animation:"curaFadeIn 0.4s ease both" }}>
        {LOADING_STEPS[idx]}
      </span>
    );
  };

  /* ══════════════════════════════════════════════════════════════
     THE CORE FIX — restoreSession is passed to Sidebar as
     onSelectChat. When a user clicks a sidebar item, this
     restores messages + all analysis state instantly.
  ══════════════════════════════════════════════════════════════ */
  const restoreSession = (item) => {
    setMessages(item.messages || []);
    setCurrentCase({
      patientName : item.patientName,
      disease     : item.disease,
      location    : item.location,
      query       : item.symptoms || item.query,
    });
    setRiskLevel(pick(item, "riskLevel","risk_level","risk") ?? 60);
    setKeyTakeaways(pick(item, "keyTakeaways","key_takeaways","takeaways") || []);
    setPersonalizedInsight(pick(item, "personalizedInsight","personalized_insight","insight") || "");
    setEvidence(parseEvidence({
      aiResponse     : item.response || item.aiResponse || "",
      topPapers      : pick(item, "primarySources","topPapers","papers","sources"),
      clinicalTrials : item.clinicalTrials,
    }));
    setPatientMode(false);
    setInput("");
  };

  /* ── typeText: typing animation, then save to DB ── */
  const typeText = (text, updatedCase, data) => {
    let i = 0, temp = "";
    const normedTakeaways = pick(data,"keyTakeaways","key_takeaways","takeaways") || [];
    const normedInsight   = pick(data,"personalizedInsight","personalized_insight","insight") || "";
    const normedRisk      = pick(data,"riskLevel","risk_level","risk") ?? 60;

    setMessages(prev => [...prev, { type:"bot", text:"" }]);

    const iv = setInterval(() => {
      temp += text[i];
      setMessages(prev => {
        const up = [...prev];
        up[up.length - 1] = { ...up[up.length - 1], text: temp };
        return up;
      });
      i++;

      if (i >= text.length) {
        clearInterval(iv);
        setRiskLevel(normedRisk);
        setKeyTakeaways(Array.isArray(normedTakeaways) ? normedTakeaways : []);
        setPersonalizedInsight(typeof normedInsight === "string" ? normedInsight : "");

        setMessages(current => {
          const payload = {
            ...updatedCase,
            symptoms            : updatedCase.query,
            response            : text,
            messages            : current,
            primarySources      : parseEvidence(data).papers,
            clinicalTrials      : parseEvidence(data).trials,
            riskLevel           : normedRisk,
            keyTakeaways        : Array.isArray(normedTakeaways) ? normedTakeaways : [],
            personalizedInsight : typeof normedInsight === "string" ? normedInsight : "",
          };
          setLocalHistory(h => {
            const rest = h.filter(x =>
              !(x.patientName === payload.patientName && x.disease === payload.disease));
            return [payload, ...rest];
          });
          fetch(`${API_BASE}/api/history/save`, {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify(payload),
          }).catch(e => console.error("Save failed:", e));
          return current;
        });
      }
    }, 15);
  };

  /* ── handleSend ── */
  const handleSend = async (formData = {}) => {
    const queryText = formData.query || input;
    if (!queryText.trim()) return;

    setMessages(prev => [...prev, { type:"user", text:queryText }]);
    setInput(""); setLoading(true); setPatientMode(false);
    // Clear stale values so cards show a loading state
    setKeyTakeaways([]);
    setPersonalizedInsight("");

    const updatedCase = { ...currentCase, ...formData, query: queryText };
    setCurrentCase(updatedCase);

    try {
      const res  = await fetch(`${API_BASE}/api/chat`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(updatedCase),
      });
      const data = await res.json();

      const backendTakeaways = pick(data,"keyTakeaways","key_takeaways","takeaways");
      const backendInsight   = pick(data,"personalizedInsight","personalized_insight","insight");
      const normedRisk       = pick(data,"riskLevel","risk_level","risk") ?? 60;

      setEvidence(parseEvidence(data));
      setRiskLevel(normedRisk);

      const aiText = data.aiResponse || data.response || "";

      const hasTakeaways = Array.isArray(backendTakeaways) && backendTakeaways.length > 0;
      const hasInsight   = typeof backendInsight === "string" && backendInsight.trim().length > 10;

      if (hasTakeaways) setKeyTakeaways(backendTakeaways);
      if (hasInsight)   setPersonalizedInsight(backendInsight);

      // Typing animation starts immediately; Claude extraction runs in parallel
      typeText(aiText || "No response received.", updatedCase, data);

      if (!hasTakeaways || !hasInsight) {
        extractWithClaude(
          aiText,
          updatedCase.patientName || "the patient",
          updatedCase.disease     || "this condition",
          updatedCase.location    || ""
        ).then(({ takeaways, insight }) => {
          if (!hasTakeaways && takeaways.length > 0) setKeyTakeaways(takeaways);
          if (!hasInsight   && insight)              setPersonalizedInsight(insight);
        });
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { type:"bot", text:"Server error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  /* ── voice ── */
  const recognizerRef = useRef(null);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("Voice input is not supported in this browser. Try Chrome.");

    // Toggle off if already listening
    if (listening) {
      recognizerRef.current?.stop();
      setListening(false);
      return;
    }

    const r = new SR();
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = false;
    recognizerRef.current = r;

    r.start();
    setListening(true);

    r.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
    };
    r.onend   = () => setListening(false);
    r.onerror = () => setListening(false);
  };

  /* ── PDF export ── */
  const exportPDF = () => {
    const doc = new jsPDF(); let y = 0;
    doc.setFillColor(42,91,141); doc.rect(0,0,210,40,"F");
    doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(22);
    doc.text("CuraLink Clinical Report",15,25);
    doc.setFontSize(10); doc.setFont("helvetica","normal");
    doc.text(`Generated: ${new Date().toLocaleDateString()}`,140,25);
    y = 50;
    doc.setFillColor(248,250,252); doc.roundedRect(10,y,190,35,3,3,"FD");
    doc.setTextColor(42,91,141); doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.text(`Patient: ${currentCase?.patientName||"—"}`,15,y+10);
    doc.text(`Condition: ${currentCase?.disease||"—"}`,15,y+20);
    doc.text(`Location: ${currentCase?.location||"—"}`,130,y+10);
    doc.text(`Case ID: #${Date.now().toString().slice(-6)}`,130,y+20); y+=50;
    const addSection = (title, content) => {
      if (!content) return;
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setTextColor(14,165,164); doc.setFont("helvetica","bold"); doc.setFontSize(13);
      doc.text(title.toUpperCase(),15,y); y+=8;
      doc.setTextColor(51,65,85); doc.setFont("helvetica","normal"); doc.setFontSize(11);
      const lines = doc.splitTextToSize(cleanText(content).replace(/\.\s/g,".\n"),180);
      doc.text(lines,15,y,{lineHeightFactor:1.5}); y+=lines.length*6+12;
    };
    let pt="",at="";
    messages.forEach(m => {
      if (m.type==="user") pt+=cleanText(m.text)+"\n\n";
      else at+=cleanText(patientMode ? simplifyMedicalText(m.text) : m.text)+"\n\n";
    });
    addSection("Patient Input",pt); addSection("AI Analysis",at);
    doc.setFontSize(9); doc.setTextColor(150);
    doc.text("This report is AI-generated for clinical research assistance.",105,285,{align:"center"});
    doc.save(`CuraLink_Report_${Date.now()}.pdf`);
  };

  /* ════ RENDER ═══════════════════════════════════════════════ */
  return (
    <div style={pageWrapper}>

      {/* Sidebar now receives onSelectChat which restores the full session */}
      <Sidebar
        chats={localHistory}
        onSelectChat={restoreSession}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        privacyMode={privacyMode}
        setPrivacyMode={setPrivacyMode}
        clearChat={() => {
          setMessages([]); setCurrentCase(null);
          setEvidence({papers:[],trials:[]});
          setKeyTakeaways([]); setPersonalizedInsight(""); setRiskLevel(60);
        }}
      />

      <div style={mainContainer}>
        {messages.length === 0 ? (
          <ChatHero onSend={handleSend} darkMode={darkMode} />
        ) : (
          <div style={clinicalGrid}>

            {/* LEFT: chat */}
            <div style={chatColumnStyle}>
              {currentCase && (
                <div style={patientNav(darkMode)}>
                  <div style={patientNavItem}>
                    <FaUser style={{color:"#0369a1",fontSize:"0.72rem"}}/>
                    <span style={patientNavLabel}>Patient</span>
                    <span style={patientNavValue(darkMode)}>{currentCase.patientName||"—"}</span>
                  </div>
                  <div style={navDivider}/>
                  <div style={patientNavItem}>
                    <FaVirus style={{color:"#dc2626",fontSize:"0.72rem"}}/>
                    <span style={patientNavLabel}>Condition</span>
                    <span style={patientNavValue(darkMode)}>{currentCase.disease||"—"}</span>
                  </div>
                  <div style={navDivider}/>
                  <div style={patientNavItem}>
                    <FaMapMarkerAlt style={{color:"#16a34a",fontSize:"0.72rem"}}/>
                    <span style={patientNavLabel}>Location</span>
                    <span style={patientNavValue(darkMode)}>{currentCase.location||"—"}</span>
                  </div>
                  <div style={{marginLeft:"auto"}}>
                    <span style={liveChip}>● LIVE</span>
                  </div>
                </div>
              )}

              <div style={messagesArea}>
                {messages.map((msg,i) => (
                  <div key={i}>
                    {msg.type==="user" ? (
                      <div style={userBubbleRow}>
                        <div style={userBubble}>
                          <span style={queryLabel}>Your Query</span>
                          {msg.text}
                        </div>
                      </div>
                    ) : (
                      <div style={botContainer}>
                        <div style={aiCard(patientMode?"#16a34a":"#0369a1")}>
                          <div style={cardLabel(patientMode?"#16a34a":"#0369a1")}>
                            {patientMode?<FaUserMd style={{marginRight:"5px"}}/>:<FaFileAlt style={{marginRight:"5px"}}/>}
                            {patientMode?"PATIENT-FRIENDLY EXPLANATION":"CLINICAL SUMMARY"}
                          </div>
                          <p style={{margin:0,lineHeight:1.8,fontSize:"1rem",color:"#1e293b"}}>
                            {patientMode
                              ? (() => {
                                  const s=simplifyMedicalText(msg.text);
                                  const sents=s.match(/[^.!?]+[.!?]+/g)||[s];
                                  return `In simple terms: ${sents.slice(0,4).join(" ").trim()}`;
                                })()
                              : msg.text}
                          </p>
                        </div>

                        {i===messages.length-1 && (
                          <>
                            <div style={aiCard("#ef4444")}>
                              <div style={cardLabel("#ef4444")}>
                                <FaMicroscope style={{marginRight:"5px"}}/> RISK ANALYSIS
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:"14px",marginTop:"8px"}}>
                                <span style={{fontSize:"1.9rem",fontWeight:800,color:getRiskColor(riskLevel)}}>
                                  {riskLevel}%
                                </span>
                                <div style={{flex:1}}>
                                  <div style={progressBar}>
                                    <div style={{...progressFill,width:`${riskLevel}%`,background:getRiskColor(riskLevel)}}/>
                                  </div>
                                  <span style={{fontSize:"0.72rem",color:"#64748b",marginTop:"4px",display:"block"}}>
                                    {riskLevel>=75?"High Risk":riskLevel>=50?"Moderate Risk":"Low Risk"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div style={aiCard("#0891b2")}>
                              <div style={cardLabel("#0891b2")}>
                                <FaCheckCircle style={{marginRight:"5px"}}/> KEY TAKEAWAYS
                              </div>
                              {keyTakeaways.length>0
                                ? keyTakeaways.map((k,idx)=>(
                                    <div key={idx} style={takeawayItem}>
                                      <span style={{...takeawayDot, background:"#0891b2"}}/>
                                      <span style={{color:"#1e293b", fontSize:"0.87rem", lineHeight:1.6}}>{k}</span>
                                    </div>
                                  ))
                                : <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"4px 0"}}>
                                    <div style={{display:"flex",gap:"4px"}}>
                                      <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"#0891b2",display:"inline-block",animation:"curaBounce 1.1s ease-in-out infinite",animationDelay:"0s"}}/>
                                      <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"#0891b2",display:"inline-block",animation:"curaBounce 1.1s ease-in-out infinite",animationDelay:"0.2s"}}/>
                                      <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"#0891b2",display:"inline-block",animation:"curaBounce 1.1s ease-in-out infinite",animationDelay:"0.4s"}}/>
                                    </div>
                                    <p style={{margin:0,fontSize:"0.85rem",color:"#94a3b8",fontStyle:"italic"}}>
                                      Extracting clinical takeaways…
                                    </p>
                                  </div>}
                            </div>

                            <div style={aiCard("#16a34a")}>
                              <div style={cardLabel("#16a34a")}>
                                <FaUserMd style={{marginRight:"5px"}}/> PERSONALIZED INSIGHT
                              </div>
                              {personalizedInsight
                                ? <p style={{margin:0,lineHeight:1.7,fontSize:"0.9rem",color:"#1e293b",borderLeft:"3px solid #16a34a",paddingLeft:"10px"}}>
                                    {personalizedInsight}
                                  </p>
                                : <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"4px 0"}}>
                                    <div style={{display:"flex",gap:"4px"}}>
                                      <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"#16a34a",display:"inline-block",animation:"curaBounce 1.1s ease-in-out infinite",animationDelay:"0s"}}/>
                                      <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"#16a34a",display:"inline-block",animation:"curaBounce 1.1s ease-in-out infinite",animationDelay:"0.2s"}}/>
                                      <span style={{width:"6px",height:"6px",borderRadius:"50%",background:"#16a34a",display:"inline-block",animation:"curaBounce 1.1s ease-in-out infinite",animationDelay:"0.4s"}}/>
                                    </div>
                                    <p style={{margin:0,fontSize:"0.85rem",color:"#94a3b8",fontStyle:"italic"}}>
                                      Personalizing insight for this patient…
                                    </p>
                                  </div>}
                            </div>
                          </>
                        )}

                        {i===messages.length-1 && (
                          <button style={explainBtn(patientMode)} onClick={()=>setPatientMode(!patientMode)}>
                            <FaUserMd/> {patientMode?"Back to Clinical View":"Explain to Patient"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={endRef}/>
                {loading && (
                  <div style={pulseLoader}>
                    <div style={dotsWrapper}>
                      <span style={{...bounceDot,animationDelay:"0s"}}/>
                      <span style={{...bounceDot,animationDelay:"0.18s"}}/>
                      <span style={{...bounceDot,animationDelay:"0.36s"}}/>
                    </div>
                    <AnimatedLoadingText/>
                  </div>
                )}
              </div>

              <div style={stickyInputBar(darkMode)}>
                {listening && (
                  <div style={recordingBanner}>
                    <span style={recordingDot}/>
                    <span style={{fontSize:"0.78rem",fontWeight:600,color:"#dc2626"}}>Recording… tap mic to stop</span>
                  </div>
                )}
                <div style={{display:"flex",gap:"8px",width:"100%"}}>
                  <input
                    value={input} onChange={e=>setInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&handleSend({})}
                    placeholder={listening?"🎙 Listening — speak now…":"Ask a follow-up clinical question..."}
                    style={{...inputBox(darkMode), ...(listening ? {borderColor:"#ef4444",boxShadow:"0 0 0 2px rgba(239,68,68,0.2)"} : {})}}
                  />
                  <button onClick={()=>handleSend({})} style={iconBtn("#0369a1")} title="Send">
                    <FaPaperPlane style={{fontSize:"0.82rem"}}/>
                  </button>
                  <button
                    onClick={startListening}
                    style={{
                      ...iconBtn(listening ? "#ef4444" : "#64748b"),
                      position:"relative",
                      boxShadow: listening ? "0 0 0 4px rgba(239,68,68,0.25)" : "none",
                      animation: listening ? "micPulse 1.2s ease-in-out infinite" : "none",
                    }}
                    title={listening ? "Stop recording" : "Start voice input"}
                  >
                    <FaMicrophone style={{fontSize:"0.82rem"}}/>
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT: evidence */}
            <div style={evidenceColumn(darkMode)}>
              <button onClick={exportPDF} style={exportBtn}>
                <FaDownload style={{marginRight:"7px"}}/> Export PDF Report
              </button>

              <div style={evidenceSection}>
                <div style={evidenceSectionHeader(darkMode)}>
                  <FaBook style={{color:"#0369a1",marginRight:"6px"}}/>
                  Source Attribution
                  <span style={countBadge("#dbeafe","#0369a1")}>{evidence.papers.length}</span>
                </div>
                <div style={evidenceScrollArea}>
                  {evidence.papers.length===0
                    ? <p style={emptyText}>No papers cited yet.</p>
                    : evidence.papers.map((p,i)=>(
                        <div key={i} style={paperCard(darkMode)}>
                          <p style={{margin:"0 0 4px",fontWeight:700,fontSize:"0.84rem",lineHeight:1.4,color:"#1e293b"}}>{p.title}</p>
                          <p style={{margin:"0 0 6px",fontSize:"0.74rem",color:"#64748b"}}>{p.authors} · {p.year}</p>
                          {p.snippet&&<p style={{margin:"0 0 7px",fontSize:"0.79rem",fontStyle:"italic",color:"#64748b",lineHeight:1.5}}>{p.snippet}</p>}
                          <a href={p.url} target="_blank" rel="noreferrer" style={sourceLink}>
                            <FaExternalLinkAlt style={{marginRight:"4px",fontSize:"0.62rem"}}/> View Source
                          </a>
                        </div>
                      ))}
                </div>
              </div>

              <div style={evidenceSection}>
                <div style={evidenceSectionHeader(darkMode)}>
                  <FaFlask style={{color:"#16a34a",marginRight:"6px"}}/>
                  Clinical Trials
                  <span style={countBadge("#dcfce7","#16a34a")}>{evidence.trials.length}</span>
                </div>
                <div style={evidenceScrollArea}>
                  {evidence.trials.length===0
                    ? <p style={emptyText}>No active trials found.</p>
                    : evidence.trials.map((t,i)=>(
                        <div key={i} style={trialCard(darkMode)}>
                          <p style={{margin:"0 0 8px",fontWeight:700,fontSize:"0.84rem",lineHeight:1.4,color:"#1e293b"}}>{t.title}</p>
                          <div style={{display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center"}}>
                            <span style={trialBadge(t.status==="COMPLETED"?"#16a34a":t.status==="RECRUITING"?"#0369a1":"#f59e0b")}>
                              ● {t.status || "UNKNOWN"}
                            </span>
                            {(t.location || currentCase?.location) && (
                              <span style={{...trialBadge("#6366f1"), display:"flex", alignItems:"center", gap:"3px"}}>
                                <FaMapMarkerAlt style={{fontSize:"0.6rem"}}/> {t.location || currentCase?.location}
                              </span>
                            )}
                            {t.phase && (
                              <span style={trialBadge("#64748b")}>Phase {t.phase}</span>
                            )}
                          </div>
                        </div>
                      ))}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const pageWrapper        = { display:"flex", background:"linear-gradient(135deg,#3b76b0 0%,#2a5b8d 60%,#1e3a5f 100%)", minHeight:"100vh", fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#ffffff" };
const mainContainer      = { flex:1, marginLeft:"260px", display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden" };
const clinicalGrid       = { display:"grid", gridTemplateColumns:"1.6fr 1fr", height:"100%", overflow:"hidden" };
const aiCard = (accent)  => ({ padding:"14px 16px", background:"rgba(255,255,255,0.92)", borderRadius:"12px", borderLeft:`4px solid ${accent}`, color:"#1e293b", boxShadow:"0 8px 32px rgba(0,0,0,0.1)" });
const chatColumnStyle    = { display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", borderRight:"1px solid #e2e8f0" };
const patientNav = (d)   => ({ display:"flex", alignItems:"center", padding:"10px 24px", background:d?"#1e293b":"#ffffff", borderBottom:`1px solid ${d?"#334155":"#e2e8f0"}`, flexShrink:0, gap:0 });
const patientNavItem     = { display:"flex", alignItems:"center", gap:"6px" };
const patientNavLabel    = { fontSize:"0.67rem", textTransform:"uppercase", letterSpacing:"0.06em", color:"#94a3b8", fontWeight:600 };
const patientNavValue = (d) => ({ fontSize:"0.87rem", fontWeight:700, color:d?"#e2e8f0":"#1e293b", marginLeft:"2px" });
const navDivider         = { width:"1px", height:"24px", background:"#e2e8f0", margin:"0 16px" };
const liveChip           = { background:"#fef2f2", color:"#dc2626", fontSize:"0.67rem", fontWeight:800, padding:"3px 10px", borderRadius:"20px", letterSpacing:"0.05em" };
const messagesArea       = { flex:1, overflowY:"auto", padding:"22px 26px 10px", display:"flex", flexDirection:"column", gap:"16px" };
const userBubbleRow      = { display:"flex", justifyContent:"flex-end" };
const userBubble         = { background:"linear-gradient(135deg,#0369a1,#0284c7)", color:"#fff", padding:"11px 16px", borderRadius:"18px 18px 4px 18px", maxWidth:"76%", fontSize:"0.9rem", lineHeight:1.6, display:"flex", flexDirection:"column", gap:"3px", boxShadow:"0 2px 10px rgba(3,105,161,0.22)" };
const queryLabel         = { fontSize:"0.62rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", opacity:0.72 };
const botContainer       = { display:"flex", flexDirection:"column", gap:"10px" };
const cardLabel = (c)    => ({ fontSize:"0.63rem", fontWeight:800, textTransform:"uppercase", letterSpacing:"0.09em", color:c, marginBottom:"9px", display:"flex", alignItems:"center" });
const takeawayItem       = { display:"flex", alignItems:"center", gap:"8px", fontSize:"0.87rem", padding:"3px 0", lineHeight:1.5 };
const takeawayDot        = { width:"6px", height:"6px", borderRadius:"50%", background:"#0891b2", flexShrink:0 };
const explainBtn = (a)   => ({ width:"fit-content", marginTop:"10px", padding:"10px 20px", borderRadius:"25px", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:"8px", fontSize:"0.85rem", fontWeight:"600", background:a?"#16a34a":"#ffffff", color:a?"#ffffff":"#0369a1", boxShadow:"0 4px 12px rgba(0,0,0,0.15)", transition:"all 0.3s ease" });
const stickyInputBar = (d) => ({ flexShrink:0, display:"flex", flexDirection:"column", gap:"0", padding:"10px 24px 12px", background:d?"#1e293b":"#ffffff", borderTop:`1px solid ${d?"#334155":"#e2e8f0"}` });
const inputBox = (d)     => ({ flex:1, padding:"10px 18px", borderRadius:"24px", border:`1.5px solid ${d?"#334155":"#cbd5e1"}`, outline:"none", background:d?"#0f172a":"#f8fafc", color:d?"#e2e8f0":"#1e293b", fontSize:"0.9rem" });
const iconBtn = (c)      => ({ width:"40px", height:"40px", borderRadius:"50%", border:"none", background:c, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 });
const progressBar        = { height:"7px", background:"#e2e8f0", borderRadius:"4px", overflow:"hidden" };
const progressFill       = { height:"100%", borderRadius:"4px", transition:"width 0.6s ease" };
const pulseLoader        = { display:"flex", alignItems:"center", gap:"12px", padding:"14px 18px", background:"rgba(255,255,255,0.08)", borderRadius:"14px", backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,0.15)", maxWidth:"360px", boxShadow:"0 4px 20px rgba(0,0,0,0.15)" };
const dotsWrapper        = { display:"flex", alignItems:"center", gap:"5px", flexShrink:0 };
const bounceDot          = { display:"inline-block", width:"9px", height:"9px", borderRadius:"50%", background:"linear-gradient(135deg,#38bdf8,#818cf8)", animation:"curaBounce 1.1s ease-in-out infinite", boxShadow:"0 0 6px rgba(56,189,248,0.6)" };
const evidenceColumn=(d) => ({ display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", background:d?"#0f172a":"#f8fafc", padding:"16px", gap:"14px", borderLeft:`1px solid ${d?"#1e293b":"#e2e8f0"}` });
const exportBtn          = { display:"flex", alignItems:"center", justifyContent:"center", padding:"10px 16px", background:"linear-gradient(135deg,#0369a1 0%,#0284c7 100%)", color:"#fff", border:"none", borderRadius:"10px", cursor:"pointer", fontSize:"0.84rem", fontWeight:600, letterSpacing:"0.02em", boxShadow:"0 2px 10px rgba(3,105,161,0.28)", flexShrink:0 };
const evidenceSection    = { display:"flex", flexDirection:"column", flex:1, overflow:"hidden", minHeight:0 };
const evidenceSectionHeader=(d)=>({ display:"flex", alignItems:"center", fontSize:"0.72rem", fontWeight:800, textTransform:"uppercase", letterSpacing:"0.07em", color:"#475569", padding:"0 0 9px 0", borderBottom:`1px solid ${d?"#1e293b":"#e2e8f0"}`, marginBottom:"10px", flexShrink:0 });
const countBadge=(bg,c)  => ({ marginLeft:"auto", background:bg, color:c, fontSize:"0.7rem", fontWeight:700, padding:"2px 8px", borderRadius:"12px" });
const evidenceScrollArea = { flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:"10px", paddingRight:"2px" };
const paperCard=(d)      => ({ padding:"11px 13px", borderRadius:"10px", background:d?"#1e293b":"#ffffff", border:`1px solid ${d?"#334155":"#e2e8f0"}`, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" });
const trialCard=(d)      => ({ padding:"11px 13px", borderRadius:"10px", background:d?"#1e293b":"#ffffff", border:`1px solid ${d?"#334155":"#e2e8f0"}`, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" });
const sourceLink         = { display:"inline-flex", alignItems:"center", color:"#0369a1", fontSize:"0.74rem", fontWeight:600, textDecoration:"none" };
const trialBadge=(c)     => ({ fontSize:"0.72rem", fontWeight:600, color:c, background:c+"18", padding:"2px 8px", borderRadius:"10px" });
const emptyText          = { fontSize:"0.8rem", color:"#94a3b8", fontStyle:"italic", textAlign:"center", padding:"16px 0" };
const recordingBanner    = { display:"flex", alignItems:"center", gap:"8px", padding:"6px 12px", background:"#fef2f2", borderRadius:"8px", border:"1px solid #fecaca", marginBottom:"6px", width:"100%" };
const recordingDot       = { width:"10px", height:"10px", borderRadius:"50%", background:"#ef4444", flexShrink:0, animation:"recDot 1s ease-in-out infinite", display:"inline-block" };

export default ChatPage;