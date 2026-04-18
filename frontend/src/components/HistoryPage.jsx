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
  FaCommentMedical
} from "react-icons/fa";

const BASE_URL = "https://curalink-backend-ix2f.onrender.com";

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

  // ✅ FIXED (no UI change)
  const fetchHistory = () => {
    fetch(`${BASE_URL}/api/history`)
      .then((res) => res.json())
      .then((data) => {
        setHistory(Array.isArray(data) ? data : []);
      })
      .catch(() => setHistory([]));
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const response = await fetch(`${BASE_URL}/api/history/${deleteId}`, {
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
            <div style={modalIconWrap}>
              <FaExclamationTriangle size={30} color="#ef4444" />
            </div>
            <h3 style={modalTitle}>Confirm Delete</h3>
            <p style={modalText}>
              Are you sure you want to remove this clinical record?
            </p>
            <div style={modalActionRow}>
              <button style={cancelBtn} onClick={() => setDeleteId(null)}>
                Cancel
              </button>
              <button style={confirmBtn} onClick={confirmDelete}>
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={centralCard}>
        <div style={navHeader}>
          <button onClick={() => navigate("/")} style={backBtn}>
            <FaArrowLeft size={14} /> Back to Chat
          </button>
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
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Past Week</option>
              <option value="custom">Select Date...</option>
            </select>
          </div>
        </div>

        {Object.keys(grouped).map(
          (key) =>
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
        )}
      </div>
    </div>
  );
}


// ✅ ONLY ADDITION (NO UI CHANGE)

function RecordRow({ item, navigate, onDelete, isLast }) {
  return (
    <div
      style={{
        ...rowStyle,
        borderBottom: isLast ? "none" : "1px solid #f1f5f9",
      }}
      onClick={() => navigate(`/case/${item._id}`)}
    >
      <div style={rowLeft}>
        <div style={{ ...avatar, background: "#e0f2fe" }}>
          <FaUserMd color="#0369a1" />
        </div>
        <div>
          <div style={pName}>{item.patientName || "Unknown"}</div>
          <div style={pDisease}>{item.disease || "No disease"}</div>
          <div style={rowTime}>
            {new Date(item.createdAt).toLocaleString()}
          </div>
        </div>
      </div>

      <div style={rowRight}>
        <button style={continueBtnStyle}
          onClick={(e) => {
            e.stopPropagation();
            navigate("/", {
              state: {
                resumeChat: true,
                prevMessages: item.messages || [],
                patientName: item.patientName,
                disease: item.disease,
                primarySources: item.primarySources || [],
                clinicalTrials: item.clinicalTrials || [],
              },
            });
          }}
        >
          <FaCommentMedical /> Continue
        </button>

        <button style={deleteBtnStyle} onClick={(e) => onDelete(e, item._id)}>
          <FaTrashAlt />
        </button>

        <FaChevronRight style={{ color: "#94a3b8" }} />
      </div>
    </div>
  );
}

export default HistoryPage;

// 🎨 STYLES (REQUIRED)

const pageContainer = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #3b76b0 0%, #2a5b8d 60%, #1e3a5f 100%)",
  padding: "40px 20px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  boxSizing: "border-box",
  width: "100%",
};

const centralCard = {
  width: "100%",
  maxWidth: "850px",
  background: "#ffffff",
  borderRadius: "24px",
  padding: "40px",
  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
  marginTop: "40px",
  marginBottom: "40px",
};

const navHeader = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "10px",
};

const backBtn = {
  background: "#3b76b0",
  border: "1px solid #e2ecf0",
  borderRadius: "12px",
  padding: "10px 20px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "700",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  cursor: "pointer",
};

const countBadge = {
  fontSize: "12px",
  color: "#0ea5a4",
  background: "#e0f2f1",
  fontWeight: "700",
  padding: "5px 12px",
  borderRadius: "20px",
  textTransform: "uppercase",
};

const mainTitle = {
  fontSize: "32px",
  fontWeight: "800",
  color: "#0f172a",
  margin: "0 0 30px 0",
};

const toolBar = {
  display: "flex",
  gap: "12px",
  marginBottom: "30px",
  alignItems: "center",
  flexWrap: "wrap",
};

const searchWrap = { flex: 3, position: "relative" };

const searchIcon = {
  position: "absolute",
  left: "15px",
  top: "15px",
  color: "#cbd5e1",
};

const inputStyle = {
  width: "100%",
  padding: "14px 14px 14px 45px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  outline: "none",
};

const filterWrap = {
  flex: 1.5,
  display: "flex",
  alignItems: "center",
  gap: "10px",
  background: "#f8fafc",
  padding: "0 15px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  height: "48px",
};

const selectStyle = {
  background: "none",
  border: "none",
  outline: "none",
  width: "100%",
};

const dateLabel = {
  fontSize: "13px",
  fontWeight: "800",
  color: "#94a3b8",
  marginBottom: "12px",
};

const listContainer = {
  borderRadius: "16px",
  border: "1px solid #f1f5f9",
  overflow: "hidden",
};

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "18px 24px",
  cursor: "pointer",
  background: "#fff",
};

const rowLeft = {
  display: "flex",
  alignItems: "center",
  gap: "18px",
};

const avatar = {
  width: "48px",
  height: "48px",
  borderRadius: "14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const pName = { fontSize: "16px", fontWeight: "700" };
const pDisease = { fontSize: "13px", color: "#0ea5a4" };
const rowRight = { display: "flex", alignItems: "center" };
const rowTime = { fontSize: "11px", color: "#94a3b8" };

const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const modalContent = {
  background: "#fff",
  padding: "20px",
  borderRadius: "10px",
};