const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const researchRoutes = require("./routes/research");
const historyRoutes = require("./routes/history");
const { handleQuery } = require("./controllers/researchController");

const app = express();


// ✅ CORS (allow your deployed frontend)
app.use(cors({
  origin: [
    "https://curalink-peach.vercel.app",
    "https://curalink-181hqkw81-kumudhasris-projects.vercel.app"
  ],
  methods: ["GET", "POST", "DELETE"],
  credentials: true
}));


// ✅ Middleware
app.use(express.json());


// ✅ MongoDB Connection (SAFE VERSION)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected ✅"))
  .catch((err) => {
    console.error("MongoDB Connection Error:", err);
    process.exit(1); // stop server if DB fails
  });


// ✅ Health Check
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});


// ✅ ROUTES
app.use("/api/research", researchRoutes);
app.use("/api/history", historyRoutes);


// ✅ CHAT ROUTE
app.post("/api/chat", handleQuery);


// ✅ GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
  console.error("Server Error:", err.stack);
  res.status(500).json({ error: "Something went wrong" });
});


// ✅ START SERVER
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});