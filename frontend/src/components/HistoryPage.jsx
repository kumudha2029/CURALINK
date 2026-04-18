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
  const [deleteId, setDeleteId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchHistory();
  }, []);

  // ✅ FETCH HISTORY
  const fetchHistory = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/history`);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  // ✅ DELETE
  const confirmDelete = async () => {
    if (!deleteId) return;

    try {
      const res = await fetch(`${BASE_URL}/api/history/${deleteId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setHistory((prev) => prev.filter((i) => i._id !== deleteId));
        setDeleteId(null);
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // ✅ SEARCH FILTER
  const filtered = history.filter((item) =>
    (item.patientName || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.disease || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={container}>
      {/* DELETE MODAL */}
      {deleteId && (
        <div style={overlay}>
          <div style={modal}>
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

      <div style={card}>
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button onClick={() => navigate("/")}>
            <FaArrowLeft /> Back
          </button>
          <span>{filtered.length} cases</span>
        </div>

        <h1>Clinical History</h1>

        {/* SEARCH */}
        <div style={{ display: "flex", marginBottom: "20px" }}>
          <FaSearch />
          <input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* LIST */}
        {filtered.map((item) => (
          <div
            key={item._id}
            style={row}
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
              {/* CONTINUE */}
              <button
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

              {/* DELETE */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteId(item._id);
                }}
              >
                <FaTrashAlt />
              </button>

              <FaChevronRight />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HistoryPage;





/* 🎨 STYLES */

const container = {
  minHeight: "100vh",
  background: "#1e3a5f",
  padding: "40px",
};

const card = {
  background: "#fff",
  borderRadius: "20px",
  padding: "30px",
  maxWidth: "800px",
  margin: "auto",
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  padding: "15px",
  borderBottom: "1px solid #eee",
  cursor: "pointer",
};

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const modal = {
  background: "#fff",
  padding: "20px",
  borderRadius: "10px",
};