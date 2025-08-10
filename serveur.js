const { Telegraf, Markup } = require('telegraf');
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// --- Plus besoin de BASE_WEB_APP_URL puisque l'application web est retirée ---
// const BASE_WEB_APP_URL = 'https://ia-local.github.io/Manifest.910-2025';

// Initialisation des variables de rôles (avec valeurs par défaut pour la robustesse)
let rolesSystem = { system: { content: "Vous êtes un assistant IA généraliste." } };
let rolesAssistant = { assistant: { content: "Je suis un assistant IA utile et informatif." } };
let rolesUser = { user: { content: "Je suis un utilisateur." } };



// --- Chargement des fichiers JSON de rôles Groq ---
try {
    const rolesSystemPath = path.join(__dirname, 'role', 'roles-system.json');
    const rolesAssistantPath = path.join(__dirname, 'role', 'roles-assistant.json');
    const rolesUserPath = path.join(__dirname, 'role', 'roles-user.json');

    rolesSystem = JSON.parse(fs.readFileSync(rolesSystemPath, 'utf8'));
    rolesAssistant = JSON.parse(fs.readFileSync(rolesAssistantPath, 'utf8'));
    rolesUser = JSON.parse(fs.readFileSync(rolesUserPath, 'utf8'));

    // Vérification basique de la structure après chargement
    if (!rolesSystem.system || typeof rolesSystem.system.content !== 'string') {
        console.warn('roles-system.json a une structure inattendue. Assurez-vous qu\'il contient `{ "system": { "content": "..." } }`.');
        rolesSystem = { system: { content: "Vous êtes l'IA d'un mouvement citoyen." } };
    }
    if (!rolesAssistant.assistant || typeof rolesAssistant.assistant.content !== 'string') {
        console.warn('roles-assistant.json a une structure inattendue. Assurez-vous qu\'il contient `{ "assistant": { "content": "..." } }`.');
        rolesAssistant = { assistant: { content: "Je suis votre assistant pour le mouvement." } };
    }
    if (!rolesUser.user || typeof rolesUser.user.content !== 'string') {
        console.warn('roles-user.json a une structure inattendue. Assurez-vous qu\'il contient `{ "user": { "content": "..." } }`.');
        rolesUser = { user: { content: "Je suis un citoyen." } };
    }

} catch (error) {
    console.error('Erreur lors du chargement des fichiers de rôles Groq. Assurez-vous que les fichiers existent et sont valides JSON:', error);
    // Les valeurs par défaut seront utilisées si les fichiers ne peuvent pas être lus
}

// --- Configuration du Serveur Express (pour les stats ou futures APIs bot-spécifiques) ---
const app = express();
app.use(express.static('docs'));
const BOT_SERVER_PORT = process.env.BOT_SERVER_PORT || 3001; // Port différent du serveur Web principal (ex: 3000 ou 5007)

app.use(bodyParser.json());
app.use(cors()); // CORS ouvert pour le dev, à restreindre en production si utilisé par un frontend séparé

// IMPORTANT : Assurez-vous que le dossier 'data' existe à la racine de votre script Telegram
// Ex: data/stats.json et data/polls.json
const STATS_FILE = path.join(__dirname, 'data', 'stats.json');
const POLLS_FILE = path.join(__dirname, 'data', 'polls.json'); // Nouveau fichier pour les sondages

// --- Fonctions de lecture/écriture pour les statistiques et les sondages ---
async function readJsonFile(filePath, defaultValue = {}) {
    try {
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true }); // Crée le dossier si inexistant
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

async function writeJsonFile(filePath, data) {
    try {
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true }); // Crée le dossier si inexistant
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Erreur d'écriture du fichier ${filePath}:`, error);
    }
}

// --- Configuration du Bot Telegram ---
const bot = new Telegraf('7281441282:AAGmRKFY2yDZ0BlkSW0hZpMWSLwsiTRYYCQ', {
    telegram: {
      webhookReply: true,
    },
  });

const ORGANIZER_GROUP_ID = process.env.ORGANIZER_GROUP_ID; // ID du groupe où envoyer les sujets/messages importants
// Les IDs des administrateurs pour les commandes restreintes (ex: /create_poll)
const ADMIN_IDS = process.env.TELEGRAM_ADMIN_IDS ? process.env.TELEGRAM_ADMIN_IDS.split(',').map(Number) : [];

// Gestionnaire d'erreurs global pour Telegraf
bot.catch((err, ctx) => {
    console.error(`\n[ERREUR TELEGRAF] Erreur pour l'update ${ctx.update.update_id || 'inconnue'} :`, err);
    if (ctx.chat) {
        ctx.reply('Désolé, une erreur est survenue lors du traitement de votre demande. Les administrateurs ont été informés.').catch(replyErr => {
            console.error('Erreur lors de l\'envoi du message d\'erreur à l\'utilisateur:', replyErr);
        });
    }
});


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
        // Le bouton pour l'application web est supprimé
        [Markup.button.callback('❓ Aide & Commandes', 'show_help')]
    ]);

    await ctx.replyWithMarkdown(welcomeMessage, inlineKeyboard);
});

// Menu d'engagement (RIC/Pétitions) - Maintenant purement textuel ou par commandes internes
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

// Actions spécifiques pour les informations RIC/Destitution via le menu d'engagement
bot.action('ric_info_from_engage', async (ctx) => {
    await ctx.answerCbQuery();
    // Appelle la même logique que la commande /ric
    await bot.telegram.sendMessage(ctx.chat.id, await getRicInfoMarkdown(), { parse_mode: 'Markdown' });
});

bot.action('destitution_info_from_engage', async (ctx) => {
    await ctx.answerCbQuery();
    // Appelle la même logique que la commande /destitution
    await bot.telegram.sendMessage(ctx.chat.id, await getDestitutionInfoMarkdown(), { parse_mode: 'Markdown' });
});


// Action pour retourner au menu principal (pour le bouton "Retour")
bot.action('start_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await bot.start(ctx); // Simule la commande /start pour réafficher le menu principal
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

async function getDestitutionInfoMarkdown() {
    return `**La Procédure de Destitution : L'Article 68 de la Constitution**
\nL'Article 68 de la Constitution française prévoit la possibilité de destituer le Président de la République en cas de manquement à ses devoirs manifestement incompatible avec l'exercice de son mandat.

\n\nNotre mouvement demande une application rigoureuse et transparente de cet article, et la mise en place de mécanismes citoyens pour initier et suivre cette procédure.
\nPour le moment, nous recueillons les avis et les soutiens via des sondages et des discussions au sein du bot.
`;
}

// Nouvelle commande : /manifeste
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

// Nouvelle commande : /ric
bot.command('ric', async (ctx) => {
    await ctx.replyWithMarkdown(await getRicInfoMarkdown());
});

// Nouvelle commande : /destitution
bot.command('destitution', async (ctx) => {
    await ctx.replyWithMarkdown(await getDestitutionInfoMarkdown());
});

// Nouvelle commande : /greve
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

// Nouvelle commande : /sondage
bot.command('sondage', async (ctx) => {
    const polls = await readJsonFile(POLLS_FILE, []); // Lit les sondages existants

    if (polls.length === 0) {
        await ctx.reply('Aucun sondage actif pour le moment. Restez à l\'écoute !');
        return;
    }

    let message = '📊 **Sondages Actifs :**\n\n';
    const inlineKeyboardButtons = [];

    polls.forEach((poll, index) => {
        message += `*${index + 1}. ${poll.question}*\n`;
        // Afficher les options sans les réponses pour le vote
        poll.options.forEach(option => {
            message += `   - ${option.text}\n`;
        });
        message += `   (Votez avec /voter${poll.id} [numéro_option])\n\n`; // Exemple: /voter1 2
    });

    await ctx.replyWithMarkdown(message, Markup.inlineKeyboard(inlineKeyboardButtons));
});

// Gestionnaire de vote de sondage
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

    // Enregistrer le vote
    if (!poll.votes) {
        poll.votes = {};
    }
    poll.votes[userId] = optionNumber - 1; // Stocke l'index de l'option
    poll.options[optionNumber - 1].count = (poll.options[optionNumber - 1].count || 0) + 1;

    await writeJsonFile(POLLS_FILE, polls);
    await ctx.reply(`Merci pour votre participation au sondage "${poll.question}" !`);
    // Optionnel: Afficher les résultats mis à jour
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

// Commande (Admin) pour créer un sondage
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
        id: (Math.random() * 1000000).toFixed(0), // Simple ID
        question,
        options,
        votes: {} // Stores userId: optionIndex
    };

    let polls = await readJsonFile(POLLS_FILE, []);
    polls.push(newPoll);
    await writeJsonFile(POLLS_FILE, polls);

    await ctx.reply(`Sondage créé avec succès !\nID: ${newPoll.id}\nQuestion: ${newPoll.question}\nOptions: ${options.map(o => o.text).join(', ')}\nVotez avec /voter${newPoll.id} [numéro_option]`);
});


// Commande pour les pétitions (maintenant gérées via le bot)
bot.command('petition', async (ctx) => {
    await ctx.replyWithMarkdown(
        `➡️ **Pétitions en cours :**\n\nNos pétitions sont désormais gérées directement via des sondages et des expressions de soutien au sein du bot.\n\nUtilisez la commande /sondage pour voir les pétitions et les points de mobilisation actifs. Votre soutien est essentiel !`
    );
});


// Commande /inviter : génère un lien d'invitation avec un payload unique
bot.command('inviter', async (ctx) => {
    const botUsername = ctx.botInfo.username; // Le nom d'utilisateur de votre bot
    const inviteLink = `https://t.me/${botUsername}?start=invite_${ctx.from.id}`; // Lien d'invitation avec un payload unique
    await ctx.replyWithMarkdown(
        `Partagez ce lien pour inviter vos amis à rejoindre notre mouvement et le bot :\n\n\`${inviteLink}\`\n\nPlus nous sommes nombreux, plus notre voix porte !`
    );
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


// Commande /stats : affiche des statistiques d'utilisation du bot
bot.command('stats', async (ctx) => {
    const stats = await readJsonFile(STATS_FILE, { totalMessages: 0 });
    const statsMessage = `📊 Statistiques d'utilisation du bot :\nTotal de messages traités : ${stats.totalMessages}`;
    await ctx.reply(statsMessage);
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


// --- Lancement des serveurs et du chatbot terminal ---

// Lance le serveur Express du bot
app.listen(BOT_SERVER_PORT, () => {
    console.log(`✨ ----------------------------------------------------------->`);
    console.log(`✨ Serveur API du bot Telegram running on http://localhost:${BOT_SERVER_PORT}`);
    console.log(`✨ Ce serveur Express est dédié aux fonctions internes du bot (ex: stats, polls).`);
    // Le message sur l'application web externe est retiré
    console.log(`✨ ----------------------------------------------------------->`);

    // Lancement du chatbot terminal juste après le démarrage du serveur Express
    startTerminalChatbot();

    // Lancement du bot Telegram
    if (process.env.TELEGRAM_BOT_TOKEN) {
        console.log('Tentative de lancement du bot Telegram...');
        bot.launch()
            .then(async () => {
                console.log('Telegram bot launched! ✨ Mouvement Citoyen 10 Septembre Bot.');
                console.log(`✨ ----------------------------------------------------------->`);
                // Supprimer tout webhook existant pour s'assurer du polling
                await bot.telegram.deleteWebhook().catch(err => console.error('Erreur lors de la suppression du webhook précédent:', err));
                console.log('Webhook précédent, si existant, a été supprimé pour assurer le polling.');

                // Définir les commandes du bot sur Telegram (ceci met à jour le menu des commandes)
                bot.telegram.setMyCommands([
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
                ]).then(() => {
                    console.log('Commandes du bot définies avec succès sur Telegram.');
                }).catch(err => {
                    console.error('Erreur lors de la définition des commandes du bot:', err);
                });

            })
            .catch(err => {
                console.error('\n[ERREUR FATALE] Échec du lancement du bot Telegram:', err);
                console.warn('Veuillez vérifier attentivement votre TELEGRAM_BOT_TOKEN dans le fichier .env.');
                console.warn('Assurez-vous qu\'il est correct et qu\'il n\'y a pas d\'espace ou de caractères invisibles.');
                console.log(`✨ ----------------------------------------------------------->`);
            });
    } else {
        console.warn('TELEGRAM_BOT_TOKEN n\'est pas configuré dans votre .env. Le bot Telegram ne sera pas lancé.');
        console.log(`✨ ----------------------------------------------------------->`);
    }

}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Erreur: Le port ${BOT_SERVER_PORT} est déjà utilisé.`);
        console.error('Veuillez libérer le port (fermez les autres applications l\'utilisant) ou choisir un autre port (ex: 3002) dans votre fichier .env pour BOT_SERVER_PORT.');
    } else {
        console.error('Erreur inattendue lors du démarrage du serveur Express du bot:', err);
    }
    process.exit(1);
});

// Fonction pour le chatbot directement dans le terminal
async function startTerminalChatbot() {
    console.log('\n--- Chatbot Groq en mode Terminal (Rôle Système) ---');
    console.log('Ce chatbot est propulsé par Groq. Tapez vos messages et appuyez sur Entrée.');
    console.log('Pour quitter le chatbot et le serveur, appuyez sur Ctrl+C.');

    process.stdin.setEncoding('utf8');
    process.stdin.setRawMode(false); // Permet de lire l'entrée ligne par ligne
    process.stdin.resume(); // Commence à lire l'entrée

    console.log('\nIA (Groq): (Initialisation de la conversation...)');
    try {
        const initialResponse = await getGroqChatResponse(
            "Bonjour, en tant qu'assistant pour un mouvement citoyen, présentez-vous et demandez comment vous pouvez aider à mobiliser les citoyens.",
            'gemma2-9b-it',
            rolesSystem.system.content
        );
        console.log(`IA (Groq): ${initialResponse}`);
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de la communication avec Groq (terminal):', error);
        console.log('IA (Groq): Impossible de démarrer la conversation. Veuillez vérifier votre clé API Groq et votre connexion internet.');
    }

    process.stdout.write('Vous: ');

    process.stdin.on('data', async (input) => {
        const message = input.trim();
        if (!message) {
            process.stdout.write('Veuillez taper un message. Vous: ');
            return;
        }
        console.log('IA (Groq): (Réflexion...)');
        try {
            const aiResponse = await getGroqChatResponse(
                message,
                'gemma2-9b-it',
                rolesSystem.system.content
            );
            console.log(`IA (Groq): ${aiResponse}`);
        } catch (error) {
            console.error('Erreur lors de la communication avec Groq (terminal):', error);
            console.log('IA (Groq): Désolé, une erreur est survenue lors du traitement de votre demande.');
        }
        process.stdout.write('Vous: ');
    });
}

// Gérer l'arrêt propre du bot et du serveur
process.once('SIGINT', () => {
    console.log('Arrêt du bot et du serveur (SIGINT)');
    if (bot) bot.stop('SIGINT');
    process.exit(0);
});
process.once('SIGTERM', () => {
    console.log('Arrêt du bot et du serveur (SIGTERM)');
    if (bot) bot.stop('SIGTERM');
    process.exit(0);
});