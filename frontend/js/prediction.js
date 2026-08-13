const formulaire = document.getElementById("formulaire-prediction");

const montant = document.getElementById("montant");
const age = document.getElementById("age");
const heure = document.getElementById("heure");
const jour = document.getElementById("jour");
const mois = document.getElementById("mois");
const distance = document.getElementById("distance");
const population = document.getElementById("population");
const categorie = document.getElementById("categorie");
const genre = document.getElementById("genre");

const estNuit = document.getElementById("est-nuit");
const estWeekend = document.getElementById("est-weekend");

const resultatVide = document.getElementById("resultat-vide");
const resultatAnalyse = document.getElementById("resultat-analyse");

const decisionResultat = document.getElementById("decision-resultat");
const etiquetteDecision = document.getElementById("etiquette-decision");
const probabiliteResultat = document.getElementById("probabilite-resultat");
const seuilResultat = document.getElementById("seuil-resultat");
const niveauResultat = document.getElementById("niveau-resultat");
const cercleProbabilite = document.getElementById("cercle-probabilite");
const progressionRisque = document.getElementById("progression-risque");
const listeFacteurs = document.getElementById("liste-facteurs");

const boutonAnalyser = document.getElementById("bouton-analyser");
const texteAnalyse = document.getElementById("texte-analyse");
const chargement = document.getElementById("chargement");
const notification = document.getElementById("notification");

let minuteurNotification;

/* Mise à jour automatique des indicateurs temporels */

function actualiserIndicateursTemporels() {
    const valeurHeure = Number(heure.value);
    const valeurJour = Number(jour.value);

    estNuit.checked =
        heure.value !== "" &&
        valeurHeure >= 0 &&
        valeurHeure <= 5;

    estWeekend.checked =
        jour.value !== "" &&
        (valeurJour === 5 || valeurJour === 6);
}

heure.addEventListener("input", actualiserIndicateursTemporels);
jour.addEventListener("change", actualiserIndicateursTemporels);

/* Notification */

function afficherNotification(message, type = "succes") {
    clearTimeout(minuteurNotification);

    notification.textContent = message;
    notification.classList.remove("erreur", "visible");

    if (type === "erreur") {
        notification.classList.add("erreur");
    }

    notification.classList.add("visible");

    minuteurNotification = setTimeout(() => {
        notification.classList.remove("visible");
    }, 4000);
}

/* Exemples préremplis */

document
    .getElementById("exemple-legitime")
    .addEventListener("click", () => {
        montant.value = 42.50;
        age.value = 38;
        heure.value = 14;
        jour.value = "2";
        mois.value = "6";
        distance.value = 4.20;
        population.value = 75000;
        categorie.value = "food_dining";
        genre.value = "F";

        actualiserIndicateursTemporels();
        afficherNotification("Exemple légitime chargé.");
    });

document
    .getElementById("exemple-fraude")
    .addEventListener("click", () => {
        montant.value = 895.90;
        age.value = 24;
        heure.value = 2;
        jour.value = "6";
        mois.value = "12";
        distance.value = 420.75;
        population.value = 1800;
        categorie.value = "shopping_net";
        genre.value = "M";

        actualiserIndicateursTemporels();
        afficherNotification("Exemple à risque chargé.");
    });

/* Construction des données envoyées à FastAPI */

function construireDonnees() {
    return {
        log_amt: Math.log1p(Number(montant.value)),
        age: Number(age.value),
        hour: Number(heure.value),
        day_of_week: Number(jour.value),
        month: Number(mois.value),
        is_weekend: estWeekend.checked ? 1 : 0,
        is_night: estNuit.checked ? 1 : 0,
        distance_km: Number(distance.value),
        log_city_pop: Math.log1p(Number(population.value)),
        category: categorie.value,
        gender: genre.value
    };
}

/* Facteurs indicatifs */

function determinerFacteurs(donnees) {
    const facteurs = [];

    if (Number(montant.value) >= 500) {
        facteurs.push("Montant de transaction particulièrement élevé.");
    }

    if (donnees.is_night === 1) {
        facteurs.push("Transaction effectuée pendant la nuit.");
    }

    if (donnees.is_weekend === 1) {
        facteurs.push("Transaction effectuée pendant le week-end.");
    }

    if (donnees.distance_km >= 100) {
        facteurs.push("Distance importante entre le client et le commerçant.");
    }

    if (
        donnees.category === "shopping_net" ||
        donnees.category === "misc_net" ||
        donnees.category === "grocery_net"
    ) {
        facteurs.push("Transaction réalisée dans une catégorie en ligne.");
    }

    if (Number(population.value) < 5000) {
        facteurs.push("Transaction associée à une ville faiblement peuplée.");
    }

    if (facteurs.length === 0) {
        facteurs.push(
            "Aucun facteur de risque simple n’a été relevé dans les données saisies."
        );
    }

    return facteurs;
}

/* Affichage du résultat */

function afficherResultat(resultat, donnees) {
    const probabilite = Number(resultat.probabilite_fraude);
    const seuilClassification = Number(resultat.seuil);

    const pourcentage = Math.min(
        Math.max(probabilite * 100, 0),
        100
    );

    const seuilPourcentage = seuilClassification * 100;
    const estFraude = Number(resultat.prediction) === 1;

    let niveau = "Faible";
    let couleur = "#22c55e";

    if (pourcentage >= 70) {
        niveau = "Élevé";
        couleur = "#ef4444";
    } else if (pourcentage >= 30) {
        niveau = "Modéré";
        couleur = "#f59e0b";
    }

    resultatVide.classList.add("cache");
    resultatAnalyse.classList.remove("cache");

    decisionResultat.textContent = estFraude
        ? "Transaction suspecte"
        : "Transaction légitime";

    etiquetteDecision.textContent = resultat.decision;
    etiquetteDecision.className =
        `etiquette-decision ${estFraude ? "fraude" : "legitime"}`;

    probabiliteResultat.textContent =
        `${pourcentage.toFixed(2)} %`;

    seuilResultat.textContent =
        `${seuilPourcentage.toFixed(2)} %`;

    niveauResultat.textContent = niveau;
    niveauResultat.style.color = couleur;

    progressionRisque.style.width = `${pourcentage}%`;

    cercleProbabilite.style.background = `
        conic-gradient(
            ${couleur} 0%,
            ${couleur} ${pourcentage}%,
            #253149 ${pourcentage}%,
            #253149 100%
        )
    `;

    const facteurs = determinerFacteurs(donnees);

    listeFacteurs.innerHTML = facteurs
        .map((facteur) => `<li>${facteur}</li>`)
        .join("");

    resultatAnalyse.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

/* Enregistrement local dans l’historique */

function enregistrerHistorique(resultat, donnees) {
    const historique = JSON.parse(
        localStorage.getItem("historiqueFraudShield") || "[]"
    );

    historique.unshift({
        id: Date.now(),
        date: new Date().toISOString(),
        montant: Number(montant.value),
        population: Number(population.value),
        donnees,
        probabilite_fraude: Number(resultat.probabilite_fraude),
        seuil: Number(resultat.seuil),
        prediction: Number(resultat.prediction),
        decision: resultat.decision
    });

    localStorage.setItem(
        "historiqueFraudShield",
        JSON.stringify(historique.slice(0, 100))
    );
}

/* Envoi vers l’API */

formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();

    if (!formulaire.checkValidity()) {
        formulaire.reportValidity();
        return;
    }

    if (
        Number(montant.value) < 0 ||
        Number(population.value) < 1
    ) {
        afficherNotification(
            "Vérifiez le montant et la population.",
            "erreur"
        );
        return;
    }

    const donnees = construireDonnees();

    boutonAnalyser.disabled = true;
    texteAnalyse.textContent = "Analyse en cours";
    chargement.classList.remove("cache");

    try {
        const reponse = await fetch(`${API_URL}/predict`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(donnees)
        });

        const resultat = await reponse.json();

        if (!reponse.ok) {
            let message = "La prédiction a échoué.";

            if (typeof resultat.detail === "string") {
                message = resultat.detail;
            } else if (Array.isArray(resultat.detail)) {
                message = resultat.detail
                    .map((erreur) => erreur.msg)
                    .join(" ");
            }

            throw new Error(message);
        }

        afficherResultat(resultat, donnees);
        enregistrerHistorique(resultat, donnees);

        afficherNotification(
            `Analyse terminée : ${resultat.decision}.`
        );
    } catch (erreur) {
        console.error(erreur);

        afficherNotification(
            `Impossible de contacter l’API : ${erreur.message}`,
            "erreur"
        );
    } finally {
        boutonAnalyser.disabled = false;
        texteAnalyse.textContent = "Analyser la transaction";
        chargement.classList.add("cache");
    }
});

/* Réinitialisation */

formulaire.addEventListener("reset", () => {
    setTimeout(() => {
        estNuit.checked = false;
        estWeekend.checked = false;

        resultatAnalyse.classList.add("cache");
        resultatVide.classList.remove("cache");
    }, 0);
});

document
    .getElementById("bouton-nouvelle-analyse")
    .addEventListener("click", () => {
        formulaire.reset();
        formulaire.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });

document
    .getElementById("bouton-imprimer")
    .addEventListener("click", () => {
        window.print();
    });
