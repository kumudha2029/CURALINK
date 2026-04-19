import {
  FaPlus,
  FaHistory,
  FaLock,
  FaUnlock,
} from "react-icons/fa";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function Sidebar({
  chats = [],
  onSelectChat,
  setExtraQuery,
  clearChat,
  privacyMode,
  setPrivacyMode
}) {
  const [history, setHistory] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [password, setPassword] = useState(localStorage.getItem("privacyPassword") || "");
  const [modal, setModal] = useState({ show: false, type: "", value: "" });

  const navigate = useNavigate();

  useEffect(() => {
    fetch("https://curalink-backend-ix2f.onrender.com/api/history")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setHistory(
            data.map(item => ({
              _id: item._id,
              patientName: item.patientName,
              disease: item.disease,
              location: item.location || "",
              query: item.symptoms,
              symptoms: item.symptoms,
              response: item.response || item.aiResponse || "",
              // keep top-level source arrays so restoreSession can read them directly
              primarySources: item.primarySources || [],
              clinicalTrials: item.clinicalTrials || [],
              // also keep nested for any code that reads evidence.papers / evidence.trials
              evidence: { papers: item.primarySources || [], trials: item.clinicalTrials || [] },
              riskLevel: item.riskLevel ?? 60,
              keyTakeaways: item.keyTakeaways || [],
              personalizedInsight: item.personalizedInsight || "",
              messages: item.messages && item.messages.length > 0
                ? item.messages
                : [
                    { type: "user", text: item.symptoms || "" },
                    { type: "bot", text: item.response || "No response available" }
                  ]
            }))
          );
        }
      })
      .catch((err) => console.error(err));
  }, []);

  /* AUTO-LOCK TIMER */
  useEffect(() => {
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      if (privacyMode && !isLocked) {
        timer = setTimeout(() => setIsLocked(true), 30000);
      }
    };
    if (privacyMode) {
      window.addEventListener("mousemove", resetTimer);
      window.addEventListener("keydown", resetTimer);
      resetTimer();
    }
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      clearTimeout(timer);
    };
  }, [privacyMode, isLocked]);

  const handleNewChat = () => {
    if (clearChat) clearChat();
    navigate("/");
  };

  const handleSubmit = () => {
    if (modal.type === "SET_PIN") {
      if (modal.value.length >= 4) {
        localStorage.setItem("privacyPassword", modal.value);
        setPassword(modal.value);
        setPrivacyMode(true);
        setIsLocked(true);
      } else {
        alert("PIN must be at least 4 digits");
        return;
      }
    } else if (modal.type === "UNLOCK") {
      if (modal.value === password) {
        setIsLocked(false);
      } else {
        alert("Incorrect PIN");
        return;
      }
    } else if (modal.type === "DISABLE") {
      if (modal.value === password) {
        setPrivacyMode(false);
        setIsLocked(false);
      } else {
        alert("Incorrect PIN");
        return;
      }
    }
    setModal({ show: false, type: "", value: "" });
  };

  const handlePrivacyToggle = () => {
    if (!privacyMode) {
      setModal({ show: true, type: "SET_PIN", value: "" });
    } else {
      setModal({ show: true, type: "DISABLE", value: "" });
    }
  };

  // FIX: Ensure sources are flattened before passing to the chat interface
  const handleHistoryClick = (chat) => {
    const sessionToRestore = {
      ...chat,
      resumeChat: true,
      // Map the nested evidence back to the keys expected by ChatPage
      primarySources: chat.evidence?.papers || chat.primarySources || [],
      clinicalTrials: chat.evidence?.trials || chat.clinicalTrials || [],
    };

    if (onSelectChat) { 
      onSelectChat(sessionToRestore); 
      return; 
    }
    
    if (setExtraQuery) {
      setExtraQuery(sessionToRestore);
    }
  };

  return (
    <div style={sidebarStyle}>

      {/* PRIVACY MODAL */}
      {modal.show && (
        <div style={overlayStyle}>
          <div style={modalBoxStyle}>
            <h3 style={{ marginBottom: "15px" }}>
              {modal.type === "SET_PIN" ? "Set Privacy PIN" : "Enter PIN"}
            </h3>
            <input
              type="password"
              value={modal.value}
              onChange={(e) => setModal({ ...modal, value: e.target.value })}
              style={inputStyle}
              autoFocus
              placeholder="****"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button onClick={handleSubmit} style={confirmBtn}>Confirm</button>
              <button onClick={() => setModal({ show: false, type: "", value: "" })} style={cancelBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={header}>
        <h2 style={{ fontWeight: "800", color: "#0ea5a4", margin: 0 }}>
          🤖 CuraLink
        </h2>
      </div>

      {/* CONTENT */}
      <div>
        <button onClick={handlePrivacyToggle} style={privacyBtn(privacyMode)}>
          {privacyMode ? <FaLock /> : <FaUnlock />} Privacy {privacyMode ? "ON" : "OFF"}
        </button>

        <button onClick={handleNewChat} style={newChatBtn}>
          <FaPlus /> New Case
        </button>

        {/* HISTORY SECTION */}
        <div style={{ marginTop: "25px", position: "relative" }}>
          <h4 style={sectionTitle}>
            <FaHistory /> Recent Cases
          </h4>

          <div style={{
            filter: (privacyMode && isLocked) ? "blur(10px)" : "none",
            pointerEvents: (privacyMode && isLocked) ? "none" : "auto",
            transition: "0.4s ease"
          }}>
            {[...history, ...chats]
              .filter((chat, idx, arr) =>
                arr.findIndex(c =>
                  c.patientName === chat.patientName && c.disease === chat.disease
                ) === idx
              )
              .slice(0, 6)
              .map((chat, i) => (
                <div
                  key={i}
                  onClick={() => handleHistoryClick(chat)}
                  style={cardStyle}
                >
                  <div style={patientNameStyle}>
                    👤 {(privacyMode && isLocked) ? "Confidential" : (chat.patientName || "General")}
                  </div>
                  <div style={diseaseStyle}>
                    🦠 {(privacyMode && isLocked) ? "Analysis Locked" : (chat.disease || "Analysis")}
                  </div>
                </div>
              ))}
          </div>

          {/* UNLOCK OVERLAY */}
          {privacyMode && isLocked && (
            <div style={lockOverlay}>
              <FaLock size={24} color="#0ea5a4" style={{ marginBottom: "10px" }} />
              <button
                onClick={() => setModal({ show: true, type: "UNLOCK", value: "" })}
                style={unlockBtn}
              >
                Unlock History
              </button>
            </div>
          )}

          <div
            onClick={() => !(privacyMode && isLocked) && navigate("/history")}
            style={seeAllBtn(privacyMode && isLocked)}
          >
            See All →
          </div>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;

/* STYLES */

const sidebarStyle = {
  width: "260px",
  height: "100vh",
  position: "fixed",
  padding: "15px",
  background: "#ffffff",
  borderRight: "1px solid #e2e8f0",
  display: "flex",
  flexDirection: "column",
  zIndex: 1000
};

const header = { marginBottom: "20px" };

const privacyBtn = (isOn) => ({
  width: "100%", padding: "10px", borderRadius: "10px", border: "none",
  background: isOn ? "#10b981" : "#f1f5f9", color: isOn ? "white" : "black",
  marginBottom: "10px", cursor: "pointer", fontWeight: "600", textAlign: "left"
});

const newChatBtn = {
  width: "100%", padding: "12px", borderRadius: "10px", border: "none",
  background: "#0ea5a4", color: "white", fontWeight: "700", cursor: "pointer"
};

const sectionTitle = { fontSize: "14px", opacity: 0.6, marginBottom: "10px" };

const cardStyle = {
  padding: "12px", borderRadius: "12px", background: "#f8fafc",
  marginBottom: "10px", cursor: "pointer", border: "1px solid #e2e8f0",
  transition: "box-shadow 0.2s ease"
};

const patientNameStyle = { fontWeight: "600", fontSize: "13px", color: "#1e293b" };
const diseaseStyle = { fontSize: "11px", opacity: 0.7, color: "#475569" };

const seeAllBtn = (disabled) => ({
  fontSize: "12px",
  color: disabled ? "#94a3b8" : "#3b82f6",
  cursor: disabled ? "not-allowed" : "pointer",
  marginTop: "10px",
  opacity: disabled ? 0.5 : 1,
  textAlign: "right"
});

const overlayStyle = {
  position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
  background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center",
  alignItems: "center", zIndex: 999999
};

const modalBoxStyle = {
  background: "#ffffff", padding: "25px", borderRadius: "15px",
  width: "280px", textAlign: "center", color: "#1e293b",
  boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
};

const inputStyle = {
  width: "100%", padding: "12px", marginTop: "10px",
  textAlign: "center", fontSize: "18px", letterSpacing: "3px"
};

const confirmBtn = {
  flex: 1, padding: "10px", background: "#0ea5a4", color: "white",
  border: "none", cursor: "pointer", borderRadius: "5px", fontWeight: "600"
};

const cancelBtn = {
  flex: 1, padding: "10px", cursor: "pointer", border: "none",
  borderRadius: "5px", background: "#64748b", color: "white"
};

const lockOverlay = {
  position: "absolute", top: "40px", left: 0, right: 0, bottom: "30px",
  display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", zIndex: 10
};

const unlockBtn = {
  background: "#0ea5a4", color: "white", border: "none",
  padding: "8px 20px", borderRadius: "20px", fontSize: "13px",
  cursor: "pointer", fontWeight: "bold"
};