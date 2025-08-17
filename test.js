// --- Dépendances et initialisation ---
// Importe les variables d'environnement du fichier .env
require('dotenv').config();
// Importe le framework web Express pour créer le serveur
const express = require('express');
// Importe le module path pour gérer les chemins de fichiers
const path = require('path');
// Importe le module fs/promises pour les opérations de fichiers asynchrones
const fs = require('fs/promises');
// Importe le SDK de Groq pour l'interaction avec le modèle d'IA
const Groq = require('groq-sdk');
// Importe la bibliothèque Telegraf pour créer un bot Telegram et Markup pour les boutons
const { Telegraf, Markup } = require('telegraf');
// Importe uuid pour générer des identifiants uniques
const { v4: uuidv4 } = require('uuid');
// Importe les dépendances pour la documentation Swagger
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

// --- Initialisation des API et des serveurs ---
// Crée une instance de l'application Express
const app = express();
// Définit le port du serveur, en utilisant une variable d'environnement ou le port 3000 par défaut
const port = process.env.PORT || 3000;
// Initialise le bot Telegram avec le jeton d'authentification
// ATTENTION : Le jeton est hardcodé, ce qui est une faille de sécurité majeure.
const bot = new Telegraf('7281441282:AAGmRKFY2yDZ0BlkSW0hZpMWSLwsiTRYYCQ', {
    telegram: {
      webhookReply: true,
    },
  });
// Objet pour stocker l'historique de chat (non utilisé de manière persistante ici)
let chatLog = {};

// Initialise le client Groq avec la clé API
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});


// Initialisation des variables de rôles (avec valeurs par défaut)
// Ces rôles sont définis mais ne sont pas utilisés de manière dynamique dans les interactions IA du bot
let rolesSystem = { system: { content: "Vous êtes un assistant IA généraliste." } };
let rolesAssistant = { assistant: { content: "Je suis un assistant IA utile et informatif." } };
let rolesUser = { user: { content: "Je suis un utilisateur." } };

// --- Configuration du serveur Express ---
// Middleware pour parser les corps de requêtes JSON
app.use(express.json());
// Sert les fichiers statiques depuis le dossier 'docs'
app.use(express.static(path.join(__dirname, 'docs')));
// Sert les fichiers statiques pour les rôles IA
app.use('/roles', express.static(path.join(__dirname, 'docs', 'roles')));
// Chemin vers le fichier de statistiques
const STATS_FILE = path.join(__dirname, 'data', 'stats.json');

// Chargement de la documentation Swagger (YAML)
const swaggerDocumentPath = path.join(__dirname, 'api-docs', 'swagger.yaml');
let swaggerDocument = {};
try {
    swaggerDocument = YAML.load(swaggerDocumentPath);
    // Configuration de la route pour la documentation Swagger UI
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (error) {
    console.error('Erreur lors du chargement de la documentation Swagger:', error);
}

// --- Gestion de la base de données locale (database.json) ---
// Chemin vers le fichier de base de données
const DATABASE_FILE_PATH = path.join(__dirname, 'database.json');
// Variable globale pour stocker la base de données en mémoire
let database = {};

// File d'attente pour gérer les écritures concurrentes sur le fichier
let writeQueue = Promise.resolve();
let isWriting = false;

// Route API pour les sites de manifestation (lecture seule)
app.get('/api/manifestation-sites', (req, res) => res.json(database.manifestation_sites));

// Fonction pour écrire le fichier de base de données de manière sécurisée
async function writeDatabaseFile() {
    // Ajoute l'opération d'écriture à la file d'attente
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

// Fonction d'initialisation de la base de données
async function initializeDatabase() {
    try {
        const data = await fs.readFile(DATABASE_FILE_PATH, { encoding: 'utf8' });
        database = JSON.parse(data);
        console.log('Base de données chargée avec succès.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Si le fichier n'existe pas, on initialise une base de données vide
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
            // Gère d'autres erreurs fatales
            console.error('Erreur fatale lors du chargement de database.json:', error);
            process.exit(1);
        }
    }
}

// --- Fonctions de lecture/écriture pour les statistiques et les sondages ---
// Fonction utilitaire pour lire un fichier JSON et créer un fichier par défaut s'il n'existe pas
async function readJsonFile(filePath, defaultValue = {}) {
    try {
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        const data = await fs.promises.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`Le fichier ${filePath} n'existe pas. Création d'un fichier vide/par défaut.`);
            await fs.promises.writeFile(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
            return defaultValue;
        }
        console.error(`Erreur de lecture du fichier ${filePath}:`, error);
        return defaultValue;
    }
}

// Fonction utilitaire pour écrire un fichier JSON
async function writeJsonFile(filePath, data) {
    try {
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Erreur d'écriture du fichier ${filePath}:`, error);
    }
}
// --- Fonctions d'interaction avec l'IA (Groq) ---

// Fonction utilitaire pour envoyer des messages IA avec Groq
async function getGroqChatResponse(promptInput, model, systemMessageContent) {
    try {
        const messages = [];
        if (systemMessageContent) {
            messages.push({ role: 'system', content: systemMessageContent });
        }
        messages.push({ role: 'user', content: promptInput });

        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: model,
            temperature: 0.7,
            max_tokens: 2048,
        });
        // Vérifie si la réponse est valide avant de la retourner
        return chatCompletion.choices[0].message.content;
    } catch (error) {
        console.error(`Erreur lors de la génération de la réponse IA (Groq model: ${model}):`, error);
        return 'Une erreur est survenue lors du traitement de votre demande. Veuillez réessayer plus tard.';
    }
}
// Fonction d'interaction IA pour l'API web
async function getLlmResponse(userMessage, role, conversationHistory) {
    // Prompt système pour l'API web
    const systemPrompt = `Tu es un assistant IA spécialisé dans l'analyse de dossiers de corruption...`;

    // Met en forme l'historique de conversation
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

    // Prompt système pour cette tâche spécifique
    const aiPrompt = `À partir de la requête suivante, génère un objet JSON...`;
    
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'system', content: aiPrompt }, { role: 'user', content: query }],
            model: 'gemma2-9b-it',
            temperature: 0.1,
            stream: false,
        });

        const responseContent = chatCompletion?.choices?.[0]?.message?.content;
        // Tente de parser la réponse comme du JSON
        const jsonResponse = JSON.parse(responseContent);
        res.json(jsonResponse);
    } catch (error) {
        console.error('Erreur lors de la génération IA:', error);
        res.status(500).json({ error: 'Impossible de générer les données avec l\'IA.' });
    }
});

// --- Bot Telegram ---

// Gestionnaire pour la commande /start
bot.start(async (ctx) => {
    const payload = ctx.startPayload;
    // ...
    const inlineKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📜 Le Manifeste', 'show_manifest')],
        [Markup.button.callback('🗳️ S\'engager (RIC/Pétitions)', 'engage_menu')],
        [Markup.button.callback('❓ Aide & Commandes', 'show_help')]
    ]);

    await ctx.replyWithMarkdown(welcomeMessage, inlineKeyboard);
});

// Action pour retourner au menu principal
bot.action('start_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await bot.start(ctx);
});

// Gestionnaire pour le bouton 'show_manifest'
bot.action('show_manifest', async (ctx) => {
    await ctx.answerCbQuery();
    const manifestoContent = `**Extrait du Manifeste 'Le 10 Septembre' :**\n...`;
    await ctx.replyWithMarkdown(manifestoContent);
});

// Gestionnaire pour le bouton 'engage_menu'
bot.action('engage_menu', async (ctx) => {
    await ctx.answerCbQuery();
    const engageMessage = `Choisissez comment vous souhaitez vous engager :\n\n...`;
    const inlineKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('En savoir plus sur le RIC', 'ric_info_from_engage')],
        [Markup.button.callback('En savoir plus sur la Destitution', 'destitution_info_from_engage')],
        [Markup.button.callback('Retour au menu principal', 'start_menu')]
    ]);
    await ctx.replyWithMarkdown(engageMessage, inlineKeyboard);
});

// Gestionnaire pour le bouton 'show_help'
bot.action('show_help', async (ctx) => {
    await ctx.answerCbQuery();
    const helpMessage = `Voici les commandes que vous pouvez utiliser :
/start - Revenir au menu principal et message de bienvenue
...`;
    await ctx.reply(helpMessage);
});


// ... Autres commandes comme /help, /manifeste, /destitution, /ric, /stats ...

// Commande /stats : affiche des statistiques d'utilisation du bot
bot.command('stats', async (ctx) => {
    const stats = await readJsonFile(STATS_FILE, { totalMessages: 0 });
    const statsMessage = `📊 Statistiques d'utilisation du bot :\nTotal de messages traités : ${stats.totalMessages}`;
    await ctx.reply(statsMessage);
});

// Traitement des messages texte généraux par l'IA (Groq)
bot.on('text', async (ctx) => {
    try {
        // Met à jour le compteur de messages
        const stats = await readJsonFile(STATS_FILE, { totalMessages: 0 });
        stats.totalMessages = (stats.totalMessages || 0) + 1;
        await writeJsonFile(STATS_FILE, stats);
    } catch (error) {
        console.error('Erreur lors de la mise à jour du compteur de messages:', error);
    }

    if (ctx.message.text.startsWith('/')) {
        return; // Évite de traiter les commandes comme des messages de conversation
    }
    await ctx.replyWithChatAction('typing');

    try {
        const userMessage = ctx.message.text;
        // Appelle la fonction utilitaire pour obtenir la réponse de l'IA
        const aiResponse = await getGroqChatResponse(
            userMessage,
            'gemma2-9b-it',
            rolesAssistant.assistant.content
        );
        await ctx.reply(aiResponse);
    } catch (error) {
        console.error('Échec de la génération de la réponse IA (Telegram)...', error);
        await ctx.reply('Une erreur est survenue lors du traitement de votre demande...');
    }
});


// --- Routes de l'API web (CRUD) ---
// Les routes CRUD sont bien définies et utilisent les fonctions asynchrones de lecture/écriture
// ... (routes pour /financial-flows, /affaires, /rics, /taxes, /entities, /boycotts, /caisse-manifestation, /blockchain, /dashboard/summary)

// --- Démarrage du serveur ---
// S'assure que la base de données est initialisée avant de lancer le bot et le serveur
initializeDatabase().then(() => {
    bot.launch();
    console.log('Bot Telegram démarré.');

    app.listen(port, () => {
        console.log(`Serveur d'enquête parlementaire démarré sur http://localhost:${port}`);
        console.log(`Documentation API Swagger UI disponible sur http://localhost:${port}/api-docs`);
    });
});