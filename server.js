require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: { encrypt: false, trustServerCertificate: true }
};

// Get all incidents
app.get('/api/incidents', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .query('SELECT IncidentID, Title, Severity, Status, DetectedAt FROM Incidents ORDER BY DetectedAt DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get the timeline for one incident
app.get('/api/incidents/:id/timeline', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT EventTime, EventType, Details FROM Events WHERE IncidentID = @id ORDER BY EventTime');
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});
// Add a new incident
app.post('/api/incidents', async (req, res) => {
  try {
    const { title, severity, detectedAt, description } = req.body;

    if (!title || !severity || !detectedAt) {
      return res.status(400).json({ error: 'Title, severity and detected time are required' });
    }

    const pool = await sql.connect(config);
    await pool.request()
      .input('title', sql.NVarChar(200), title)
      .input('severity', sql.NVarChar(20), severity)
      .input('detectedAt', sql.DateTime2, new Date(detectedAt))
      .input('description', sql.NVarChar(sql.MAX), description || null)
      .query(`INSERT INTO Incidents (Title, Severity, DetectedAt, Description)
              VALUES (@title, @severity, @detectedAt, @description)`);

    res.status(201).json({ message: 'Incident created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add a new event to an incident's timeline
app.post('/api/incidents/:id/events', async (req, res) => {
  try {
    const { eventTime, eventType, details } = req.body;

    if (!eventTime || !eventType) {
      return res.status(400).json({ error: 'Event time and event type are required' });
    }

    const pool = await sql.connect(config);
    await pool.request()
      .input('incidentId', sql.Int, req.params.id)
      .input('eventTime', sql.DateTime2, new Date(eventTime))
      .input('eventType', sql.NVarChar(50), eventType)
      .input('details', sql.NVarChar(500), details || null)
      .query(`INSERT INTO Events (IncidentID, EventTime, EventType, Details)
              VALUES (@incidentId, @eventTime, @eventType, @details)`);

    res.status(201).json({ message: 'Event added' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});
app.listen(process.env.PORT, () =>
  console.log(`Server running at http://localhost:${process.env.PORT}`));
