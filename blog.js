require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const Groq = new require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const sharp = require('sharp');
const app = express();
const port = 5007;

// Modules pour la documentation Swagger
const swaggerUi = require('swagger-ui-express');
const yaml = require('yamljs');
const swaggerDocument = yaml.load('./api-docs/swagger.yaml');

app.use(express.static('public/'));
app.use('/output', express.static(path.join(__dirname, 'output')));
app.use(express.json({ limit: '10mb' }));

// Route pour servir la documentation Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'blog.html'));
});

// Route générique pour la génération d'un titre
app.get('/title', async (req, res) => {
    const topic = req.query.topic;
    if (!topic) {
        return res.status(400).json({ error: 'Le paramètre "topic" est manquant.' });
    }
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'assistant', content: `** **<br/> | in box |.`, },
                {
                    role: 'user',
                    content: `Génère un titre de blog accrocheur, percutant et instructif sur le thème suivant : ${topic}. Ta réponse doit contenir uniquement le titre et doit faire moins de 10 mots avec un emojix.`,
                },
            ],
            model: 'gemma2-9b-it',
        });
        res.status(200).send(chatCompletion.choices[0].message.content);
    } catch (error) {
        console.error('Erreur lors de la génération du titre :', error);
        res.status(500).send('Erreur lors de la génération du titre.');
    }
});

// Route générique pour la génération d'un article de blog
app.get('/content', async (req, res) => {
    const topic = req.query.topic;
    if (!topic) {
        return res.status(400).json({ error: 'Le paramètre "topic" est manquant.' });
    }
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'assistant', content: `** **<br/> | in box |.`, },
                {
                    role: 'user',
                    content: `Rédige un article de blog sur le thème ${topic}. Ta réponse doit être rédigée au format liste en HTML, respectant les normes du Web sémantique W3C intégrant des emojis intelligents associés.`,
                },
            ],
            model: 'gemma2-9b-it',
        });
        res.status(200).send(chatCompletion.choices[0].message.content);
    } catch (error) {
        console.error('Erreur lors de la génération du contenu :', error);
        res.status(500).send('Erreur lors de la génération du contenu.');
    }
});

// Fonction utilitaire pour générer la description de l'image
async function generateImageDescription(topic) {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'assistant', content: `** **<br/> | in box |.`, },
                {
                    role: 'user',
                    content: `Décris une image qui illustre le thème suivant : ${topic}. La description doit être suffisamment détaillée pour générer une image pertinente.`,
                },
            ],
            model: 'gemma2-9b-it',
        });
        return chatCompletion.choices[0].message.content;
    } catch (error) {
        console.error('Erreur lors de la génération de la description de l\'image :', error);
        return 'Image abstraite liée à l\'intelligence artificielle.';
    }
}

// Route générique pour la génération d'une image
app.get('/image', async (req, res) => {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const topic = req.query.topic;
    if (!topic) {
        return res.status(400).json({ error: 'Le paramètre "topic" est manquant.' });
    }
    try {
        const imageDescription = await generateImageDescription(topic);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-image-preview',
            generationConfig: {
                responseModalities: ['Text', 'Image'],
            },
        });
        const response = await model.generateContent(imageDescription);

        if (response && response.response && response.response.candidates && response.response.candidates.length > 0) {
            const parts = response.response.candidates[0].content.parts;
            for (const part of parts) {
                if (part.inlineData) {
                    const imageData = part.inlineData.data;
                    res.json({ image: imageData });
                    return;
                }
            }
        }
        res.status(500).json({ error: 'Image non trouvée' });
    } catch (error) {
        console.error('Erreur :', error);
        res.status(500).json({ error: 'Erreur lors de la génération de l\'image' });
    }
});

// Route pour la sauvegarde
app.post('/save', async (req, res) => {
    const { title, topic, imageData, content } = req.body;
    const fileName = `${topic}_${Date.now()}`;
    const outputDir = path.join(__dirname, 'output');
    const imagePath = path.join(outputDir, `${fileName}.webp`);
    const contentPath = path.join(outputDir, `${fileName}.md`);

    try {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }
        const imageBuffer = Buffer.from(imageData, 'base64');
        const webpBuffer = await sharp(imageBuffer).webp().toBuffer();
        fs.writeFileSync(imagePath, webpBuffer);

        const markdownContent = `
# ${title}

![Image](${fileName}.webp)

${content}
        `;
        fs.writeFileSync(contentPath, markdownContent);
        res.status(200).send('Contenu enregistré avec succès !');
    } catch (error) {
        console.error('Erreur :', error);
        res.status(500).send('Erreur lors de l\'enregistrement du contenu.');
    }
});

// Nouvelle route pour récupérer la liste des articles de blog
app.get('/blog', async (req, res) => {
    const outputDir = path.join(__dirname, 'output');
    try {
        const files = await fs.promises.readdir(outputDir);
        const blogPosts = [];

        for (const file of files) {
            if (file.endsWith('.md')) {
                const markdownContent = await fs.promises.readFile(path.join(outputDir, file), 'utf-8');
                const imageFileName = file.replace('.md', '.webp');
                
                const lines = markdownContent.split('\n');
                const titleLine = lines.find(line => line.startsWith('#'));
                const title = titleLine ? titleLine.substring(1).trim() : 'Titre non trouvé';

                const fullContent = lines.slice(3).join('\n').trim(); 
                
                blogPosts.push({
                    title: title,
                    image: `/output/${imageFileName}`, 
                    content: fullContent,
                    topic: file.split('_')[0]
                });
            }
        }
        res.json(blogPosts);
    } catch (error) {
        console.error('Erreur lors de la lecture des fichiers du blog :', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des articles de blog.' });
    }
});

app.listen(port, () => console.log(`Serveur en cours d'exécution sur le port http://localhost:${port}/blog.html`));