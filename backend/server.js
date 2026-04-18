const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const researchRoutes = require("./routes/research");
const historyRoutes = require("./routes/history");
const { handleQuery } = require("./controllers/researchController");

const app = express();

router.get("/", async (req, res) => {
  try {
    const data = await History.find().sort({ createdAt: -1 });

    // ✅ Always return array
    res.json(Array.isArray(data) ? data : []);
    
  } catch (err) {
    console.error("History fetch error:", err);

    // ✅ Never break frontend
    res.status(200).json([]);  
  }
});
app.use(express.json());
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected ✅"))
  .catch((err) => console.log("MongoDB Connection Error:", err));

// ✅ Health Check
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

// ✅ ROUTES
app.use("/api/research", researchRoutes);
app.use("/api/history", historyRoutes); // This covers everything in routes/history.js

// 🔥 CHAT ROUTE
app.post("/api/chat", handleQuery);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});