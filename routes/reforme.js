// routes/reforme.js
const express = require('express');
const router = express.Router();
const path = require('path');
const IA = require('groq-sdk');
const axios = require('axios');
const SMART_CONTRACT_API_URL = `http://localhost:${process.env.PORT || 3000}/smartContract/api`;

const Groq = new IA({ apiKey: process.env.GROQ_API_KEY });
// Données de référence
const lawArticles = `
    Objectifs de la réforme :
    - Améliorer la valorisation des compétences.
    - Favoriser la formation et la professionnalisation.
    - Encourager l'innovation et la création d'emplois qualifiés.

    Modifications du Code du Travail :
    - Article L3121-1 : Définition du travail pour inclure la monétisation des compétences basée sur le CVNU.
    - Article L4331-1 (nouvel article) : Smart contracts pour la sécurisation et la transparence des transactions liées à la monétisation des compétences.
    - Article L3222-1 : Redéfinition de la durée légale de travail et de sa monétisation.
    - Article L4334-1 : Utilisation de la TVA pour financer la formation et l'emploi en fonction des compétences validées sur le CVNU.
    - Article L4333-1 : Suivi régulier de la répartition des recettes de la TVA.
    - Article L2345-1 (nouvel article) : L'allocation universelle est versée automatiquement tous les 28 jours.
`;
const taxesList = {
    IR: "Impôt sur le revenu",
    RSA: "Revenus salariaux et assimilés",
    RPPM: "Revenus et profits du patrimoine mobilier",
    RFPI: "Revenus fonciers et profits du patrimoine immobilier",
    BA: "Bénéfices agricoles",
    BNC: "Bénéfices non commerciaux",
    BIC: "Bénéfices industriels et commerciaux",
    IS: "Impôt sur les sociétés",
    TVA: "Taxe sur la valeur ajoutée",
    TCA: "Taxes sur le chiffre d'affaires",
    CVAE: "Cotisation sur la Valeur Ajoutée des Entreprises",
    TPS: "Taxes et participations sur les salaires",
    TFP: "Taxes sur les facteurs de production",
    AIS: "Autres impositions sectorielles",
    IF: "Impôts fonciers",
    PAT: "Impôts sur le patrimoine",
    ENR: "Enregistrement",
    TCAS: "Taxe sur les conventions d'assurances et assimilées",
    REC: "Recouvrement",
    DAE: "Droit à l'erreur",
    CF: "Contrôle fiscal",
    CTX: "Contentieux",
    SJ: "Sécurité juridique",
    INT: "Fiscalité internationale",
    CAD: "Cadastre",
    DJC: "Dispositions juridiques communes",
    RES: "Rescrits",
    RIC: "Réseau, Intelligent connecté"
};


const detailedDevelopmentPlan = `...`;

async function generateContent(res, prompt) {
    try {
        const chatCompletion = await Groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: "gemma2-9b-it",
            temperature: 0.5,
            stream: false,
        });
        const generatedHtml = chatCompletion.choices[0]?.message?.content || "Erreur de génération.";
        res.send(generatedHtml);
    } catch (error) {
        console.error("Erreur lors de la génération du contenu :", error);
        res.status(500).send("Erreur lors de la génération du contenu.");
    }
}

router.get('/generate/smart-contracts', async (req, res) => {
    try {
        const solFilesResponse = await axios.get(`${SMART_CONTRACT_API_URL}/sol-files`);
        const solFiles = solFilesResponse.data.map(file => `<li>${file}</li>`).join('');

        const prompt = `Génère une présentation détaillée des Smart Contracts dans le cadre du projet de loi. Définis ce que c'est et comment ils assurent la sécurité, la transparence et l'automatisation des transactions financières. Le rendu doit être uniquement en HTML. Fais référence aux fichiers Solidity suivants : <ul>${solFiles}</ul>`;
        await generateContent(res, prompt);
    } catch (error) {
        console.error("Erreur lors de la génération du contenu des smart contracts:", error);
        res.status(500).send("Erreur lors de la génération du contenu.");
    }
});

router.get('/generate/etude-impact-economique', async (req, res) => {
    let contractState = { tresorerie: 0, nombreCitoyens: 0 };
    try {
        const response = await axios.get(`${SMART_CONTRACT_API_URL}/contract-state`);
        contractState = response.data;
    } catch (error) {
        console.error("Impossible de récupérer l'état du smart contract :", error.message);
    }

    const prompt = `
        Rédige une ébauche d'étude d'impact économique pour ce projet de loi en te basant sur le texte de loi et les objectifs suivants :
        - Le financement d'un revenu digne (entre 500€ et 5000€) via la valeur du CVNU et non le métier.
        - Le financement par la sociabilisation des recettes de la TVA s'inscrit dans un modèle d'économie circulaire.
        - Actuellement, la trésorerie de la caisse est de ${contractState.tresorerie}€ pour ${contractState.nombreCitoyens} bénéficiaires.

        Le rendu doit être uniquement en HTML et inclure des données fictives et les données réelles du smart contract si disponibles.
        
        Texte de référence : ${lawArticles}
        Plan de développement : ${detailedDevelopmentPlan}
    `;
    await generateContent(res, prompt);
});

module.exports = router;