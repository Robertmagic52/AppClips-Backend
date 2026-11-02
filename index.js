const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage for your magic calculator configuration
let currentConfig = {
    mode: 0,
    fixed: 100,
    chunk: 2,
    offset: 60,
    updatedAt: Date.now()
};

// GET endpoint for the App Clip to pull the latest settings
app.get('/api/config', (req, res) => {
    res.json(currentConfig);
});

// POST endpoint for your main app to push configuration updates
app.post('/api/config', (req, res) => {
    const { mode, fixed, chunk, offset } = req.body;
    
    if (mode !== undefined) currentConfig.mode = mode;
    if (fixed !== undefined) currentConfig.fixed = fixed;
    if (chunk !== undefined) currentConfig.chunk = chunk;
    if (offset !== undefined) currentConfig.offset = offset;
    currentConfig.updatedAt = Date.now();

    console.log("Config updated:", currentConfig);
    res.json({ success: true, config: currentConfig });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend bridge running on port ${PORT}`);
});
