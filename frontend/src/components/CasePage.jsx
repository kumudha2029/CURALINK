import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import {
  FaUser, FaVirus, FaMapMarkerAlt,
  FaFileAlt, FaMicroscope, FaCheckCircle,
  FaDownload, FaArrowLeft, FaClipboardList, FaUserMd
} from "react-icons/fa";

const API_BASE = "http://localhost:5000";

function CasePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPatientView, setIsPatientView] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/history/${id}`)
      .then(res => res.json())
      .then(data => {
        setCaseData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching case:", err);
        setLoading(false);
      });
  }, [id]);

  // ── Extract clinical summary ──
  const getClinicalSummary = (data) => {
    if (data.response && data.response.length > 10) return data.response;
    if (data.aiResponse && data.aiResponse.length > 10) return data.aiResponse;
    if (data.ai_response && data.ai_response.length > 10) return data.ai_response;
    if (data.summary && data.summary.length > 10) return data.summary;

    const msgs = Array.isArray(data.messages) ? data.messages : [];
    const botMsgs = msgs.filter(m => m.type === "bot" && m.text && m.text.length > 10);
    if (botMsgs.length > 0) return botMsgs[botMsgs.length - 1].text;

    return "No clinical summary available for this case.";
  };

  const getSources = (data) =>
    data.primarySources || data.topPapers || data.papers || data.sources || [];

  const getKeyTakeaways = (data) => {
    const val = data.keyTakeaways || data.key_takeaways || data.takeaways;
    return Array.isArray(val) && val.length > 0 ? val : [];
  };

  const getRiskLevel = (data) =>
    data.riskLevel ?? data.risk_level ?? data.risk ?? 65;

  // ── Patient-friendly simplification ──
  const getFriendlyText = (text) => {
    if (!text) return "No summary available.";
    const simplified = text
      .replace(/metastatic|malignancy|carcinoma/gi, "advanced stage cancer")
      .replace(/prognosis/gi, "expected health outlook")
      .replace(/hematologic/gi, "blood-related")
      .replace(/biomarker/gi, "genetic sign")
      .replace(/adverse events|toxicity/gi, "side effects")
      .replace(/therapeutic/gi, "healing")
      .replace(/efficacy/gi, "how well it works")
      .replace(/\[.*?\]/g, "")
      .trim();
    const sentences = simplified.match(/[^.!?]+[.!?]+/g) || [simplified];
    const result = sentences.slice(0, 4).join(" ").trim();
    return result.length > 10 ? result : simplified;
  };

  // ── PDF export ──
  const exportPDF = () => {
    if (!caseData) return;
    const doc = new jsPDF();
    const summary = isPatientView
      ? getFriendlyText(getClinicalSummary(caseData))
      : getClinicalSummary(caseData);
    const riskVal = getRiskLevel(caseData);

    doc.setFillColor(42, 91, 141);
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(22);
    doc.text("CuraLink Clinical Report", 15, 25);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 140, 25);

    let y = 50;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(10, y, 190, 35, 3, 3, "FD");
    doc.setTextColor(42, 91, 141); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text(`Patient: ${caseData.patientName || "—"}`, 15, y + 10);
    doc.text(`Condition: ${caseData.disease || "—"}`, 15, y + 20);
    doc.text(`Risk Level: ${riskVal}%`, 130, y + 10);
    y += 50;

    doc.setTextColor(14, 165, 164); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text("CLINICAL SUMMARY", 15, y); y += 8;
    doc.setTextColor(51, 65, 85); doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    const lines = doc.splitTextToSize(summary.replace(/[^\x00-\x7F]/g, ""), 180);
    doc.text(lines, 15, y, { lineHeightFactor: 1.5 });
    y += lines.length * 6 + 14;

    const takeaways = getKeyTakeaways(caseData);
    if (takeaways.length > 0) {
      doc.setTextColor(14, 165, 164); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
      doc.text("KEY TAKEAWAYS", 15, y); y += 8;
      doc.setTextColor(51, 65, 85); doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      takeaways.forEach(t => {
        const tlines = doc.splitTextToSize(`• ${t}`, 180);
        doc.text(tlines, 15, y); y += tlines.length * 6 + 4;
      });
    }

    doc.setFontSize(9); doc.setTextColor(150);
    doc.text("This report is AI-generated for clinical research assistance.", 105, 285, { align: "center" });
    doc.save(`CuraLink_Case_${caseData.patientName || id}.pdf`);
  };

  if (loading) return (
    <div style={{ ...pageWrapper, justifyContent: "center", alignItems: "center" }}>
      <p style={{ color: "white", fontSize: "20px" }}>Loading Clinical Report...</p>
    </div>
  );

  if (!caseData) return (
    <div style={{ ...pageWrapper, justifyContent: "center", alignItems: "center" }}>
      <p style={{ color: "white", fontSize: "20px" }}>Case record not found.</p>
    </div>
  );

  const clinicalSummary = getClinicalSummary(caseData);
  const sources = getSources(caseData);
  const takeaways = getKeyTakeaways(caseData);
  const riskVal = getRiskLevel(caseData);

  return (
    <div style={pageWrapper}>
      <div style={container}>
        <div style={topBar}>
          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={() => navigate("/history")} style={backBtn}>
              <FaArrowLeft /> Back to History
            </button>
            <button
              onClick={() => setIsPatientView(!isPatientView)}
              style={{ ...summaryBtn, background: isPatientView ? "#3b82f6" : "rgba(255,255,255,0.15)" }}
            >
              <FaClipboardList /> {isPatientView ? "View Clinical Data" : "Patient Summary"}
            </button>
          </div>
          <button onClick={exportPDF} style={pdfBtn}>
            <FaDownload /> Export Medical PDF
          </button>
        </div>

        <div style={headerCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "28px", textTransform: "capitalize" }}>
                <FaUser /> {caseData.patientName || "Unknown Patient"}
              </h1>
              <div style={metaRow}>
                <span><FaVirus /> {caseData.disease || "No diagnosis"}</span>
                <span><FaMapMarkerAlt /> India</span>
              </div>
            </div>
            <div style={statusBadge}>Verified Case</div>
          </div>
        </div>

        <div style={contentGrid}>
          <div style={card("#0ea5a4")}>
            <h3 style={cardTitle}>
              {isPatientView
                ? <><FaUserMd color="#0ea5a4" /> Simplified Patient Explanation</>
                : <><FaFileAlt color="#0ea5a4" /> Clinical Summary</>}
            </h3>
            <p style={textContent}>
              {isPatientView ? getFriendlyText(clinicalSummary) : clinicalSummary}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={card("#ef4444")}>
              <h3 style={cardTitle}><FaMicroscope color="#ef4444" /> Risk Analysis</h3>
              <div style={riskMeter}>
                <div style={{ ...riskFill, width: `${riskVal}%` }} />
              </div>
              <p style={highlight}>
                {riskVal >= 75 ? "High Risk" : "Moderate Risk"} ({riskVal}%)
              </p>
            </div>

            <div style={card("#3b82f6")}>
              <h3 style={cardTitle}><FaCheckCircle color="#3b82f6" /> Key Takeaways</h3>
              <ul style={listStyle}>
                {takeaways.length > 0 ? (
                  takeaways.map((item, idx) => <li key={idx}>{item}</li>)
                ) : (
                  <>
                    <li>Early diagnosis improves outcomes</li>
                    <li>Targeted therapy recommended</li>
                    <li>Regular monitoring required</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "20px" }}>
          <h3 style={{ color: "white", marginBottom: "15px" }}>📚 Source Publications</h3>
          <div style={grid}>
            {sources.length > 0 ? (
              sources.map((p, i) => (
                <div key={i} style={sourceCard}>
                  <h4 style={sourceTitle}>{p.title}</h4>
                  <p style={authorsStyle}>
                    {p.authors}{p.year ? ` · ${p.year}` : ""}
                  </p>
                  {p.snippet && (
                    <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px", fontStyle: "italic" }}>
                      {p.snippet}
                    </p>
                  )}
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer" style={linkStyle}>
                      View Publication →
                    </a>
                  ) : (
                    <span style={{ ...linkStyle, color: "#94a3b8", cursor: "default" }}>No link available</span>
                  )}
                </div>
              ))
            ) : (
              <p style={{ color: "rgba(255,255,255,0.6)" }}>No specific sources cited for this case.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Styles ─── */
const pageWrapper = {
  display: "flex",
  justifyContent: "center",
  background: "linear-gradient(135deg, #3b76b0 0%, #2a5b8d 60%, #1e3a5f 100%)",
  minHeight: "100vh",
  padding: "40px 20px",
  fontFamily: "'Segoe UI', system-ui, sans-serif",
};

const container = { width: "1000px", display: "flex", flexDirection: "column", gap: "25px" };
const topBar = { display: "flex", justifyContent: "space-between", marginBottom: "10px" };

const backBtn = {
  background: "rgba(255,255,255,0.15)",
  border: "1px solid rgba(255,255,255,0.2)",
  color: "white", padding: "10px 20px", borderRadius: "12px",
  cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", fontWeight: "600",
};

const summaryBtn = {
  border: "1px solid rgba(255,255,255,0.2)",
  color: "white", padding: "10px 20px", borderRadius: "12px",
  cursor: "pointer", display: "flex", alignItems: "center", gap: "10px",
  fontWeight: "600", transition: "0.3s",
};

const pdfBtn = {
  background: "#0ea5a4", color: "white", border: "none",
  padding: "10px 20px", borderRadius: "12px", cursor: "pointer",
  display: "flex", alignItems: "center", gap: "10px", fontWeight: "700",
};

const headerCard = {
  padding: "30px", borderRadius: "24px",
  background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)",
  border: "1px solid rgba(255,255,255,0.2)", color: "white",
};

const statusBadge = { background: "#22c55e", padding: "6px 15px", borderRadius: "20px", fontSize: "12px", fontWeight: "800" };
const contentGrid = { display: "grid", gridTemplateColumns: "2fr 1fr", gap: "25px" };

const card = (color) => ({
  padding: "25px", borderRadius: "20px", background: "white",
  borderTop: `6px solid ${color}`, boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
});

const cardTitle = { display: "flex", alignItems: "center", gap: "10px", margin: "0 0 15px 0", fontSize: "18px", fontWeight: "700" };
const textContent = { lineHeight: "1.8", color: "#334155", fontSize: "15.5px", whiteSpace: "pre-wrap" };
const metaRow = { display: "flex", gap: "20px", marginTop: "10px", fontSize: "14px", opacity: 0.8 };
const highlight = { fontWeight: "700", color: "#ef4444", marginTop: "10px", textAlign: "center" };
const listStyle = { paddingLeft: "20px", lineHeight: "2", color: "#475569" };
const riskMeter = { width: "100%", height: "8px", background: "#fee2e2", borderRadius: "10px", overflow: "hidden", marginTop: "10px" };
const riskFill = { height: "100%", background: "#ef4444", transition: "width 1s ease-in-out" };

const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" };
const sourceCard = { padding: "20px", borderRadius: "16px", background: "white", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" };
const sourceTitle = { fontSize: "15px", fontWeight: "700", marginBottom: "8px", color: "#1e293b" };
const authorsStyle = { fontSize: "12px", color: "#64748b", marginBottom: "8px" };
const linkStyle = { color: "#0ea5a4", fontSize: "13px", textDecoration: "none", fontWeight: "700" };

export default CasePage;