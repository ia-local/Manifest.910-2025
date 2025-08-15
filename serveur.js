// --- Dépendances et initialisation ---
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const Groq = require('groq-sdk');
const { Telegraf, Markup } = require('telegraf');
const { v4: uuidv4 } = require('uuid');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

// --- Initialisation des API et des serveurs ---
const app = express();
const port = process.env.PORT || 3000;
const bot = new Telegraf('7281441282:AAGmRKFY2yDZ0BlkSW0hZpMWSLwsiTRYYCQ', {
    telegram: {
      webhookReply: true,
    },
  });
let chatLog = {};

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// --- Configuration du serveur Express ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/roles', express.static(path.join(__dirname, 'public', 'roles')));

const swaggerDocumentPath = path.join(__dirname, 'api-docs', 'swagger.yaml');
let swaggerDocument = {};
try {
    swaggerDocument = YAML.load(swaggerDocumentPath);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (error) {
    console.error('Erreur lors du chargement de la documentation Swagger:', error);
}

// --- Gestion de la base de données locale (database.json) ---
const DATABASE_FILE_PATH = path.join(__dirname, 'database.json');
let database = {};

let writeQueue = Promise.resolve();
let isWriting = false;

app.get('/api/manifestation-sites', (req, res) => res.json(database.manifestation_sites));

async function writeDatabaseFile() {
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
                rics: [],
                taxes: [],
                boycotts: [],
                entities: [],
                caisse_manifestation: { solde: 0, transactions: [] },
                blockchain: { transactions: [] },
                polls: [],
                organizers: []
            };
            await writeDatabaseFile();
        } else {
            console.error('Erreur fatale lors du chargement de database.json:', error);
            process.exit(1);
        }
    }
}

// --- Fonctions d'interaction avec l'IA (Groq) ---

async function getGroqChatResponse(userMessage, chatId, context) {
    let chatHistory = chatLog[chatId] || [];
    let systemMessage = { role: 'system', content: `Ton rôle est ${context}. Réponds de manière concise.` };
    let messages = [systemMessage, ...chatHistory, { role: 'user', content: userMessage }];

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: 'gemma2-9b-it',
            temperature: 0.7,
            stream: false,
        });

        if (chatCompletion?.choices?.[0]?.message?.content) {
            chatLog[chatId] = [...chatHistory, { role: 'user', content: userMessage }, chatCompletion.choices[0].message];
            return chatCompletion.choices[0].message.content;
        } else {
            return 'Aucune réponse générée par l\'IA.';
        }
    } catch (error) {
        console.error('Erreur lors de l\'appel à Groq:', error);
        return 'Une erreur est survenue lors de la communication avec l\'IA.';
    }
}

async function getLlmResponse(userMessage, role, conversationHistory) {
    const systemPrompt = `Tu es un assistant IA spécialisé dans l'analyse de dossiers de corruption, de blanchiment d'argent, d'évasion fiscale et de prise illégale d'intérêts. Tu as accès à une base de données de l'enquête parlementaire française. L'enquête se concentre sur les actions de hauts fonctionnaires d'État entre 2017 et 2027. Tu peux prendre plusieurs rôles en fonction des requêtes de l'utilisateur. Ton ton doit être factuel, précis, et basé sur les données de l'enquête. Les rôles possibles sont : Enquêteur, Journaliste, Avocat et Juge. Le rôle actuel est: ${role}.`;

    const chatHistory = conversationHistory.map(item => ({
        role: item.role === 'user' ? 'user' : 'assistant',
        content: item.message
    }));

    chatHistory.push({ role: 'user', content: userMessage });

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'system', content: systemPrompt }, ...chatHistory],
            model: 'gemma2-9b-it',
            stream: false,
        });

        if (chatCompletion?.choices?.[0]?.message?.content) {
            return chatCompletion.choices[0].message.content;
        } else {
            return 'Aucune réponse générée par l\'IA.';
        }
    } catch (error) {
        console.error('Erreur lors de l\'appel à Groq:', error);
        return 'Une erreur est survenue lors de la communication avec l\'IA.';
    }
}

// Endpoint IA pour générer des données d'entité pour l'application web
app.post('/api/ai/generate-entity', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'La requête est vide.' });

    const aiPrompt = `À partir de la requête suivante, génère un objet JSON qui inclut le 'name' (nom), le 'type' (supermarché, banque, etc.), une 'description' et des coordonnées 'geo' (latitude et longitude) pour l'entité. Réponds uniquement avec l'objet JSON. Voici la requête: "${query}"`;
    
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'system', content: aiPrompt }, { role: 'user', content: query }],
            model: 'gemma2-9b-it',
            temperature: 0.1,
            stream: false,
        });

        const responseContent = chatCompletion?.choices?.[0]?.message?.content;
        const jsonResponse = JSON.parse(responseContent);
        res.json(jsonResponse);
    } catch (error) {
        console.error('Erreur lors de la génération IA:', error);
        res.status(500).json({ error: 'Impossible de générer les données avec l\'IA.' });
    }
});

// --- Bot Telegram ---

bot.start((ctx) => ctx.reply('Bienvenue ! Utilisez /aide pour voir les commandes disponibles.'));
bot.help((ctx) => ctx.reply('Commandes disponibles: /start, /aide, /manifeste, /ric, /destitution, /create_poll, /stats'));

bot.command('manifeste', (ctx) => {
    ctx.reply('Le Manifeste du mouvement pour le 10 septembre est le suivant...');
});

bot.command('ric', async (ctx) => {
    const ricMessage = `
Le Référendum d'Initiative Citoyenne (RIC) correspond à l'article 16 de la Déclaration des droits de l'homme et du citoyen, garantissant l'État de droit et la Constitution.

Il repose sur une séparation des pouvoirs :
- **Pouvoir juridique** pour porter l'initiative.
- **Pouvoir législatif** pour permettre l'exercice du droit de vote.
- **Pouvoir exécutif** par tirage au sort parmi les inscrits.

Note : La pétition (article 72-1 de la Constitution) est un droit distinct du RIC, qui vise une action législative directe.
    `;
    ctx.reply(ricMessage);
});

bot.command('destitution', (ctx) => {
    ctx.reply('Le processus de destitution, basé sur l\'article 68 de la Constitution, est envisagé en raison de...');
});

bot.command('create_poll', async (ctx) => {
    const question = 'Quel sujet devrions-nous aborder dans le prochain live ?';
    const options = ['Justice Sociale', 'Justice Fiscale', 'Justice Climatique'];

    try {
        const message = await ctx.replyWithPoll(question, options, { is_anonymous: false });
        const pollId = uuidv4();
        database.polls.push({
            id: pollId,
            messageId: message.message_id,
            question: question,
            options: options.map(opt => ({ text: opt, votes: 0 })),
            creatorId: ctx.from.id
        });
        await writeDatabaseFile();
    } catch (error) {
        console.error('Erreur lors de la création du sondage:', error);
    }
});

bot.on('poll_answer', async (ctx) => {
    const pollIndex = database.polls.findIndex(p => p.messageId === ctx.pollAnswer.poll_id);
    
    if (pollIndex !== -1) {
        ctx.pollAnswer.option_ids.forEach(optionIndex => {
            database.polls[pollIndex].options[optionIndex].votes++;
        });
        await writeDatabaseFile();
    }
});


bot.on('text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    const userMessage = ctx.message.text;
    const chatId = ctx.chat.id;
    const context = 'assistant';

    const aiResponse = await getGroqChatResponse(userMessage, chatId, context);
    ctx.reply(aiResponse);
});

// --- Routes de l'API web (CRUD) ---

// FINANCIAL FLOWS
app.get('/api/financial-flows', (req, res) => res.json(database.financial_flows));
app.post('/api/financial-flows', async (req, res) => {
    const newFlow = { id: uuidv4(), ...req.body };
    database.financial_flows.push(newFlow);
    await writeDatabaseFile();
    res.status(201).json(newFlow);
});
app.put('/api/financial-flows/:id', async (req, res) => {
    const index = database.financial_flows.findIndex(f => f.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Flux non trouvé.' });
    database.financial_flows[index] = { ...database.financial_flows[index], ...req.body };
    await writeDatabaseFile();
    res.json(database.financial_flows[index]);
});
app.delete('/api/financial-flows/:id', async (req, res) => {
    const index = database.financial_flows.findIndex(f => f.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Flux non trouvé.' });
    database.financial_flows.splice(index, 1);
    await writeDatabaseFile();
    res.status(204).end();
});

// AFFAIRES
app.get('/api/affaires', (req, res) => res.json(database.affaires));
app.post('/api/affaires/event', async (req, res) => {
    const newEvent = { id: uuidv4(), ...req.body };
    database.affaires.chronology.push(newEvent);
    await writeDatabaseFile();
    res.status(201).json(newEvent);
});

// RICS
app.get('/api/rics', (req, res) => res.json(database.rics));
app.post('/api/rics', async (req, res) => {
    const newRic = { id: uuidv4(), ...req.body };
    database.rics.push(newRic);
    await writeDatabaseFile();
    res.status(201).json(newRic);
});
app.put('/api/rics/:id', async (req, res) => {
    const index = database.rics.findIndex(r => r.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'RIC non trouvé.' });
    database.rics[index] = { ...database.rics[index], ...req.body };
    await writeDatabaseFile();
    res.json(database.rics[index]);
});
app.delete('/api/rics/:id', async (req, res) => {
    const index = database.rics.findIndex(r => r.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'RIC non trouvé.' });
    database.rics.splice(index, 1);
    await writeDatabaseFile();
    res.status(204).end();
});

// TAXES
app.get('/api/taxes', (req, res) => res.json(database.taxes));
app.post('/api/taxes', async (req, res) => {
    const newTax = { id: uuidv4(), ...req.body };
    database.taxes.push(newTax);
    await writeDatabaseFile();
    res.status(201).json(newTax);
});

// ENTITIES
app.get('/api/entities', (req, res) => res.json(database.entities));
app.post('/api/entities', async (req, res) => { /* ... */ });
app.put('/api/entities/:id', async (req, res) => { /* ... */ });
app.delete('/api/entities/:id', async (req, res) => { /* ... */ });

// BOYCOTTS (Nouvelle route pour le frontend)
// ROUTES CRUD POUR LES BOYCOTTAGES
app.get('/api/boycotts', (req, res) => res.json(database.boycotts));

// Route pour ajouter une nouvelle enseigne (CREATE)
app.post('/api/boycotts', async (req, res) => {
    const newEntity = req.body;
    // Générer un ID simple (UUID ou autre pour un projet plus grand)
    newEntity.id = `ent_${Date.now()}`; 
    database.boycotts.push(newEntity);
    await writeDatabaseFile();
    res.status(201).json(newEntity);
});

// Route pour mettre à jour une enseigne (UPDATE)
app.put('/api/boycotts/:id', async (req, res) => {
    const { id } = req.params;
    const updatedEntity = req.body;
    const index = database.boycotts.findIndex(e => e.id === id);
    if (index !== -1) {
        database.boycotts[index] = { ...database.boycotts[index], ...updatedEntity };
        await writeDatabaseFile();
        res.json(database.boycotts[index]);
    } else {
        res.status(404).json({ message: "Entité non trouvée" });
    }
});

// Route pour supprimer une enseigne (DELETE)
app.delete('/api/boycotts/:id', async (req, res) => {
    const { id } = req.params;
    const initialLength = database.boycotts.length;
    database.boycotts = database.boycotts.filter(e => e.id !== id);
    if (database.boycotts.length < initialLength) {
        await writeDatabaseFile();
        res.status(204).send(); // No Content
    } else {
        res.status(404).json({ message: "Entité non trouvée" });
    }
});

// CAISSE DE MANIFESTATION
app.get('/api/caisse-manifestation', (req, res) => res.json(database.caisse_manifestation));
app.post('/api/caisse-manifestation/transaction', async (req, res) => {
    const { type, montant, description } = req.body;
    const newTransaction = { id: uuidv4(), type, montant, description, date: new Date().toISOString() };
    database.caisse_manifestation.transactions.push(newTransaction);
    database.caisse_manifestation.solde += (type === 'entrée' ? montant : -montant);
    await writeDatabaseFile();
    res.status(201).json(newTransaction);
});

// Blockchain
app.post('/api/blockchain/transaction', async (req, res) => {
    const newBlock = { id: uuidv4(), ...req.body, hash: '...', signature: '...', timestamp: new Date().toISOString() };
    database.blockchain.transactions.push(newBlock);
    await writeDatabaseFile();
    res.status(201).json(newBlock);
});

// Dashboard Summary
app.get('/api/dashboard/summary', (req, res) => {
    const totalTransactions = database.financial_flows.length;
    const activeAlerts = database.financial_flows.filter(f => f.is_suspicious).length;
    const riskyEntities = new Set(database.boycotts.map(b => b.name)).size;
    const caisseSolde = database.caisse_manifestation.solde;
    const boycottCount = database.boycotts.length;
    const ricCount = database.rics.length;
    res.json({
        totalTransactions,
        activeAlerts,
        riskyEntities,
        caisseSolde,
        boycottCount,
        ricCount
    });
});

// --- Démarrage du serveur ---
initializeDatabase().then(() => {
    bot.launch();
    console.log('Bot Telegram démarré.');

    app.listen(port, () => {
        console.log(`Serveur d'enquête parlementaire démarré sur http://localhost:${port}`);
        console.log(`Documentation API Swagger UI disponible sur http://localhost:${port}/api-docs`);
    });
});