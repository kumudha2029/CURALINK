import { useState, useEffect } from "react";

function ChatHero({ onSend }) {
  const [isLoading, setIsLoading] = useState(true); // New Loading State
  const [formData, setFormData] = useState({
    patientName: "",
    disease: "",
    age: "",
    gender: "",
    location: "",
    query: ""
  });

  const [displayText, setDisplayText] = useState("");
  const fullText = "Hi, I'm Cura. How can I help you today?";

  /* ✅ INITIALIZATION & TYPING EFFECT */
  useEffect(() => {
    // Simulate a small delay for data/assets to be ready
    const loadTimer = setTimeout(() => {
      setIsLoading(false);
      
      let i = 0;
      const interval = setInterval(() => {
        setDisplayText(fullText.slice(0, i));
        i++;
        if (i > fullText.length) clearInterval(interval);
      }, 20);

      return () => clearInterval(interval);
    }, 500); // 0.5s loading buffer

    return () => clearTimeout(loadTimer);
  }, []);

  const handleSubmit = () => {
    if (!formData.query || !formData.disease) {
      alert("Please fill required fields (Disease and Query)");
      return;
    }
    onSend(formData);
    setFormData({ ...formData, query: "" });
  };

  // ✅ LOADING SCREEN RENDER
  if (isLoading) {
    return (
      <div style={container}>
        <div className="loader-box">
          <div className="pulse-ring"></div>
          <p style={{ marginTop: "20px", fontWeight: "600", opacity: 0.8 }}>
            Initializing Cura Intelligence...
          </p>
        </div>
        <style>{`
          .loader-box { display: flex; flex-direction: column; align-items: center; }
          .pulse-ring {
            width: 60px; height: 60px;
            border: 5px solid rgba(14, 165, 164, 0.2);
            border-top: 5px solid #0ea5a4;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div style={container}>
      {/* HEADER */}
      <div style={greetingBox}>
        <h1 style={title}>
          {displayText}
          <span className="cursor">|</span>
        </h1>
        <p style={subtitle}>CuraLink Clinical Intelligence Assistant</p>
      </div>

      {/* FORM */}
      <div style={formBox}>
        <h3 style={formHeader}>Initialize New Case Analysis</h3>

        <div style={row}>
          <input
            placeholder="Patient Name"
            value={formData.patientName}
            onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
            style={inputStyle}
          />
          <input
            placeholder="Disease"
            value={formData.disease}
            onChange={(e) => setFormData({ ...formData, disease: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div style={row}>
          <input
            placeholder="Age"
            type="number"
            value={formData.age}
            onChange={(e) => setFormData({ ...formData, age: e.target.value })}
            style={{ ...inputStyle, flex: 0.7 }}
          />
          <select
            value={formData.gender}
            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
            style={{ ...selectStyle, flex: 1 }}
          >
            <option value="" disabled>Gender</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
          <input
            placeholder="Location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            style={{ ...inputStyle, flex: 0.6 }}
          />
        </div>

        <textarea
          placeholder="Describe symptoms, patient history, or clinical query..."
          value={formData.query}
          onChange={(e) => setFormData({ ...formData, query: e.target.value })}
          style={textareaStyle}
        />

        <button
          onClick={handleSubmit}
          style={buttonStyle}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.01)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          🔍 Start Clinical Analysis
        </button>
      </div>

      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        .cursor { color: #0ea5a4; animation: blink 0.8s infinite; margin-left: 4px; }
      `}</style>
    </div>
  );
}

/* ---------- STYLES ---------- */
const container = {
  flex: 1, display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", minHeight: "100vh",
  background: "linear-gradient(135deg, #3b76b0 0%, #2a5b8d 60%, #1e3a5f 100%)",
  color: "white", padding: "20px", boxSizing: "border-box"
};

const greetingBox = { textAlign: "center", marginBottom: "30px", minHeight: "80px" };
const title = { fontSize: "36px", fontWeight: "800", marginBottom: "10px" };
const subtitle = { fontSize: "16px", color: "#dbe5ef", opacity: 0.9 };
const formBox = {
  width: "100%", maxWidth: "650px", background: "rgba(255,255,255,0.12)",
  backdropFilter: "blur(20px)", padding: "30px", borderRadius: "24px",
  display: "flex", flexDirection: "column", gap: "15px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
};
const formHeader = { fontSize: "14px", textTransform: "uppercase", color: "#0ea5a4", fontWeight: "800", letterSpacing: "1px" };
const row = { display: "flex", gap: "12px" };
const inputStyle = {
  flex: 1, height: "45px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.2)",
  padding: "0 15px", background: "rgba(255,255,255,0.95)", color: "#1e293b", outline: "none"
};
const selectStyle = { ...inputStyle, cursor: "pointer" };
const textareaStyle = {
  padding: "15px", borderRadius: "12px", border: "none", minHeight: "120px",
  background: "rgba(255,255,255,0.95)", color: "#1e293b", outline: "none", resize: "none"
};
const buttonStyle = {
  padding: "16px", borderRadius: "12px", background: "#0ea5a4",
  color: "white", border: "none", cursor: "pointer", fontWeight: "700", transition: "all 0.2s ease"
};

export default ChatHero;