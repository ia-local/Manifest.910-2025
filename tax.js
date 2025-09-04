const fs = require("fs");
const Groq = require("groq-sdk");
const groq = new Groq();

// Liste de citations prédéfinies

const IR = "Impôt sur le revenu"
const RSA = "Revenus salariaux et assimilés"
const RPPM = "Revenus et profits du patrimoine mobilier"
const RFPI= "Revenus fonciers et profits du patrimoine immobilier"
const BA = "Bénéfices agricoles"
const BNC = "Bénéfices non commerciaux"
const BIC = "Bénéfices industriels et commerciaux"
const IS = "Impôt sur les sociétés"
const TVA = "Taxe sur la valeur ajoutée"
const TCA = "Taxes sur le chiffre d'affaires";
const CVAE= "Cotisation sur la Valeur Ajoutée des Entreprises";
const TPS ="Taxes et participations sur les salaires";
const TFP ="Taxes sur les facteurs de production";
const AIS ="Autres impositions sectorielles";
const IF = "Impôts fonciers";
const PAT ="Impôts sur le patrimoine";
const ENR ="Enregistrement";
const TCAS="Taxe sur les conventions d'assurances et assimilées"
const REC ="Recouvrement";
const DAE ="Droit à l'erreur";
const CF = "Contrôle fiscal";
const CTX ="Contentieux";
const SJ = "Sécurité juridique";
const INT ="Fiscalité internationale";
const CAD ="Cadastre";
const DJC ="Dispositions juridiques communes";
const RES ="Rescrits";
const RIC = "réseau, Intelligent connecté"
const freeTax = `${IR}+${RSA}+${RPPM}+${RFPI}+${BA}+${BNC}+${BIC}+${IS}+${TVA}+${TCA}+${CVAE}+${TPS}+${TFP}+${AIS}+${IF}+${PAT}+${ENR}+${TCAS}+${REC}+${DAE}+${CF}+${CTX}+${SJ}+${INT}+${CAD}+${DJC}+${RIC}+${RES}`

const RSS = "upadate = 'groq --help FreeTax()'"


const CookieBot= `
+Traitements de données supplémentaires CGV > tvaCollector.sol async redistributingTVA.sol
1plusX AG fait partie du IAB Transparency and Consent Framework et est assujetti à des politiques. Vous pouvez en apprendre davantage sur ce partenaire et sur sa gestion de l'intérêt légitime en lisant sa Politique de confidentialité.
;`

async function main(
) {

    groq.chat.completions.create({
        messages:  [
            {role:"system",content:`${freeTax}+${RSS}`},
            {
                role: "assistant",
                content: `tu incarneras le rôle du ${CookieBot} au service de la commission nationale des comptes campagnes et des formations politiques en association avec les vigueur au service de la redistribution et de la collecte de la TVA.`
            },

        ],
        model: "gemma2-9b-it",
        temperature: 0.2,
        max_tokens: 2048,
        top_p: 1,
        stop: null,
        stream: false
}).then((chatCompletion) => {
        const mdContent = chatCompletion.choices[0]?.message?.content;
        const outputFilePath = "taxe_" + new Date().toISOString().replace(/[-:TZ]/g, "") + ".md";
        fs.writeFileSync(outputFilePath, mdContent);
        console.log("Documentation généré et enregistré dans " + outputFilePath);
    });
}

main();