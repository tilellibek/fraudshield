document.addEventListener("DOMContentLoaded", () => {
    const zoneDepot = document.getElementById("zone-depot");
    const champFichier = document.getElementById("fichier-csv");
    const boutonSelectionner = document.getElementById(
        "bouton-selectionner"
    );
    const fichierSelectionne = document.getElementById(
        "fichier-selectionne"
    );
    const nomFichier = document.getElementById("nom-fichier");
    const tailleFichier = document.getElementById("taille-fichier");
    const boutonSupprimer = document.getElementById(
        "bouton-supprimer-fichier"
    );
    const boutonAnalyser = document.getElementById(
        "bouton-analyser-fichier"
    );
    const texteAnalyse = document.getElementById(
        "texte-analyse-fichier"
    );
    const chargement = document.getElementById("chargement-fichier");
    const boutonModele = document.getElementById(
        "bouton-modele-csv"
    );
    const resultatVide = document.getElementById(
        "resultat-fichier-vide"
    );
    const resumeFichier = document.getElementById("resume-fichier");
    const totalTransactions = document.getElementById(
        "total-transactions"
    );
    const totalLegitimes = document.getElementById(
        "total-legitimes"
    );
    const totalFraudes = document.getElementById("total-fraudes");
    const tauxFraude = document.getElementById("taux-fraude");
    const boutonTelecharger = document.getElementById(
        "bouton-telecharger-resultats"
    );
    const notification = document.getElementById("notification");
    const tableauResultats = document.getElementById(
        "tableau-resultats"
    );
    const corpsTableau = document.getElementById(
        "corps-tableau-resultats"
    );
    const filtreRisque = document.getElementById("filtre-risque");
    const aucunResultatTableau = document.getElementById(
        "aucun-resultat-tableau"
    );

    const URL_API = (
        typeof API_URL !== "undefined"
            ? API_URL
            : "http://127.0.0.1:8000"
    ).replace(/\/$/, "");

    const COLONNES = [
        "log_amt",
        "age",
        "hour",
        "day_of_week",
        "month",
        "is_weekend",
        "is_night",
        "distance_km",
        "log_city_pop",
        "category",
        "gender",
    ];

    let fichierActuel = null;
    let resultatsActuels = [];

    function obtenirProbabilite(resultat) {
        const valeur =
            resultat.probabilite_fraude ??
            resultat.probability ??
            resultat.probabilite ??
            0;

        const probabilite = Number(valeur);
        return Number.isFinite(probabilite) ? probabilite : 0;
    }

    function obtenirNiveauRisque(probabilite) {
        if (probabilite >= 0.9) {
            return { code: "eleve", libelle: "Élevé" };
        }

        if (probabilite >= 0.5) {
            return { code: "moyen", libelle: "Moyen" };
        }

        return { code: "faible", libelle: "Faible" };
    }

    function obtenirDecision(resultat) {
        const prediction = Number(resultat.prediction ?? 0);
        const libelle = resultat.decision || (
            prediction === 1 ? "Fraude" : "Légitime"
        );

        return {
            libelle,
            classe: prediction === 1
                ? "decision-fraude"
                : "decision-legitime",
        };
    }

    function creerCellule(texte) {
        const cellule = document.createElement("td");
        cellule.textContent = texte;
        return cellule;
    }

    function afficherTableau() {
        const filtre = filtreRisque.value;

        const resultatsTries = [...resultatsActuels]
            .sort(
                (a, b) =>
                    obtenirProbabilite(b) - obtenirProbabilite(a)
            )
            .filter((resultat) => {
                if (filtre === "tous") {
                    return true;
                }

                return obtenirNiveauRisque(
                    obtenirProbabilite(resultat)
                ).code === filtre;
            });

        corpsTableau.replaceChildren();

        resultatsTries.forEach((resultat, index) => {
            const ligne = document.createElement("tr");
            const probabilite = obtenirProbabilite(resultat);
            const risque = obtenirNiveauRisque(probabilite);
            const decision = obtenirDecision(resultat);

            ligne.appendChild(creerCellule(index + 1));

            const celluleRisque = document.createElement("td");
            const badgeRisque = document.createElement("span");
            badgeRisque.className =
                `badge-risque risque-${risque.code}`;
            badgeRisque.textContent = risque.libelle;
            celluleRisque.appendChild(badgeRisque);
            ligne.appendChild(celluleRisque);

            ligne.appendChild(
                creerCellule(`${(probabilite * 100).toFixed(2)} %`)
            );
            ligne.appendChild(creerCellule(resultat.log_amt ?? "—"));
            ligne.appendChild(creerCellule(resultat.category ?? "—"));
            ligne.appendChild(
                creerCellule(
                    resultat.hour === undefined
                        ? "—"
                        : `${resultat.hour} h`
                )
            );

            const celluleDecision = document.createElement("td");
            const badgeDecision = document.createElement("span");
            badgeDecision.className =
                `badge-decision ${decision.classe}`;
            badgeDecision.textContent = decision.libelle;
            celluleDecision.appendChild(badgeDecision);
            ligne.appendChild(celluleDecision);

            corpsTableau.appendChild(ligne);
        });

        aucunResultatTableau.classList.toggle(
            "cache",
            resultatsTries.length > 0
        );
    }

    function afficherNotification(message, type = "succes") {
        if (!notification) {
            alert(message);
            return;
        }

        notification.textContent = message;
        notification.className = `notification visible ${type}`;

        window.setTimeout(() => {
            notification.className = "notification";
        }, 4000);
    }

    function formaterTaille(nombreOctets) {
        if (nombreOctets < 1024) {
            return `${nombreOctets} octets`;
        }

        if (nombreOctets < 1024 * 1024) {
            return `${(nombreOctets / 1024).toFixed(1)} Ko`;
        }

        return `${(
            nombreOctets /
            (1024 * 1024)
        ).toFixed(1)} Mo`;
    }

    function selectionnerFichier(fichier) {
        if (!fichier) {
            return;
        }

        if (!fichier.name.toLowerCase().endsWith(".csv")) {
            afficherNotification(
                "Veuillez sélectionner un fichier CSV.",
                "erreur"
            );
            return;
        }

        const tailleMaximale = 20 * 1024 * 1024;

        if (fichier.size > tailleMaximale) {
            afficherNotification(
                "Le fichier dépasse la taille maximale de 20 Mo.",
                "erreur"
            );
            return;
        }

        fichierActuel = fichier;
        nomFichier.textContent = fichier.name;
        tailleFichier.textContent = formaterTaille(fichier.size);

        fichierSelectionne.classList.remove("cache");
        boutonAnalyser.disabled = false;

        resultatVide.classList.remove("cache");
        resumeFichier.classList.add("cache");
        tableauResultats.classList.add("cache");
        filtreRisque.value = "tous";

        resultatsActuels = [];
    }

    function supprimerFichier() {
        fichierActuel = null;
        resultatsActuels = [];

        champFichier.value = "";
        nomFichier.textContent = "—";
        tailleFichier.textContent = "—";

        fichierSelectionne.classList.add("cache");
        boutonAnalyser.disabled = true;

        resumeFichier.classList.add("cache");
        resultatVide.classList.remove("cache");
        tableauResultats.classList.add("cache");
        filtreRisque.value = "tous";
    }

    function activerChargement(actif) {
        boutonAnalyser.disabled = actif || !fichierActuel;
        texteAnalyse.textContent = actif
            ? "Analyse en cours..."
            : "Analyser le fichier";

        chargement.classList.toggle("cache", !actif);
    }

    function echapperCSV(valeur) {
        if (valeur === null || valeur === undefined) {
            return "";
        }

        const texte = String(valeur);

        if (
            texte.includes(",") ||
            texte.includes('"') ||
            texte.includes("\n")
        ) {
            return `"${texte.replace(/"/g, '""')}"`;
        }

        return texte;
    }

    function telechargerTexte(contenu, nom, type) {
        const blob = new Blob(["\uFEFF", contenu], { type });
        const url = URL.createObjectURL(blob);
        const lien = document.createElement("a");

        lien.href = url;
        lien.download = nom;

        document.body.appendChild(lien);
        lien.click();
        lien.remove();

        URL.revokeObjectURL(url);
    }

    function telechargerModeleCSV() {
        const exemple = [
            4.25,
            35,
            14,
            2,
            8,
            0,
            0,
            12.5,
            10.82,
            "grocery_pos",
            "F",
        ];

        const contenu = [
            COLONNES.join(","),
            exemple.join(","),
        ].join("\n");

        telechargerTexte(
            contenu,
            "modele_transactions.csv",
            "text/csv;charset=utf-8"
        );

        afficherNotification("Le modèle CSV a été téléchargé.");
    }

    function convertirResultatsEnCSV(resultats) {
        if (!resultats.length) {
            return "";
        }

        const colonnes = Object.keys(resultats[0]);

        const lignes = resultats.map((resultat) =>
            colonnes
                .map((colonne) => echapperCSV(resultat[colonne]))
                .join(",")
        );

        return [
            colonnes.join(","),
            ...lignes,
        ].join("\n");
    }

    async function analyserFichier() {
        if (!fichierActuel) {
            afficherNotification(
                "Sélectionnez d’abord un fichier CSV.",
                "erreur"
            );
            return;
        }

        const formulaire = new FormData();
        formulaire.append("fichier", fichierActuel);

        activerChargement(true);

        try {
            const reponse = await fetch(
                `${URL_API}/predict-file`,
                {
                    method: "POST",
                    credentials: "include",
                    body: formulaire,
                }
            );

            let donnees;

            try {
                donnees = await reponse.json();
            } catch {
                throw new Error(
                    "La réponse reçue de l’API est invalide."
                );
            }

            if (!reponse.ok) {
                throw new Error(
                    donnees.detail ||
                    "Impossible d’analyser le fichier."
                );
            }

            resultatsActuels = donnees.resultats || [];

            totalTransactions.textContent =
                donnees.total_transactions;

            totalLegitimes.textContent =
                donnees.total_legitimes;

            totalFraudes.textContent =
                donnees.total_fraudes;

            tauxFraude.textContent = `${(
                donnees.taux_fraude * 100
            ).toFixed(2)} %`;

            resultatVide.classList.add("cache");
            resumeFichier.classList.remove("cache");
            tableauResultats.classList.remove("cache");
            filtreRisque.value = "tous";
            afficherTableau();

            afficherNotification(
                "Le fichier a été analysé avec succès."
            );
        } catch (erreur) {
            console.error(erreur);

            afficherNotification(
                erreur.message.includes("Failed to fetch")
                    ? "Connexion à l’API impossible. Vérifiez que le serveur est démarré."
                    : erreur.message,
                "erreur"
            );
        } finally {
            activerChargement(false);
        }
    }

    function telechargerResultats() {
        if (!resultatsActuels.length) {
            afficherNotification(
                "Aucun résultat à télécharger.",
                "erreur"
            );
            return;
        }

        const contenu = convertirResultatsEnCSV(
            resultatsActuels
        );

        telechargerTexte(
            contenu,
            "resultats_analyse_fraude.csv",
            "text/csv;charset=utf-8"
        );

        afficherNotification(
            "Les résultats ont été téléchargés."
        );
    }

    zoneDepot.addEventListener("click", () => {
        champFichier.click();
    });

    zoneDepot.addEventListener("keydown", (evenement) => {
        if (
            evenement.key === "Enter" ||
            evenement.key === " "
        ) {
            evenement.preventDefault();
            champFichier.click();
        }
    });

    boutonSelectionner.addEventListener("click", (evenement) => {
        evenement.stopPropagation();
        champFichier.click();
    });

    champFichier.addEventListener("change", () => {
        selectionnerFichier(champFichier.files[0]);
    });

    boutonSupprimer.addEventListener("click", supprimerFichier);
    boutonAnalyser.addEventListener("click", analyserFichier);
    boutonModele.addEventListener("click", telechargerModeleCSV);
    boutonTelecharger.addEventListener(
        "click",
        telechargerResultats
    );
    filtreRisque.addEventListener("change", afficherTableau);

    ["dragenter", "dragover"].forEach((typeEvenement) => {
        zoneDepot.addEventListener(typeEvenement, (evenement) => {
            evenement.preventDefault();
            zoneDepot.classList.add("glisser");
        });
    });

    ["dragleave", "drop"].forEach((typeEvenement) => {
        zoneDepot.addEventListener(typeEvenement, (evenement) => {
            evenement.preventDefault();
            zoneDepot.classList.remove("glisser");
        });
    });

    zoneDepot.addEventListener("drop", (evenement) => {
        const fichier = evenement.dataTransfer.files[0];
        selectionnerFichier(fichier);
    });
});
