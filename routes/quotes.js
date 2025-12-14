// backend/routes/quotes.js
import express from "express";
import Quote from "../models/Quote.js";
import auth from "../middleware/auth.js";
import requireSuperAdmin from "../middleware/requireSuperAdmin.js";

const router = express.Router();

/*
----------------------------------------------------------
  ALL QUOTE ROUTES ARE PROTECTED EXCEPT /wotd
  - Protected routes still use auth + requireSuperAdmin
  - Public route: GET /api/quotes/wotd (for the frontend WOTD)
----------------------------------------------------------
*/

// Public: Word (Quote) of the Day
router.get("/wotd", async (req, res) => {
  try {
    const count = await Quote.countDocuments();
    if (count === 0) {
      return res.status(404).json({ message: "No quotes found" });
    }

    // Option: random quote (returns a different one each request)
    const rand = Math.floor(Math.random() * count);
    const quote = await Quote.findOne().skip(rand);

    // If you prefer the latest instead, replace the above with:
    // const quote = await Quote.findOne().sort({ createdAt: -1 });

    return res.json({ quote });
  } catch (err) {
    console.error("WOTD route error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Get all quotes (protected)
router.get("/", auth, requireSuperAdmin, async (req, res) => {
  try {
    const quotes = await Quote.find().sort({ createdAt: -1 });
    res.json({ quotes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Create new quote (protected)
router.post("/", auth, requireSuperAdmin, async (req, res) => {
  try {
    const { text, author } = req.body;

    if (!text) {
      return res.status(400).json({ message: "Quote text required" });
    }

    const quote = await Quote.create({ text, author });
    res.status(201).json({ quote });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update quote (protected)
router.put("/:id", auth, requireSuperAdmin, async (req, res) => {
  try {
    const { text, author } = req.body;

    const quote = await Quote.findByIdAndUpdate(
      req.params.id,
      { text, author },
      { new: true }
    );

    if (!quote) {
      return res.status(404).json({ message: "Quote not found" });
    }

    res.json({ quote });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete quote (protected)
router.delete("/:id", auth, requireSuperAdmin, async (req, res) => {
  try {
    const deleted = await Quote.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Quote not found" });
    }

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
