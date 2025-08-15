const express = require('express');
const fs = require('fs');
const path = require('path');
const { Groq } = require('groq-sdk');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3000;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
app.use(express.json());

const logsPath = path.join(__dirname, 'data', 'utmi_logs.json');

// Crée un fichier vide s'il n'existe pas
if (!fs.existsSync(logsPath)) {
  fs.mkdirSync(path.dirname(logsPath), { recursive: true });
  fs.writeFileSync(logsPath, '[]');
}

// ⚙️ Fonction pour enregistrer une session IA
function logInteraction({ userId, startTime, endTime, prompt, response }) {
  const durationMinutes = Math.round((endTime - startTime) / 60000); // ms → minutes
  const utmi = Math.max(durationMinutes, 1);

  const logEntry = {
    id: uuidv4(),
    userId,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    durationMinutes,
    prompt,
    response,
    utmi,
  };

  const data = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
  data.push(logEntry);
  fs.writeFileSync(logsPath, JSON.stringify(data, null, 2));
}

// ✅ Route POST : envoyer prompt à l’IA et logger l’interaction
app.post('/ask', async (req, res) => {
  const { userId, prompt } = req.body;
  const startTime = Date.now();

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama3-70b-8192',
    });

    const responseText = chatCompletion.choices[0]?.message?.content || 'Réponse vide';
    const endTime = Date.now();

    logInteraction({ userId, startTime, endTime, prompt, response: responseText });

    res.json({
      userId,
      response: responseText,
      utmiEarned: Math.max(Math.round((endTime - startTime) / 60000), 1),
    });
  } catch (err) {
    console.error('Erreur de la ML:', err);
    res.status(500).json({ error: 'Erreur de l’IA.' });
  }
});

// 📄 Route GET : récupérer tous les logs
app.get('/logs', (req, res) => {
  const data = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
  res.json(data);
});

app.listen(port, () => {
  console.log(`✅ Serveur UTMI IA actif sur http://localhost:${port}`);
});
