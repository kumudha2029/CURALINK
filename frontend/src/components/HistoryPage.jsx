import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FaArrowLeft, 
  FaSearch, 
  FaUserMd, 
  FaFilter, 
  FaChevronRight, 
  FaCalendarAlt, 
  FaTrashAlt,
  FaExclamationTriangle,
  FaCommentMedical // New icon for continuing chat
} from "react-icons/fa";

function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all"); 
  const [customDate, setCustomDate] = useState(""); 
  const [deleteId, setDeleteId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = () => {
    fetch("http://localhost:5000/api/history")
      .then((res) => res.json())
      .then((data) => setHistory(data))
      .catch((err) => console.error("Error fetching history:", err));
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const response = await fetch(`http://localhost:5000/api/history/${deleteId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setHistory((prev) => prev.filter((item) => item._id !== deleteId));
        setDeleteId(null);
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const filtered = history.filter((item) => {
    const matchesSearch = 
      (item.patientName || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.disease || "").toLowerCase().includes(search.toLowerCase());
    const itemDate = new Date(item.createdAt);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = (now - itemDate) / (1000 * 60 * 60 * 24);

    if (dateFilter === "today") return matchesSearch && itemDate >= today;
    if (dateFilter === "week") return matchesSearch && diffDays < 7;
    if (dateFilter === "month") return matchesSearch && diffDays < 30;
    if (dateFilter === "custom" && customDate) {
      const selected = new Date(customDate);
      return matchesSearch && itemDate.toDateString() === selected.toDateString();
    }
    return matchesSearch;
  });

  const groupByDate = (items) => {
    const groups = { Today: [], Yesterday: [], Older: [] };
    const todayStr = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    items.forEach((item) => {
      const d = new Date(item.createdAt).toDateString();
      if (d === todayStr) groups.Today.push(item);
      else if (d === yesterdayStr) groups.Yesterday.push(item);
      else groups.Older.push(item);
    });
    return groups;
  };

  const grouped = groupByDate(filtered);

  return (
    <div style={pageContainer}>
      {deleteId && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <div style={modalIconWrap}><FaExclamationTriangle size={30} color="#ef4444" /></div>
            <h3 style={modalTitle}>Confirm Delete</h3>
            <p style={modalText}>Are you sure you want to remove this clinical record?</p>
            <div style={modalActionRow}>
              <button style={cancelBtn} onClick={() => setDeleteId(null)}>Cancel</button>
              <button style={confirmBtn} onClick={confirmDelete}>Delete Record</button>
            </div>
          </div>
        </div>
      )}

      <div style={centralCard}>
        <div style={navHeader}>
          <button onClick={() => navigate("/")} style={backBtn}><FaArrowLeft size={14} /> Back to Chat</button>
          <div style={countBadge}>{filtered.length} total cases</div>
        </div>

        <h1 style={mainTitle}>Clinical History</h1>

        <div style={toolBar}>
          <div style={searchWrap}>
            <FaSearch style={searchIcon} />
            <input
              placeholder="Search patients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={filterWrap}>
            <FaFilter size={12} color="#94a3b8" />
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={selectStyle}>
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Past Week</option>
              <option value="custom">Select Date...</option>
            </select>
          </div>
        </div>

        {Object.keys(grouped).map((key) => (
          grouped[key].length > 0 && (
            <div key={key} style={{ marginBottom: "40px" }}>
              <div style={dateLabel}>{key}</div>
              <div style={listContainer}>
                {grouped[key].map((item, i) => (
                  <RecordRow 
                    key={item._id || i} 
                    item={item} 
                    navigate={navigate} 
                    onDelete={(e, id) => {
                      e.stopPropagation();
                      setDeleteId(id);
                    }}
                    isLast={i === grouped[key].length - 1} 
                  />
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function RecordRow({ item, navigate, isLast, onDelete }) {
  const getStatus = () => {
    const text = (item.disease + " " + (item.symptoms || "")).toLowerCase();
    if (text.match(/fever|flu|cold/)) return { color: "#10b981", label: "Stable" };
    if (text.match(/corona|covid/)) return { color: "#f59e0b", label: "Warning" };
    return { color: "#3b82f6", label: "Analyzed" };
  };
  const status = getStatus();

  // 🔥 ACTION: Continue Chat
  const handleContinueChat = (e) => {
    e.stopPropagation();
    navigate("/", {
      state: {
        resumeChat          : true,
        prevMessages        : item.messages           || [],
        patientName         : item.patientName,
        disease             : item.disease,
        riskLevel           : item.riskLevel          ?? 60,
        keyTakeaways        : item.keyTakeaways        || item.key_takeaways || [],
        personalizedInsight : item.personalizedInsight || item.personalized_insight || "",
        primarySources      : item.primarySources      || item.topPapers || [],
        clinicalTrials      : item.clinicalTrials      || [],
      }
    });
  };

  return (
    <div 
      style={{...rowStyle, borderBottom: isLast ? 'none' : '1px solid #f1f5f9'}}
      onClick={() => navigate(`/case/${item._id}`)}
    >
      <div style={rowLeft}>
        <div style={{...avatar, backgroundColor: `${status.color}15`, color: status.color}}>
          <FaUserMd size={18} />
        </div>
        <div>
          <div style={pName}>{item.patientName || "General Patient"}</div>
          <div style={pDisease}>{item.disease || "No Diagnosis"}</div>
        </div>
      </div>
      
      <div style={rowRight}>
        <div style={{textAlign: 'right', marginRight: '15px'}}>
           <div style={{...statusDot, backgroundColor: status.color}}>{status.label}</div>
           <div style={rowTime}>{new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        </div>

        {/* 🔥 NEW CONTINUE CHAT BUTTON */}
        <button
          style={continueBtnStyle}
          onClick={handleContinueChat}
          title="Continue Conversation"
        >
          <FaCommentMedical size={14} /> Continue
        </button>

        <button
          style={deleteBtnStyle}
          onClick={(e) => onDelete(e, item._id)}
          title="Delete Record"
        >
          <FaTrashAlt size={14} />
        </button>

        <FaChevronRight color="#cbd5e1" size={12} />
      </div>
    </div>
  );
}

/* 🎨 NEW STYLES */

const continueBtnStyle = {
  background: "#e0f2fe",
  border: "none",
  color: "#0369a1",
  padding: "8px 14px",
  borderRadius: "10px",
  cursor: "pointer",
  marginRight: "10px",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "12px",
  fontWeight: "700",
  transition: "all 0.2s ease",
};

const deleteBtnStyle = {
  background: "#fee2e2",
  border: "none",
  color: "#ef4444",
  padding: "10px",
  borderRadius: "10px",
  cursor: "pointer",
  marginRight: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

// ... keep all other existing styles from your original code ...
const pageContainer = { minHeight: "100vh", background: "linear-gradient(135deg, #3b76b0 0%, #2a5b8d 60%, #1e3a5f 100%)", padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", boxSizing: "border-box", width: "100%", };
const centralCard = { width: "100%", maxWidth: "850px", background: "#ffffff", borderRadius: "24px", padding: "40px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)", marginTop: "40px", marginBottom: "40px", };
const navHeader = { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' };
const backBtn = { background: '#3b76b0', border: '1px solid #e2ecf0', borderRadius: '12px', padding: '10px 20px', color: '#ffffff', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', };
const countBadge = { fontSize: '12px', color: '#0ea5a4', background: '#e0f2f1', fontWeight: '700', padding: '5px 12px', borderRadius: '20px', textTransform: 'uppercase', };
const mainTitle = { fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: '0 0 30px 0' };
const toolBar = { display: 'flex', gap: '12px', marginBottom: '30px', alignItems: 'center', flexWrap: 'wrap' };
const searchWrap = { flex: 3, position: 'relative' };
const searchIcon = { position: 'absolute', left: '15px', top: '15px', color: '#cbd5e1' };
const inputStyle = { width: '100%', padding: '14px 14px 14px 45px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', fontSize: '15px', boxSizing: 'border-box' };
const filterWrap = { flex: 1.5, display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '0 15px', borderRadius: '12px', border: '1px solid #e2e8f0', height: '48px' };
const selectStyle = { background: 'none', border: 'none', outline: 'none', fontSize: '14px', fontWeight: '600', color: '#475569', cursor: 'pointer', width: '100%' };
const dateLabel = { fontSize: '13px', fontWeight: '800', color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' };
const listContainer = { borderRadius: '16px', border: '1px solid #f1f5f9', overflow: 'hidden' };
const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', cursor: 'pointer', transition: 'background 0.2s', background: '#fff' };
const rowLeft = { display: 'flex', alignItems: 'center', gap: '18px' };
const avatar = { width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const pName = { fontSize: '16px', fontWeight: '700', color: '#1e293b' };
const pDisease = { fontSize: '13px', color: '#0ea5a4', fontWeight: '600' };
const rowRight = { display: 'flex', alignItems: 'center' };
const statusDot = { fontSize: '10px', fontWeight: '800', color: '#fff', padding: '3px 10px', borderRadius: '20px', textTransform: 'uppercase' };
const rowTime = { fontSize: '11px', color: '#94a3b8', marginTop: '4px', fontWeight: '500' };
const modalOverlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', };
const modalContent = { background: '#fff', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px', textAlign: 'center', };
const modalIconWrap = { width: '60px', height: '60px', background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', };
const modalTitle = { fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '0 0 10px' };
const modalText = { fontSize: '14px', color: '#64748b', lineHeight: '1.6', margin: '0 0 25px' };
const modalActionRow = { display: 'flex', gap: '12px' };
const cancelBtn = { flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: '700', color: '#64748b', cursor: 'pointer' };
const confirmBtn = { flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#ef4444', fontWeight: '700', color: '#fff', cursor: 'pointer' };

export default HistoryPage;