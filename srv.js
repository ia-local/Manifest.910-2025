// Fichier : serveur.js
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
const Web3 = require('web3');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Nouvelle dépendance

// --- Initialisation des API et des serveurs ---
const app = express();
const port = process.env.PORT || 3000;
const bot = new Telegraf('7219104241:AAG2biLtqAucVucjHp1bSrjxnoxXWdNU2K0', {
    telegram: {
      webhookReply: true,
    },
});
let chatLog = {};

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// Initialisation de l'API Google Gemini pour la génération d'images
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

// Données de référence de la réforme
const gouv_lawArticles = {
    objectifs: [
        "Améliorer la valorisation des compétences.",
        "Favoriser la formation et la professionnalisation.",
        "Encourager l'innovation et la création d'emplois qualifiés."
    ],
    modifications: {
        L3121_1: "Définition du travail pour inclure la monétisation des compétences basée sur le CVNU.",
        L4331_1: "Smart contracts pour la sécurisation et la transparence des transactions liées à la monétisation des compétences.",
        L3222_1: "Redéfinition de la durée légale de travail et de sa monétisation.",
        L4334_1: "Utilisation de la TVA pour financer la formation et l'emploi en fonction des compétences validées sur le CVNU.",
        L4333_1: "Suivi régulier de la répartition des recettes de la TVA."
    },
    reference_cgi: {
        article256: "Cet article du CGI définit le champ d'application de la TVA en France. La réforme propose de réaffecter une fraction de cette taxe existante pour financer les dispositifs de formation et d'emploi."
    }
};

app.get('/api/telegram-sites', (req, res) => {
    res.json(database.telegram_sites); // Utilise le nouveau nom dans la DB
});

// NOUVEAU: Point de terminaison pour les données de manifestation
app.get('/api/manifestation-points', (req, res) => {
    res.json(database.manifestation_points);
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
const BOYCOTT_FILE_PATH = path.join(__dirname, 'boycott.json');
let database = {};
let boycottsData = {};

let writeQueue = Promise.resolve();
let isWriting = false;

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
                organizers: [],
                beneficiaries: [], // AJOUT: Tableau pour les bénéficiaires
                cv_contracts: [], // AJOUT: Représentation des smart contracts CV
                // NOUVEAU: Données de manifestation
                manifestation_points: [
                    { "city": "Caen", "lat": 49.183333, "lon": -0.350000, "count": 6000 },
                    { "city": "Rennes", "lat": 48.11197912, "lon": -1.68186449, "count": 15000 },
                    { "city": "Grenoble", "lat": 45.185, "lon": 5.725, "count": 30000 }
                ]
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

async function loadBoycottData() {
    try {
        boycottsData = await readJsonFile(BOYCOTT_FILE_PATH, { boycotts: [] });
        console.log('Données de boycottage chargées avec succès.');
    } catch (error) {
        console.error('Erreur lors du chargement de boycott.json:', error);
        boycottsData = { boycotts: [] };
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

// NOUVELLE ROUTE: Endpoint pour la conversation IA du dashboard
app.post('/api/ai/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message manquant.' });
    }

    try {
        const aiResponse = await getGroqChatResponse(
            message,
            'gemma2-9b-it',
            "Vous êtes un assistant utile et informatif pour un tableau de bord de manifestation. Vous répondez aux questions sur le mouvement."
        );
        res.json({ response: aiResponse });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la communication avec l\'IA.' });
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
/imagine [description] - Créer une image à partir d'une description textuelle
/aboutai - En savoir plus sur mon fonctionnement
/help - Afficher ce message d'aide
`;
    await ctx.reply(helpMessage);
});


bot.help((ctx) => ctx.reply('Commandes disponibles: /start, /aide, /manifeste, /ric, /destitution, /create_poll, /stats, /imagine'));

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
    return `**La Procédure de Destitution : L'Article 68 de la Constitution** \nL'Article 68 de la Constitution française prévoit la possibilité de destituer le Président de la République en cas de manquement à ses devoirs manifestement incompatible avec l'exercice de son mandat. \n https://petitions.assemblee-nationale.fr/initiatives/i-2743 \n\nNotre mouvement demande une application rigoureuse et transparente de cet article, et la mise en place de mécanismes citoyens pour initier et suivre cette procédure. \nPour le moment, nous recueillons les avis et les soutiens via des sondages et des discussions au sein du bot. `;
}

bot.command('destitution', async (ctx) => {
    await ctx.replyWithMarkdown(await getDestitutionInfoMarkdown());
});

// Fonctions pour les informations RIC et Destitution (utilisées par commandes et actions)
async function getRicInfoMarkdown() {
    return `**Le Référendum d'Initiative Citoyenne (RIC) : Le Cœur de notre Démocratie !** Le RIC est l'outil essentiel pour redonner le pouvoir aux citoyens. Il se décline en plusieurs formes : \n* **RIC Législatif :** Proposer et voter des lois. \n* **RIC Abrogatoire :** Annuler une loi existante. \n* **RIC Constituant :** Modifier la Constitution. \n* **RIC Révocatoire :** Destituer un élu. \n\nC'est la garantie que notre voix sera directement entendue et respectée. \nNous organisons des sondages réguliers et des débats au sein du bot pour recueillir votre opinion et votre soutien sur le RIC. Utilisez la commande /sondage pour participer ! `;
}

// Nouvelle commande : /ric
bot.command('ric', async (ctx) => {
    await ctx.replyWithMarkdown(await getRicInfoMarkdown());
});

// COMMANDE CORRIGÉE ET SIMPLIFIÉE : /imagine [description]
bot.command('imagine', async (ctx) => {
    const topic = ctx.message.text.split(' ').slice(1).join(' ');
    if (!topic) {
        await ctx.reply("Veuillez fournir une description pour l'image. Exemple: /imagine un chien en costume.");
        return;
    }
    await ctx.reply('Génération de votre image...');
    try {
        const imageResponse = await genAI.getGeneratedImage(topic);
        if (imageResponse && imageResponse.url) {
            await ctx.replyWithPhoto({ url: imageResponse.url });
        } else {
            await ctx.reply("Désolé, je n'ai pas pu générer l'image. Le service est peut-être temporairement indisponible.");
        }
    } catch (error) {
        console.error('Erreur lors de la génération de l\'image:', error);
        await ctx.reply("Désolé, une erreur est survenue lors de la génération de l'image.");
    }
});

// --- Gestion des endpoints pour l'application web ---

app.get('/api/dashboard/summary', (req, res) => {
    const totalManifestants = Object.values(database.manifestation_points).reduce((sum, item) => sum + item.count, 0);
    const summary = {
        total_participants: totalManifestants
    };
    res.json(summary);
});


app.post('/api/boycotts', async (req, res) => {
    const newEntity = req.body;
    if (!newEntity || !newEntity.name || !newEntity.type || !newEntity.description) {
        return res.status(400).json({ error: 'Données d\'entité manquantes.' });
    }

    try {
        if (!boycottsData.boycotts) {
            boycottsData.boycotts = [];
        }
        boycottsData.boycotts.push(newEntity);
        await writeJsonFile(BOYCOTT_FILE_PATH, boycottsData);
        res.status(201).json({ message: 'Entité ajoutée avec succès.', data: newEntity });
    } catch (error) {
        console.error('Erreur lors de l\'ajout d\'une entité de boycottage:', error);
        res.status(500).json({ error: 'Erreur lors de l\'ajout de l\'entité.' });
    }
});


app.get('/api/boycotts', (req, res) => {
    res.json(boycottsData.boycotts);
});


// Endpoint pour enregistrer un nouveau bénéficiaire
app.post('/api/beneficiaries/register', async (req, res) => {
    const { name, email, cv_score } = req.body; // cv_score simule la valeur du CV
    if (!name || !email || cv_score === undefined) {
        return res.status(400).json({ error: 'Données manquantes pour l\'inscription.' });
    }
    
    // Assurez-vous que l'email n'est pas déjà enregistré
    const existingBeneficiary = database.beneficiaries.find(b => b.email === email);
    if (existingBeneficiary) {
        return res.status(409).json({ error: 'Cet email est déjà enregistré.' });
    }

    // Création d'une entrée pour le nouveau bénéficiaire
    const newBeneficiary = {
        id: uuidv4(),
        name,
        email,
        cv_score: cv_score, // La valeur du CV (entre 500 et 5000)
        registration_date: new Date().toISOString()
    };
    
    database.beneficiaries.push(newBeneficiary);
    await writeDatabaseFile();
    
    res.status(201).json({ 
        message: 'Citoyen enregistré avec succès.', 
        beneficiary: newBeneficiary 
    });
});

// --- Démarrage du serveur ---
initializeDatabase().then(() => {
    //readRicsFile(); // Lecture du fichier rics.json séparément
    loadBoycottData();
    bot.launch();
    console.log('Bot Telegram démarré.');

    app.listen(port, () => {
        console.log(`Serveur démarré sur http://localhost:${port}`);
    });
}).catch(error => {
    console.error("Échec de l'initialisation du serveur:", error);
    process.exit(1);
});