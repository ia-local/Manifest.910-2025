require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const Groq = require('groq-sdk');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

// ... (le code précédent de server.js reste inchangé) ...

const app = express();
const port = process.env.PORT || 3000;

// Configuration de Groq avec le nouveau modèle
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// Nouvelle fonction LLM pour le chat (mise à jour du modèle)
const getLlmResponse = async (userMessage, role, conversationHistory) => {
    const systemPrompt = `Tu es un assistant IA spécialisé dans l'analyse de dossiers de corruption, de blanchiment d'argent, d'évasion fiscale et de prise illégale d'intérêts. Tu as accès à une base de données de l'enquête parlementaire française. L'enquête se concentre sur les actions de hauts fonctionnaires d'État entre 2017 et 2027. Tu peux prendre plusieurs rôles en fonction des requêtes de l'utilisateur. Ton ton doit être factuel, précis, et basé sur les données de l'enquête. Les rôles possibles sont : Enquêteur, Journaliste, Avocat et Juge. Le rôle actuel est: ${role}.`;

    const chatHistory = conversationHistory.map(item => ({
        role: item.role === 'user' ? 'user' : 'assistant',
        content: item.message
    }));

    chatHistory.push({ role: 'user', content: userMessage });

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'system', content: systemPrompt }, ...chatHistory],
            model: 'gemma2-9b-it', // NOUVEAU MODÈLE
            stream: false,
        });

        if (chatCompletion && chatCompletion.choices && chatCompletion.choices.length > 0) {
            return chatCompletion.choices[0]?.message?.content || 'Aucune réponse générée par l\'IA.';
        } else {
            return 'Erreur de l\'API Groq: Aucune réponse valide.';
        }
    } catch (error) {
        console.error('Erreur lors de l\'appel à Groq:', error);
        return 'Une erreur est survenue lors de la communication avec l\'IA.';
    }
};

// ... (le reste des routes GET/POST/PUT/DELETE reste inchangé) ...

// NOUVEL ENDPOINT pour générer des données d'entité avec l'IA
app.post('/api/ai/generate-entity', async (req, res) => {
    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ error: 'La requête est vide.' });
    }

    const aiPrompt = `À partir de la requête suivante, génère un objet JSON qui inclut le 'name' (nom), le 'type' (supermarché, banque, etc.), une 'description' et des coordonnées 'geo' (latitude et longitude) pour l'entité. Réponds uniquement avec l'objet JSON. Par exemple, si la requête est "Ajouter un Carrefour à Lyon", la réponse doit être: {"name": "Carrefour", "type": "Distribution", "description": "Magasin Carrefour à Lyon.", "geo": {"lat": 45.7578, "lon": 4.8320}}. Voici la requête: "${query}"`;
    
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'system', content: aiPrompt }, { role: 'user', content: query }],
            model: 'gemma2-9b-it', // Utilisation du nouveau modèle
            temperature: 0.1, // Basse température pour une réponse factuelle
            stream: false,
        });

        const responseContent = chatCompletion.choices[0]?.message?.content;
        const jsonResponse = JSON.parse(responseContent);
        res.json(jsonResponse);
    } catch (error) {
        console.error('Erreur lors de la génération IA:', error);
        res.status(500).json({ error: 'Impossible de générer les données avec l\'IA.' });
    }
});


// ... (le reste du fichier server.js) ...

const DATABASE_FILE_PATH = path.join(__dirname, 'database.json');
let database = {};

// Gestion des écritures asynchrones
let writeQueue = Promise.resolve();
let isWriting = false;

// Nouvelle fonction d'écriture sécurisée
async function writeDatabaseFile() {
    // Si une écriture est déjà en cours, on l'ajoute à la file d'attente
    writeQueue = writeQueue.then(async () => {
        if (isWriting) return;
        isWriting = true;
        try {
            console.log('Début de l\'écriture de database.json...');
            await fs.writeFile(DATABASE_FILE_PATH, JSON.stringify(database, null, 2), { encoding: 'utf8' });
            console.log('Écriture de database.json terminée avec succès.');
        } catch (error) {
            console.error('Erreur lors de l\'écriture de database.json:', error);
        } finally {
            isWriting = false;
        }
    });
    return writeQueue;
}

async function initializeDatabase() {
    try {
        const data = await fs.readFile(DATABASE_FILE_PATH, { encoding: 'utf8' });
        database = JSON.parse(data);
        console.log('Base de données chargée avec succès.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn('Le fichier database.json n\'existe pas, initialisation de la base de données vide.');
            database = {
                financial_flows: [],
                affaires: { chronology: [] },
                petitions: [],
                taxes: [],
                entities: []
            };
            await writeDatabaseFile(); // Crée le fichier
        } else {
            console.error('Erreur fatale lors du chargement de database.json:', error);
            process.exit(1);
        }
    }
}

const swaggerDocumentPath = path.join(__dirname, 'api-docs', 'swagger.yaml');
const swaggerDocument = YAML.load(swaggerDocumentPath);


app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/roles', express.static(path.join(__dirname, 'public', 'roles')));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Vos routes pour le chatbot et les logs... (inchangées)
const logAppFile = async (data) => {
    try {
        await fs.appendFile(APP_LOG_FILE_PATH, JSON.stringify(data) + '\n', 'utf8');
    } catch (err) {
        console.error('Failed to write to log file:', err);
    }
};

const writeLogFile = async (chatLog) => {
    try {
        const chatLogFilePath = path.join(__dirname, 'log.json');
        await fs.writeFile(chatLogFilePath, JSON.stringify(chatLog, null, 2), 'utf8');
        console.log('Journal des chats mis à jour.');
    } catch (error) {
        console.error('Erreur lors de l\'écriture du journal des chats:', error);
    }
};

// --- ROUTES POUR LES DONNÉES DU TABLEAU DE BORD (CRUD) ---

// FINANCIAL FLOWS
app.get('/api/financial-flows', (req, res) => {
    res.json(database.financial_flows);
});
app.post('/api/financial-flows', async (req, res) => {
    const newFlow = req.body;
    newFlow.id = `flow_${Date.now()}`;
    database.financial_flows.push(newFlow);
    await writeDatabaseFile();
    res.status(201).json(newFlow);
});
app.put('/api/financial-flows/:id', async (req, res) => {
    const index = database.financial_flows.findIndex(f => f.id === req.params.id);
    if (index !== -1) {
        database.financial_flows[index] = { ...database.financial_flows[index], ...req.body };
        await writeDatabaseFile();
        res.json(database.financial_flows[index]);
    } else {
        res.status(404).json({ error: 'Flux financier non trouvé.' });
    }
});
app.delete('/api/financial-flows/:id', async (req, res) => {
    const initialLength = database.financial_flows.length;
    database.financial_flows = database.financial_flows.filter(f => f.id !== req.params.id);
    if (database.financial_flows.length < initialLength) {
        await writeDatabaseFile();
        res.status(204).send();
    } else {
        res.status(404).json({ error: 'Flux financier non trouvé.' });
    }
});


// AFFAIRES
app.get('/api/affaires', (req, res) => {
    res.json(database.affaires);
});
// La création/modification des affaires est plus complexe en raison de la structure {chronology: []}.
// Pour simplifier, nous allons permettre de remplacer l'objet complet ou d'ajouter un événement.
app.post('/api/affaires/event', async (req, res) => {
    const newEvent = req.body;
    const year = new Date(newEvent.timestamp).getFullYear();
    const yearEntry = database.affaires.chronology.find(y => y.year === year);
    if (yearEntry) {
        yearEntry.events.push(newEvent);
    } else {
        database.affaires.chronology.push({ year: year, events: [newEvent] });
    }
    database.affaires.chronology.sort((a, b) => a.year - b.year);
    await writeDatabaseFile();
    res.status(201).json(newEvent);
});


// PETITIONS
app.get('/api/petitions', (req, res) => {
    res.json(database.petitions);
});
app.post('/api/petitions', async (req, res) => {
    const newPetition = req.body;
    newPetition.id = `petition_${Date.now()}`;
    database.petitions.push(newPetition);
    await writeDatabaseFile();
    res.status(201).json(newPetition);
});
app.put('/api/petitions/:id', async (req, res) => {
    const index = database.petitions.findIndex(p => p.id === req.params.id);
    if (index !== -1) {
        database.petitions[index] = { ...database.petitions[index], ...req.body };
        await writeDatabaseFile();
        res.json(database.petitions[index]);
    } else {
        res.status(404).json({ error: 'Pétition non trouvée.' });
    }
});
app.delete('/api/petitions/:id', async (req, res) => {
    const initialLength = database.petitions.length;
    database.petitions = database.petitions.filter(p => p.id !== req.params.id);
    if (database.petitions.length < initialLength) {
        await writeDatabaseFile();
        res.status(204).send();
    } else {
        res.status(404).json({ error: 'Pétition non trouvée.' });
    }
});


// TAXES
app.get('/api/taxes', (req, res) => {
    res.json(database.taxes);
});
// POST/PUT/DELETE pour les taxes est possible, mais un peu moins fréquent,
// donc on se concentre sur les données d'enquête principales.
// Nous pouvons les ajouter si vous en avez besoin.


// ENTITIES
app.get('/api/entities', (req, res) => {
    res.json(database.entities);
});
app.post('/api/entities', async (req, res) => {
    const newEntity = req.body;
    newEntity.id = `entity_${Date.now()}`;
    database.entities.push(newEntity);
    await writeDatabaseFile();
    res.status(201).json(newEntity);
});
app.put('/api/entities/:id', async (req, res) => {
    const index = database.entities.findIndex(e => e.id === req.params.id);
    if (index !== -1) {
        database.entities[index] = { ...database.entities[index], ...req.body };
        await writeDatabaseFile();
        res.json(database.entities[index]);
    } else {
        res.status(404).json({ error: 'Entité non trouvée.' });
    }
});
app.delete('/api/entities/:id', async (req, res) => {
    const initialLength = database.entities.length;
    database.entities = database.entities.filter(e => e.id !== req.params.id);
    if (database.entities.length < initialLength) {
        await writeDatabaseFile();
        res.status(204).send();
    } else {
        res.status(404).json({ error: 'Entité non trouvée.' });
    }
});


// AUTRES ROUTES API (inchangées)
app.get('/api/dashboard/summary', (req, res) => {
    const totalTransactions = database.financial_flows.length;
    const activeAlerts = database.financial_flows.filter(f => f.is_suspicious).length;
    const riskyEntities = new Set(database.financial_flows.map(f => f.sender_name)).size;
    res.json({
        totalTransactions,
        activeAlerts,
        riskyEntities
    });
});
// CAISSE DE MANIFESTATION
app.get('/api/caisse-manifestation', (req, res) => {
    res.json(database.caisse_manifestation);
});

app.post('/api/caisse-manifestation/transaction', async (req, res) => {
    const newTransaction = req.body;
    newTransaction.id = `caisse_tx_${Date.now()}`;
    database.caisse_manifestation.transactions.push(newTransaction);
    // Mise à jour du solde
    if (newTransaction.type === 'entrée') {
        database.caisse_manifestation.solde += newTransaction.montant;
    } else if (newTransaction.type === 'sortie') {
        database.caisse_manifestation.solde -= newTransaction.montant;
    }
    await writeDatabaseFile();
    res.status(201).json(newTransaction);
});

app.post('/api/blockchain/transaction', async (req, res) => {
    const newTransaction = req.body;
    // La création d'un hash et d'une signature est simulée ici
    newTransaction.hash = `hash_${Date.now()}`;
    newTransaction.signature_numerique = `sig_${Date.now()}`;
    database.blockchain.transactions.push(newTransaction);
    await writeDatabaseFile();
    res.status(201).json(newTransaction);
});

app.post('/api/chat', async (req, res) => { /* ... */ });
app.get('/api/logs', async (req, res) => { /* ... */ });
app.post('/api/log/frontend-error', async (req, res) => { /* ... */ });
app.post('/api/log/performance', async (req, res) => { /* ... */ });
app.post('/api/log/user-action', async (req, res) => { /* ... */ });
app.post('/api/commentator', async (req, res) => { /* ... */ });

// DÉMARRAGE DU SERVEUR
initializeDatabase().then(() => {
    app.listen(port, () => {
        console.log(`Serveur d'enquête parlementaire démarré sur http://localhost:${port}`);
        console.log(`Documentation API Swagger UI disponible sur http://localhost:${port}/api-docs`);
        console.log(`Endpoints CRUD pour les flux: /api/financial-flows (POST, PUT, DELETE)`);
        console.log(`Endpoints CRUD pour les pétitions: /api/petitions (POST, PUT, DELETE)`);
        console.log(`Endpoints CRUD pour les entités: /api/entities (POST, PUT, DELETE)`);
        console.log(`Endpoint pour ajouter un événement d'affaire: /api/affaires/event (POST)`);
    });
});