const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.WHATSAPP_API_KEY;

// --- SELF-PING KEEP-ALIVE (Render free tier prevention) ---
const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000; // 14 minutes
const PUBLIC_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

function keepAlive() {
  axios.get(`${PUBLIC_URL}/health`)
    .then(() => console.log('🔄 Self-ping successful — app kept awake.'))
    .catch(err => console.warn('⚠️ Self-ping failed:', err.message));
}

// Start pinging after server is up
setTimeout(() => {
  keepAlive();
  setInterval(keepAlive, KEEP_ALIVE_INTERVAL);
}, 60 * 1000);

// --- EXISTING CODE ---

if (!API_KEY) {
  console.warn('⚠️  WARNING: WHATSAPP_API_KEY environment variable not set.');
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/check-ban', async (req, res) => {
  const { number } = req.body;

  if (!number) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  const cleanNumber = number.replace(/[\s+]/g, '').replace(/^00/, '');

  try {
    const response = await axios.post(
      'https://api.ballerina.io/v1/whatsapp/check',
      { number: cleanNumber },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    return res.json(response.data);
  } catch (err) {
    try {
      const fallbackResponse = await axios.get(
        `https://api.ballerina.io/v1/whatsapp/check?number=${cleanNumber}`,
        {
          headers: {
            'Authorization': `Bearer ${API_KEY}`
          },
          timeout: 10000
        }
      );
      return res.json(fallbackResponse.data);
    } catch (fallbackErr) {
      console.error('Both API attempts failed:', fallbackErr.message);
      return res.status(502).json({
        error: 'Ban check service unavailable. Please try again later.'
      });
    }
  }
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`🔥 Durez Ban Checker running on port ${PORT}`);
  console.log(`🌐 Public URL: ${PUBLIC_URL}`);
  console.log(`⏰ Keep-alive pinger active — pinging every 14 minutes.`);
});
