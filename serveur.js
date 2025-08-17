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


// Initialisation des variables de rôles (avec valeurs par défaut pour la robustesse)
let rolesSystem = { system: { content: "Vous êtes un assistant IA généraliste." } };
let rolesAssistant = { assistant: { content: "Je suis un assistant IA utile et informatif." } };
let rolesUser = { user: { content: "Je suis un utilisateur." } };

// --- Configuration du serveur Express ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'docs')));
app.use('/roles', express.static(path.join(__dirname, 'docs', 'roles')));

const STATS_FILE = path.join(__dirname, 'data', 'stats.json');

const ORGANIZER_GROUP_ID = "https://ia-local.github.io/Manifest.910-2025"; 

app.get('/api/prefectures', (req, res) => {
    res.json(database.prefectures);
});

app.get('/api/telegram-sites', (req, res) => {
    res.json(database.telegram_sites); // Utilise le nouveau nom dans la DB
});


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

// Fonction utilitaire pour lire un fichier JSON et créer un fichier par défaut s'il n'existe pas
async function readJsonFile(filePath, defaultValue = {}) {
    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`Le fichier ${filePath} n'existe pas. Création d'un fichier vide/par défaut.`);
            await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
            return defaultValue;
        }
        console.error(`Erreur de lecture du fichier ${filePath}:`, error);
        return defaultValue;
    }
}

// Fonction utilitaire pour écrire un fichier JSON
async function writeJsonFile(filePath, data) {
    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
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
        return chatCompletion.choices[0].message.content;
    } catch (error) {
        console.error(`Erreur lors de la génération de la réponse IA (Groq model: ${model}):`, error);
        return 'Une erreur est survenue lors du traitement de votre demande. Veuillez réessayer plus tard.';
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

bot.start(async (ctx) => {
    const payload = ctx.startPayload;
    let welcomeMessage = `Bonjour citoyen(ne) ! 👋\n\nBienvenue dans l'espace de mobilisation pour la **Grève Générale du 10 Septembre 2025** et la **Justice Sociale** ! Je suis votre assistant pour le mouvement.`;

    if (payload) {
        welcomeMessage += `\n\nVous êtes arrivé via un lien d'invitation : \`${payload}\`. Merci de rejoindre notre cause !`;
    }

    welcomeMessage += `\n\nComment puis-je vous aider à vous informer et à vous engager ?`;

    const inlineKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📜 Le Manifeste', 'show_manifest')],
        [Markup.button.callback('🗳️ S\'engager (RIC/Pétitions)', 'engage_menu')],
        // Le bouton pour l'application web est supprimé
        [Markup.button.callback('❓ Aide & Commandes', 'show_help')]
    ]);

    await ctx.replyWithMarkdown(welcomeMessage, inlineKeyboard);
});

// Action pour retourner au menu principal (pour le bouton "Retour")
bot.action('start_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await bot.start(ctx); // Simule la commande /start pour réafficher le menu principal
});

bot.action('show_manifest', async (ctx) => {
    await ctx.answerCbQuery();
    const manifestoContent = `**Extrait du Manifeste 'Le 10 Septembre' :**
Notre mouvement est né de la conviction que la République doit retrouver ses valeurs de justice sociale, de démocratie directe et de transparence. Nous exigeons :
\n1.  **L'instauration du Référendum d'Initiative Citoyenne (RIC)** dans toutes ses formes (législatif, abrogatoire, constituant, révocatoire).
\n2.  **La mise en œuvre de la procédure de destitution** des élus, notamment présidentielle, en cas de manquement grave à leurs devoirs, conformément à l'Article 68 de la Constitution.
\n3.  **Une refonte du système fiscal** pour une plus grande équité et une contribution juste de chacun.
\n4.  **Une véritable transition écologique** qui ne laisse personne de côté, financée par la justice fiscale.
\n5.  **La fin de l'impunité** et la responsabilisation des élites économiques et politiques.

\n\nPour le manifeste complet et toutes nos propositions, interrogez l'IA ou explorez les commandes /manifeste, /ric, /destitution.
`;
    await ctx.replyWithMarkdown(manifestoContent);
});

bot.action('engage_menu', async (ctx) => {
    await ctx.answerCbQuery();
    const engageMessage = `Choisissez comment vous souhaitez vous engager :\n\n` +
                          `✅ **Signer la Pétition RIC :** Le Référendum d'Initiative Citoyenne est au cœur de nos demandes. Participez à nos sondages réguliers sur le sujet, ou lancez la commande /ric pour en savoir plus.\n\n` +
                          `⚖️ **Soutenir la Procédure de Destitution :** Nous visons la responsabilisation des élus. Utilisez la commande /destitution pour comprendre l'Article 68 et nos actions.\n\n` +
                          `💬 **Jugement Majoritaire & Justice Sociale :** Explorez nos propositions pour une démocratie plus juste. Vous pouvez poser des questions à l'IA ou utiliser la commande /manifeste pour plus de détails sur nos objectifs de justice sociale.`;
                          
    const inlineKeyboard = Markup.inlineKeyboard([
        // Les boutons Markup.button.url sont remplacés par des boutons callback ou simplement des instructions textuelles
        [Markup.button.callback('En savoir plus sur le RIC', 'ric_info_from_engage')],
        [Markup.button.callback('En savoir plus sur la Destitution', 'destitution_info_from_engage')],
        [Markup.button.callback('Retour au menu principal', 'start_menu')]
    ]);
    await ctx.replyWithMarkdown(engageMessage, inlineKeyboard);
});

bot.action('show_help', async (ctx) => {
    await ctx.answerCbQuery();
    const helpMessage = `Voici les commandes que vous pouvez utiliser :
/start - Revenir au menu principal et message de bienvenue
/manifeste - Lire un extrait de notre manifeste
/ric - Tout savoir sur le Référendum d'Initiative Citoyenne
/destitution - Comprendre la procédure de destitution (Art. 68)
/greve - Infos pratiques sur la Grève du 10 Septembre 2025
/sondage - Participer aux sondages d'opinion du mouvement
/petition - Accéder aux pétitions en cours (via le bot)
/inviter - Inviter des amis à rejoindre le bot et le mouvement
/contact [votre message] - Envoyer un message aux organisateurs
/stats - Afficher les statistiques d'utilisation du bot
/aboutai - En savoir plus sur mon fonctionnement
/help - Afficher ce message d'aide
`;
    await ctx.reply(helpMessage);
});


bot.help((ctx) => ctx.reply('Commandes disponibles: /start, /aide, /manifeste, /ric, /destitution, /create_poll, /stats'));

// Commande /stats : affiche des statistiques d'utilisation du bot
bot.command('stats', async (ctx) => {
    const stats = await readJsonFile(STATS_FILE, { totalMessages: 0 });
    const statsMessage = `📊 Statistiques d'utilisation du bot :\nTotal de messages traités : ${stats.totalMessages}`;
    await ctx.reply(statsMessage);
});


bot.command('manifeste', (ctx) => {
    ctx.reply('Le Manifeste du mouvement pour le 10 septembre est le suivant...');
});



// Nouvelle commande : /destitution
async function getDestitutionInfoMarkdown() {
    return `**La Procédure de Destitution : L'Article 68 de la Constitution**
\nL'Article 68 de la Constitution française prévoit la possibilité de destituer le Président de la République en cas de manquement à ses devoirs manifestement incompatible avec l'exercice de son mandat.

\n\nNotre mouvement demande une application rigoureuse et transparente de cet article, et la mise en place de mécanismes citoyens pour initier et suivre cette procédure.
\nPour le moment, nous recueillons les avis et les soutiens via des sondages et des discussions au sein du bot.
`;
}

bot.command('destitution', async (ctx) => {
    await ctx.replyWithMarkdown(await getDestitutionInfoMarkdown());
});


// Fonctions pour les informations RIC et Destitution (utilisées par commandes et actions)
async function getRicInfoMarkdown() {
    return `**Le Référendum d'Initiative Citoyenne (RIC) : Le Cœur de notre Démocratie !**
Le RIC est l'outil essentiel pour redonner le pouvoir aux citoyens. Il se décline en plusieurs formes :
\n* **RIC Législatif :** Proposer et voter des lois.
\n* **RIC Abrogatoire :** Annuler une loi existante.
\n* **RIC Constituant :** Modifier la Constitution.
\n* **RIC Révocatoire :** Destituer un élu.

\n\nC'est la garantie que notre voix sera directement entendue et respectée.
\nNous organisons des sondages réguliers et des débats au sein du bot pour recueillir votre opinion et votre soutien sur le RIC. Utilisez la commande /sondage pour participer !
`;
}

// Nouvelle commande : /ric
bot.command('ric', async (ctx) => {
    await ctx.replyWithMarkdown(await getRicInfoMarkdown());
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


// Traitement des messages texte généraux par l'IA (Groq)

bot.on('text', async (ctx) => {
    try {
        const stats = await readJsonFile(STATS_FILE, { totalMessages: 0 });
        stats.totalMessages = (stats.totalMessages || 0) + 1;
        await writeJsonFile(STATS_FILE, stats);
    } catch (error) {
        console.error('Erreur lors de la mise à jour du compteur de messages:', error);
    }

    if (ctx.message.text.startsWith('/')) {
        return; // Ne pas traiter les commandes comme des messages de conversation IA
    }
    await ctx.replyWithChatAction('typing');

    try {
        const userMessage = ctx.message.text;
        const aiResponse = await getGroqChatResponse(
            userMessage,
            'gemma2-9b-it', // Le modèle Groq que vous utilisez
            rolesAssistant.assistant.content // Rôle Assistant pour Telegram
        );
        await ctx.reply(aiResponse);
    } catch (error) {
        console.error('Échec de la génération de la réponse IA (Telegram) avec gemma2-9b-it:', error);
        await ctx.reply('Une erreur est survenue lors du traitement de votre demande de conversation IA. Veuillez vérifier la configuration de l\'IA ou réessayer plus tard.');
    }
});

// Commande /contact pour envoyer un message aux organisateurs

bot.command('contact', async (ctx) => {
    const messageContent = ctx.message.text.split(' ').slice(1).join(' ');
    if (!messageContent) {
        await ctx.reply('Veuillez fournir le message que vous souhaitez envoyer aux organisateurs. Exemple: /contact J\'ai une idée pour la grève.');
        return;
    }

    if (ORGANIZER_GROUP_ID) {
        try {
            await bot.telegram.sendMessage(ORGANIZER_GROUP_ID, `Nouveau message de l'utilisateur ${ctx.from.first_name} (${ctx.from.username || 'ID: ' + ctx.from.id}) :\n\n${messageContent}`);
            await ctx.reply('Votre message a été transmis aux organisateurs. Merci !');
        } catch (error) {
            console.error('Erreur lors de l\'envoi du message aux organisateurs:', error);
            await ctx.reply('Désolé, je n\'ai pas pu transmettre votre message aux organisateurs. Veuillez réessayer plus tard.');
        }
    } else {
        await ctx.reply('Le canal de contact des organisateurs n\'est pas configuré. Veuillez contacter l\'administrateur du bot.');
    }
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