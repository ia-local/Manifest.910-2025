require('dotenv').config();

const express = require('express');
const path = require('path');
const fsp = require('fs/promises');
const fs = require('fs');
const Groq = require('groq-sdk');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const { Telegraf, Markup } = require('telegraf');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// --- Configuration de Groq ---
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// --- Chargement des fichiers JSON de rôles Groq (Utilisation de fs synchrone) ---
let rolesSystem = { system: { content: "Vous êtes un assistant IA généraliste." } };
let rolesAssistant = { assistant: { content: "Je suis un assistant IA utile et informatif." } };
let rolesUser = { user: { content: "Je suis un utilisateur." } };

try {
    const rolesSystemPath = path.join(__dirname, 'role', 'roles-system.json');
    const rolesAssistantPath = path.join(__dirname, 'role', 'roles-assistant.json');
    const rolesUserPath = path.join(__dirname, 'role', 'roles-user.json');

    rolesSystem = JSON.parse(fs.readFileSync(rolesSystemPath, 'utf8'));
    rolesAssistant = JSON.parse(fs.readFileSync(rolesAssistantPath, 'utf8'));
    rolesUser = JSON.parse(fs.readFileSync(rolesUserPath, 'utf8'));

} catch (error) {
    console.error('Erreur lors du chargement des fichiers de rôles Groq:', error);
}

// --- Fonctions LLM Groq ---
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
            model: 'gemma2-9b-it',
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

// --- Configuration du Serveur Express ---
app.use(express.static('docs'));
app.use(bodyParser.json());
app.use(cors());

const STATS_FILE = path.join(__dirname, 'data', 'stats.json');
const POLLS_FILE = path.join(__dirname, 'data', 'polls.json');
const DATABASE_FILE = path.join(__dirname, 'data', 'database.json');
const swaggerDocumentPath = path.join(__dirname, 'api-docs', 'swagger.yaml');
const swaggerDocument = YAML.load(swaggerDocumentPath);

let database = {};
let writeQueue = Promise.resolve();
let isWriting = false;

// Correction: Création du dossier et écriture sécurisée
async function writeDatabaseFile() {
    writeQueue = writeQueue.then(async () => {
        if (isWriting) return;
        isWriting = true;
        try {
            await fsp.mkdir(path.dirname(DATABASE_FILE), { recursive: true });
            await fsp.writeFile(DATABASE_FILE, JSON.stringify(database, null, 2), { encoding: 'utf8' });
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
        const data = await fsp.readFile(DATABASE_FILE, { encoding: 'utf8' });
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
                entities: [],
                caisse: { solde: 0, redistribution_fund: 0, transactions: [] },
                boycotts: []
            };
            await writeDatabaseFile();
        } else {
            console.error('Erreur fatale lors du chargement de database.json:', error);
            process.exit(1);
        }
    }
}

// --- Fonctions de lecture/écriture pour les statistiques et sondages (Utilisation de fs/promises) ---
async function readJsonFile(filePath, defaultValue = {}) {
    try {
        await fsp.mkdir(path.dirname(filePath), { recursive: true });
        const data = await fsp.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fsp.writeFile(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
            return defaultValue;
        }
        console.error(`Erreur de lecture du fichier ${filePath}:`, error);
        return defaultValue;
    }
}

async function writeJsonFile(filePath, data) {
    try {
        await fsp.mkdir(path.dirname(filePath), { recursive: true });
        await fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Erreur d'écriture du fichier ${filePath}:`, error);
    }
}

// --- Logique de taxation ---
function findTaxById(taxId) {
    return database.taxes.find(t => t.id === taxId);
}

async function calculateTaxAndAddToCaisse(transactionAmount, taxId) {
    const taxRule = findTaxById(taxId);

    if (!taxRule) {
        console.error(`Règle de taxation avec l'ID ${taxId} non trouvée.`);
        return null;
    }

    const taxAmount = transactionAmount * taxRule.rate;
    database.caisse.solde += taxAmount;

    database.caisse.transactions.push({
        id: `tx_${Date.now()}`,
        type: 'entrée',
        montant: taxAmount,
        description: `Taxe sur transaction de ${transactionAmount}€ (${taxRule.name})`,
        date: new Date().toISOString(),
        tax_id: taxId
    });

    await writeDatabaseFile();
    return database.caisse;
}

// --- Configuration du Bot Telegram ---
const bot = new Telegraf('7281441282:AAGmRKFY2yDZ0BlkSW0hZpMWSLwsiTRYYCQ', {
    telegram: {
      webhookReply: true,
    },
  });
const ORGANIZER_GROUP_ID = process.env.ORGANIZER_GROUP_ID;
const ADMIN_IDS = process.env.TELEGRAM_ADMIN_IDS ? process.env.TELEGRAM_ADMIN_IDS.split(',').map(Number) : [];

if (bot) {
    bot.catch((err, ctx) => {
        console.error(`\n[ERREUR TELEGRAF] Erreur pour l'update ${ctx.update.update_id || 'inconnue'} :`, err);
        if (ctx.chat) {
            ctx.reply('Désolé, une erreur est survenue lors du traitement de votre demande.').catch(replyErr => {
                console.error('Erreur lors de l\'envoi du message d\'erreur à l\'utilisateur:', replyErr);
            });
        }
    });

    // --- COMMANDES ET ACTIONS DU BOT TELEGRAM ---
    bot.start(async (ctx) => {
        const payload = ctx.startPayload;
        let welcomeMessage = `Bonjour citoyen(ne) ! 👋\n\nBienvenue dans l'espace de mobilisation pour la **Grève Générale du 10 Septembre 2025** et la **Justice Sociale** ! Je suis votre assistant pour le mouvement.`;
        if (payload) {
            welcomeMessage += `\n\nVous êtes arrivé via un lien d'invitation : \`${payload}\`. Merci de rejoindre notre cause !`;
        }
        welcomeMessage += `\n\nComment puis-je vous aider à vous informer et à vous engager ?`;
        const inlineKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('📜 Le Manifeste', 'show_manifesto')],
            [Markup.button.callback('🗳️ S\'engager (RIC/Pétitions)', 'engage_menu')],
            [Markup.button.callback('✊ Infos Grève 10 Sept.', 'strike_info')],
            [Markup.button.callback('📊 Participer aux Sondages', 'show_polls')],
            [Markup.button.callback('❓ Aide & Commandes', 'show_help')]
        ]);
        await ctx.replyWithMarkdown(welcomeMessage, inlineKeyboard);
    });

    bot.action('engage_menu', async (ctx) => {
        await ctx.answerCbQuery();
        const engageMessage = `Choisissez comment vous souhaitez vous engager :\n\n` +
                              `✅ **Signer la Pétition RIC :** Le Référendum d'Initiative Citoyenne est au cœur de nos demandes. Participez à nos sondages réguliers sur le sujet, ou lancez la commande /ric pour en savoir plus.\n\n` +
                              `⚖️ **Soutenir la Procédure de Destitution :** Nous visons la responsabilisation des élus. Utilisez la commande /destitution pour comprendre l'Article 68 et nos actions.\n\n` +
                              `💬 **Jugement Majoritaire & Justice Sociale :** Explorez nos propositions pour une démocratie plus juste. Vous pouvez poser des questions à l'IA ou utiliser la commande /manifeste pour plus de détails sur nos objectifs de justice sociale.`;
        const inlineKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('En savoir plus sur le RIC', 'ric_info_from_engage')],
            [Markup.button.callback('En savoir plus sur la Destitution', 'destitution_info_from_engage')],
            [Markup.button.callback('Retour au menu principal', 'start_menu')]
        ]);
        await ctx.replyWithMarkdown(engageMessage, inlineKeyboard);
    });

    bot.action('ric_info_from_engage', async (ctx) => {
        await ctx.answerCbQuery();
        await bot.telegram.sendMessage(ctx.chat.id, await getRicInfoMarkdown(), { parse_mode: 'Markdown' });
    });

    bot.action('destitution_info_from_engage', async (ctx) => {
        await ctx.answerCbQuery();
        await bot.telegram.sendMessage(ctx.chat.id, await getDestitutionInfoMarkdown(), { parse_mode: 'Markdown' });
    });

    bot.action('start_menu', async (ctx) => {
        await ctx.answerCbQuery();
        await bot.start(ctx);
    });

    bot.action('show_manifesto', async (ctx) => {
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

    bot.action('strike_info', async (ctx) => {
        await ctx.answerCbQuery();
        const strikeInfo = `**Informations Clés sur la Grève Générale du 10 Septembre 2025 :**
\nNous appelons à une mobilisation massive dans toute la France.
\n* **Date :** Mercredi 10 Septembre 2025.
\n* **Type d'action :** Grève Générale interprofessionnelle et manifestations citoyennes.
\n* **Objectifs :** Exiger l'instauration du RIC, la justice fiscale et sociale, la responsabilisation des élus.
\n\nDes points de rassemblement spécifiques seront communiqués dans les semaines à venir via ce bot et nos canaux de communication officiels Telegram. Restez connectés !
\n\nPartagez l'information et organisez-vous localement ! Votre participation est essentielle.
`;
        await ctx.replyWithMarkdown(strikeInfo);
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

    bot.action('about_ai', async (ctx) => {
        await ctx.answerCbQuery();
        const aboutAIMessage = `Je suis un assistant IA basé sur les modèles de langage de Groq, entraîné pour vous informer et vous aider à vous engager dans le mouvement 'Le 10 Septembre'. Mon rôle est de faciliter la communication et l'accès à l'information sur nos objectifs de justice sociale et de démocratie.`;
        await ctx.reply(aboutAIMessage);
    });

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

    async function getDestitutionInfoMarkdown() {
        return `**La Procédure de Destitution : L'Article 68 de la Constitution**
\nL'Article 68 de la Constitution française prévoit la possibilité de destituer le Président de la République en cas de manquement à ses devoirs manifestement incompatible avec l'exercice de son mandat.

\n\nNotre mouvement demande une application rigoureuse et transparente de cet article, et la mise en place de mécanismes citoyens pour initier et suivre cette procédure.
\nPour le moment, nous recueillons les avis et les soutiens via des sondages et des discussions au sein du bot.
`;
    }

    bot.command('manifeste', async (ctx) => {
        await ctx.replyWithMarkdown(
            `**Le Manifeste 'Le 10 Septembre' :**
Nous sommes le peuple, et nous exigeons une République juste et transparente. Nos piliers :
\n1.  **RIC (Référendum d'Initiative Citoyenne) :** Le pouvoir au peuple pour initier, abroger, amender des lois, et révoquer des élus.
\n2.  **Justice Sociale :** Égalité des chances, redistribution équitable des richesses, fin des privilèges.
\n3.  **Responsabilisation Politique :** Application stricte de l'Article 68 de la Constitution pour la destitution des élus coupables de manquements graves.
\n4.  **Écologie Solidaire :** Une transition écologique juste, financée par ceux qui polluent le plus.
\n5.  **Transparence et Intégrité :** Lutte implacable contre la corruption et les conflits d'intérêts.

\n\nPour une lecture complète, explorez les commandes spécifiques (/ric, /destitution) ou discutez avec l'IA.
    `);
    });

    bot.command('ric', async (ctx) => {
        await ctx.replyWithMarkdown(await getRicInfoMarkdown());
    });

    bot.command('destitution', async (ctx) => {
        await ctx.replyWithMarkdown(await getDestitutionInfoMarkdown());
    });

    bot.command('greve', async (ctx) => {
        await ctx.replyWithMarkdown(
            `**Préparons ensemble la Grève Générale du 10 Septembre 2025 !**
\nNous appelons à une mobilisation historique pour faire entendre nos exigences de justice sociale et de démocratie.
\n* **Participez !** Que vous soyez salarié, étudiant, retraité, solidaire, votre présence est cruciale.
\n* **Organisez-vous !** Créez des collectifs locaux, parlez-en autour de vous.
\n* **Informez-vous !** Suivez nos annonces pour les points de rassemblement et les actions spécifiques via ce bot.

\n\nEnsemble, nous pouvons faire changer les choses !
    `);
    });

    bot.command('sondage', async (ctx) => {
        const polls = await readJsonFile(POLLS_FILE, []);
        if (polls.length === 0) {
            await ctx.reply('Aucun sondage actif pour le moment. Restez à l\'écoute !');
            return;
        }
        let message = '📊 **Sondages Actifs :**\n\n';
        const inlineKeyboardButtons = [];
        polls.forEach((poll, index) => {
            message += `*${index + 1}. ${poll.question}*\n`;
            poll.options.forEach(option => {
                message += `   - ${option.text}\n`;
            });
            message += `   (Votez avec /voter${poll.id} [numéro_option])\n\n`;
        });
        await ctx.replyWithMarkdown(message, Markup.inlineKeyboard(inlineKeyboardButtons));
    });

    bot.hears(/^\/voter(\d+) (\d+)$/, async (ctx) => {
        const pollId = ctx.match[1];
        const optionNumber = parseInt(ctx.match[2], 10);
        const userId = ctx.from.id;

        let polls = await readJsonFile(POLLS_FILE, []);
        const pollIndex = polls.findIndex(p => p.id === pollId);
        if (pollIndex === -1) {
            await ctx.reply('Ce sondage n\'existe pas.');
            return;
        }
        const poll = polls[pollIndex];
        if (poll.votes && poll.votes[userId]) {
            await ctx.reply('Vous avez déjà voté pour ce sondage.');
            return;
        }
        if (optionNumber < 1 || optionNumber > poll.options.length) {
            await ctx.reply(`Option invalide. Veuillez choisir un numéro entre 1 et ${poll.options.length}.`);
            return;
        }

        if (!poll.votes) {
            poll.votes = {};
        }
        poll.votes[userId] = optionNumber - 1;
        poll.options[optionNumber - 1].count = (poll.options[optionNumber - 1].count || 0) + 1;

        await writeJsonFile(POLLS_FILE, polls);
        await ctx.reply(`Merci pour votre participation au sondage "${poll.question}" !`);
        await displayPollResults(ctx, pollId);
    });

    async function displayPollResults(ctx, pollId) {
        const polls = await readJsonFile(POLLS_FILE, []);
        const poll = polls.find(p => p.id === pollId);
        if (!poll) return;
        let resultsMessage = `📊 **Résultats pour "${poll.question}" :**\n\n`;
        const totalVotes = Object.keys(poll.votes || {}).length;
        poll.options.forEach(option => {
            const count = option.count || 0;
            const percentage = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : 0;
            resultsMessage += `- ${option.text}: ${count} votes (${percentage}%)\n`;
        });
        resultsMessage += `\nTotal des participants : ${totalVotes}`;
        await ctx.replyWithMarkdown(resultsMessage);
    }

    bot.command('create_poll', async (ctx) => {
        if (!ADMIN_IDS.includes(ctx.from.id)) {
            await ctx.reply('Vous n\'êtes pas autorisé à créer des sondages.');
            return;
        }
        const args = ctx.message.text.split(' ').slice(1).join(' ').split('|');
        if (args.length < 2) {
            await ctx.reply('Usage: /create_poll "Question du sondage"|"Option 1"|"Option 2"|..."');
            return;
        }
        const question = args[0].trim();
        const options = args.slice(1).map(opt => ({ text: opt.trim(), count: 0 }));
        if (options.length < 2) {
            await ctx.reply('Veuillez fournir au moins deux options pour le sondage.');
            return;
        }
        const newPoll = {
            id: (Math.random() * 1000000).toFixed(0),
            question,
            options,
            votes: {}
        };
        let polls = await readJsonFile(POLLS_FILE, []);
        polls.push(newPoll);
        await writeJsonFile(POLLS_FILE, polls);
        await ctx.reply(`Sondage créé avec succès !\nID: ${newPoll.id}\nQuestion: ${newPoll.question}\nOptions: ${options.map(o => o.text).join(', ')}\nVotez avec /voter${newPoll.id} [numéro_option]`);
    });

    bot.command('petition', async (ctx) => {
        await ctx.replyWithMarkdown(
            `➡️ **Pétitions en cours :**\n\nNos pétitions sont désormais gérées directement via des sondages et des expressions de soutien au sein du bot.\n\nUtilisez la commande /sondage pour voir les pétitions et les points de mobilisation actifs. Votre soutien est essentiel !`
        );
    });

    bot.command('inviter', async (ctx) => {
        const botUsername = ctx.botInfo.username;
        const inviteLink = `https://t.me/${botUsername}?start=invite_${ctx.from.id}`;
        await ctx.replyWithMarkdown(
            `Partagez ce lien pour inviter vos amis à rejoindre notre mouvement et le bot :\n\n\`${inviteLink}\`\n\nPlus nous sommes nombreux, plus notre voix porte !`
        );
    });

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

    bot.command('stats', async (ctx) => {
        const stats = await readJsonFile(STATS_FILE, { totalMessages: 0 });
        const statsMessage = `📊 Statistiques d'utilisation du bot :\nTotal de messages traités : ${stats.totalMessages}`;
        await ctx.reply(statsMessage);
    });


    bot.on('text', async (ctx) => {
        try {
            const stats = await readJsonFile(STATS_FILE, { totalMessages: 0 });
            stats.totalMessages = (stats.totalMessages || 0) + 1;
            await writeJsonFile(STATS_FILE, stats);
        } catch (error) {
            console.error('Erreur lors de la mise à jour du compteur de messages:', error);
        }
        if (ctx.message.text.startsWith('/')) {
            return;
        }
        await ctx.replyWithChatAction('typing');
        try {
            const userMessage = ctx.message.text;
            const aiResponse = await getGroqChatResponse(
                userMessage,
                'gemma2-9b-it',
                rolesAssistant.assistant.content
            );
            await ctx.reply(aiResponse);
        } catch (error) {
            console.error('Échec de la génération de la réponse IA (Telegram) avec gemma2-9b-it:', error);
            await ctx.reply('Une erreur est survenue lors du traitement de votre demande de conversation IA. Veuillez vérifier la configuration de l\'IA ou réessayer plus tard.');
        }
    });
}


app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/roles', express.static(path.join(__dirname, 'public', 'roles')));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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

// TAXES
app.get('/api/taxes', (req, res) => {
    res.json(database.taxes);
});

// BOYCOTTS
app.get('/api/boycotts', (req, res) => {
    res.json(database.boycotts);
});
app.post('/api/boycotts', async (req, res) => {
    const newBoycott = { id: `b_${Date.now()}`, ...req.body };
    database.boycotts.push(newBoycott);
    await writeDatabaseFile();
    res.status(201).json(newBoycott);
});
app.put('/api/boycotts/:id', async (req, res) => {
    const boycottId = req.params.id;
    const updatedData = req.body;
    const boycottIndex = database.boycotts.findIndex(b => b.id === boycottId);

    if (boycottIndex === -1) {
        return res.status(404).send('Boycott non trouvé.');
    }
    database.boycotts[boycottIndex] = { ...database.boycotts[boycottIndex], ...updatedData };
    await writeDatabaseFile();
    res.json(database.boycotts[boycottIndex]);
});
app.delete('/api/boycotts/:id', async (req, res) => {
    const boycottId = req.params.id;
    const initialLength = database.boycotts.length;
    database.boycotts = database.boycotts.filter(b => b.id !== boycottId);
    
    if (database.boycotts.length === initialLength) {
        return res.status(404).send('Boycott non trouvé.');
    }
    await writeDatabaseFile();
    res.status(204).send();
});

// CAISSE DE MANIFESTATION
app.get('/api/caisse-manifestation', (req, res) => {
    res.json(database.caisse);
});

app.post('/api/caisse-manifestation/transaction', async (req, res) => {
    const { montant, tax_id } = req.body;
    if (typeof montant !== 'number' || !tax_id) {
        return res.status(400).send('Les champs "montant" et "tax_id" sont requis.');
    }
    const caisse = await calculateTaxAndAddToCaisse(montant, tax_id);
    if (!caisse) {
        return res.status(400).send('La règle de taxation spécifiée n\'existe pas.');
    }
    res.status(201).json(caisse);
});

app.post('/api/caisse-manifestation/redistribute', async (req, res) => {
    const amountToRedistribute = database.caisse.solde;

    if (amountToRedistribute <= 0) {
        return res.status(400).send('Le solde de la caisse est nul. Aucune redistribution à effectuer.');
    }
    
    database.caisse.redistribution_fund += amountToRedistribute;
    database.caisse.solde = 0;

    database.caisse.transactions.push({
        id: `tx_${Date.now()}`,
        type: 'sortie',
        montant: amountToRedistribute,
        description: 'Redistribution des fonds de la caisse',
        date: new Date().toISOString()
    });

    await writeDatabaseFile();
    res.status(200).json(database.caisse);
});

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
            model: 'gemma2-9b-it',
            temperature: 0.1,
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


// AUTRES ROUTES API
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

// DÉMARRAGE DU SERVEUR
initializeDatabase().then(() => {
    app.listen(port, () => {
        console.log(`Serveur d'enquête parlementaire démarré sur http://localhost:${port}`);
        console.log(`Documentation API Swagger UI disponible sur http://localhost:${port}/api-docs`);
    });
    
    // Démarrage du bot Telegram
    if (BOT_TOKEN) {
        console.log('Tentative de lancement du bot Telegram...');
        bot.launch()
            .then(async () => {
                console.log('Telegram bot launched! ✨ Mouvement Citoyen 10 Septembre Bot.');
                await bot.telegram.setMyCommands([
                    { command: 'start', description: 'Démarrer le bot et voir le menu principal' },
                    { command: 'manifeste', description: 'Lire un extrait de notre manifeste' },
                    { command: 'ric', description: 'Tout savoir sur le Référendum d\'Initiative Citoyenne' },
                    { command: 'destitution', description: 'Comprendre la procédure de destitution (Art. 68)' },
                    { command: 'greve', description: 'Infos pratiques sur la Grève du 10 Septembre 2025' },
                    { command: 'sondage', description: 'Participer aux sondages d\'opinion' },
                    { command: 'petition', description: 'Accéder aux pétitions en cours (via le bot)' },
                    { command: 'inviter', description: 'Inviter des amis à rejoindre le mouvement' },
                    { command: 'contact', description: 'Envoyer un message aux organisateurs' },
                    { command: 'stats', description: 'Afficher les statistiques d\'utilisation du bot' },
                    { command: 'aboutai', description: 'En savoir plus sur l\'IA du bot' },
                    { command: 'help', description: 'Afficher les commandes disponibles' },
                ]).catch(err => {
                    console.error('Erreur lors de la définition des commandes du bot:', err);
                });
            })
            .catch(err => {
                console.error('\n[ERREUR FATALE] Échec du lancement du bot Telegram:', err);
            });
    } else {
        console.warn('TELEGRAM_BOT_TOKEN n\'est pas configuré dans votre .env. Le bot Telegram ne sera pas lancé.');
    }
});

// Correction: Gestion d'arrêt plus robuste
process.once('SIGINT', async () => {
    console.log('Arrêt du bot et du serveur (SIGINT)');
    if (bot && bot.polling) {
        await bot.stop('SIGINT').catch(err => console.error('Erreur lors de l\'arrêt du bot:', err));
    }
    process.exit(0);
});
process.once('SIGTERM', async () => {
    console.log('Arrêt du bot et du serveur (SIGTERM)');
    if (bot && bot.polling) {
        await bot.stop('SIGTERM').catch(err => console.error('Erreur lors de l\'arrêt du bot:', err));
    }
    process.exit(0);
});