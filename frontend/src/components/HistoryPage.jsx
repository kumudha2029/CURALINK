import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FaArrowLeft, 
  FaSearch, 
  FaUserMd, 
  FaFilter, 
  FaChevronRight, 
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

  // ✅ SAFE FETCH
  const fetchHistory = () => {
    fetch(`${BASE_URL}/api/history`)
      .then((res) => res.json())
      .then((data) => setHistory(Array.isArray(data) ? data : []))
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
            <FaExclamationTriangle size={30} color="#ef4444" />
            <h3>Confirm Delete</h3>
            <p>Delete this record?</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteId(null)}>Cancel</button>
              <button onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div style={centralCard}>
        <div style={navHeader}>
          <button onClick={() => navigate("/")}>
            <FaArrowLeft /> Back to Chat
          </button>
          <span>{filtered.length} total cases</span>
        </div>

        <h1>Clinical History</h1>

        {/* SEARCH */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <FaSearch />
          <input
            placeholder="Search patients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* FILTER */}
          <FaFilter />
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Past Week</option>
            <option value="month">Past Month</option>
            <option value="custom">Select Date...</option>
          </select>

          {/* ✅ DATE PICKER ADDED */}
          {dateFilter === "custom" && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
            />
          )}
        </div>

        {/* LIST */}
        {Object.keys(grouped).map(
          (key) =>
            grouped[key].length > 0 && (
              <div key={key}>
                <h4>{key}</h4>

                {grouped[key].map((item) => (
                  <RecordRow
                    key={item._id}
                    item={item}
                    navigate={navigate}
                    onDelete={(e, id) => {
                      e.stopPropagation();
                      setDeleteId(id);
                    }}
                  />
                ))}
              </div>
            )
        )}
      </div>
    </div>
  );
}

export default HistoryPage;



// ✅ RECORD ROW (REQUIRED)

function RecordRow({ item, navigate, onDelete }) {
  return (
    <div
      style={rowStyle}
      onClick={() => navigate(`/case/${item._id}`)}
    >
      <div style={{ display: "flex", gap: "10px" }}>
        <FaUserMd />
        <div>
          <div>{item.patientName || "Patient"}</div>
          <div>{item.disease}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center" }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate("/", {
              state: {
                resumeChat: true,
                prevMessages: item.messages || [],
              },
            });
          }}
        >
          <FaCommentMedical /> Continue
        </button>

        <button onClick={(e) => onDelete(e, item._id)}>
          <FaTrashAlt />
        </button>

        <FaChevronRight />
      </div>
    </div>
  );
}



// ✅ STYLES

const pageContainer = {
  minHeight: "100vh",
  background: "#1e3a5f",
  padding: "40px",
};

const centralCard = {
  background: "#fff",
  padding: "20px",
  borderRadius: "10px",
  maxWidth: "800px",
  margin: "auto",
};

const navHeader = {
  display: "flex",
  justifyContent: "space-between",
};

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  padding: "15px",
  borderBottom: "1px solid #eee",
  cursor: "pointer",
};

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