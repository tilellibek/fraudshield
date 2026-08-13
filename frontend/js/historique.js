document.addEventListener("DOMContentLoaded", () => {
    const corpsHistorique = document.getElementById(
        "corps-historique"
    );
    const historiqueVide = document.getElementById(
        "historique-vide"
    );
    const recherche = document.getElementById(
        "recherche-historique"
    );
    const filtreType = document.getElementById("filtre-type");
    const detailAnalyse = document.getElementById("detail-analyse");
    const corpsDetail = document.getElementById("corps-detail");
    const notification = document.getElementById("notification");

    let analyses = [];

    function formaterNombre(valeur) {
        return new Intl.NumberFormat("fr-FR").format(
            Number(valeur) || 0
        );
    }

    function formaterDate(valeur) {
        const date = new Date(valeur);

        if (Number.isNaN(date.getTime())) {
            return valeur || "—";
        }

        return new Intl.DateTimeFormat("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
        }).format(date);
    }

    function creerCellule(texte) {
        const cellule = document.createElement("td");
        cellule.textContent = texte;
        return cellule;
    }

    function afficherNotification(message) {
        notification.textContent = message;
        notification.className = "notification visible erreur";
    }

    function afficherAnalyses() {
        const terme = recherche.value.trim().toLowerCase();
        const type = filtreType.value;

        const analysesFiltrees = analyses.filter((analyse) => {
            const nom = (
                analyse.nom_fichier || "analyse individuelle"
            ).toLowerCase();

            const typeCorrespond = (
                type === "tous" ||
                analyse.type_analyse === type
            );

            return typeCorrespond && nom.includes(terme);
        });

        corpsHistorique.replaceChildren();

        analysesFiltrees.forEach((analyse) => {
            const ligne = document.createElement("tr");

            ligne.appendChild(
                creerCellule(formaterDate(analyse.date_analyse))
            );

            const celluleType = document.createElement("td");
            const badgeType = document.createElement("span");
            badgeType.className = "badge-type";
            badgeType.textContent = analyse.type_analyse === "fichier"
                ? "CSV"
                : "Individuelle";
            celluleType.appendChild(badgeType);
            ligne.appendChild(celluleType);

            ligne.appendChild(
                creerCellule(analyse.nom_fichier || "—")
            );
            ligne.appendChild(
                creerCellule(
                    formaterNombre(analyse.total_transactions)
                )
            );

            const celluleFraudes = creerCellule(
                formaterNombre(analyse.total_fraudes)
            );
            celluleFraudes.className = "nombre-fraudes";
            ligne.appendChild(celluleFraudes);

            ligne.appendChild(
                creerCellule(
                    `${(Number(analyse.taux_fraude) * 100).toFixed(2)} %`
                )
            );

            const celluleAction = document.createElement("td");
            const bouton = document.createElement("button");
            bouton.type = "button";
            bouton.className = "bouton-ouvrir";
            bouton.dataset.analyseId = analyse.id;
            bouton.textContent = "Ouvrir";
            celluleAction.appendChild(bouton);
            ligne.appendChild(celluleAction);

            corpsHistorique.appendChild(ligne);
        });

        historiqueVide.textContent = analyses.length
            ? "Aucune analyse ne correspond aux filtres."
            : "Aucune analyse enregistrée.";

        historiqueVide.classList.toggle(
            "cache",
            analysesFiltrees.length > 0
        );
    }

    function niveauRisque(probabilite) {
        if (probabilite >= 0.9) {
            return { classe: "eleve", texte: "Élevé" };
        }

        if (probabilite >= 0.5) {
            return { classe: "moyen", texte: "Moyen" };
        }

        return { classe: "faible", texte: "Faible" };
    }

    function afficherDetail(analyse) {
        document.getElementById("titre-detail").textContent = (
            analyse.nom_fichier || "Analyse individuelle"
        );
        document.getElementById("detail-date").textContent = (
            formaterDate(analyse.date_analyse)
        );
        document.getElementById("detail-transactions").textContent = (
            formaterNombre(analyse.total_transactions)
        );
        document.getElementById("detail-fraudes").textContent = (
            formaterNombre(analyse.total_fraudes)
        );
        document.getElementById("detail-taux").textContent = `${(
            Number(analyse.taux_fraude) * 100
        ).toFixed(2)} %`;

        corpsDetail.replaceChildren();

        (analyse.transactions || []).forEach((transaction) => {
            const ligne = document.createElement("tr");
            const probabilite = Number(
                transaction.probabilite_fraude
            ) || 0;
            const risque = niveauRisque(probabilite);

            ligne.appendChild(
                creerCellule(transaction.numero_ligne ?? "—")
            );

            const celluleRisque = document.createElement("td");
            const badgeRisque = document.createElement("span");
            badgeRisque.className = (
                `badge-risque ${risque.classe}`
            );
            badgeRisque.textContent = risque.texte;
            celluleRisque.appendChild(badgeRisque);
            ligne.appendChild(celluleRisque);

            ligne.appendChild(
                creerCellule(`${(probabilite * 100).toFixed(2)} %`)
            );
            ligne.appendChild(
                creerCellule(transaction.log_amt ?? "—")
            );
            ligne.appendChild(
                creerCellule(transaction.category ?? "—")
            );
            ligne.appendChild(
                creerCellule(
                    transaction.hour === undefined
                        ? "—"
                        : `${transaction.hour} h`
                )
            );

            const celluleDecision = document.createElement("td");
            const badgeDecision = document.createElement("span");
            const estFraude = Number(transaction.prediction) === 1;
            badgeDecision.className = (
                `badge-decision ${estFraude ? "fraude" : "legitime"}`
            );
            badgeDecision.textContent = transaction.decision;
            celluleDecision.appendChild(badgeDecision);
            ligne.appendChild(celluleDecision);

            corpsDetail.appendChild(ligne);
        });

        detailAnalyse.classList.remove("cache");
        detailAnalyse.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    }

    async function ouvrirAnalyse(analyseId) {
        try {
            const reponse = await fetch(
                `${API_URL}/analyses/${analyseId}`,
                { credentials: "include" }
            );

            if (!reponse.ok) {
                throw new Error("Analyse introuvable.");
            }

            afficherDetail(await reponse.json());
        } catch (erreur) {
            afficherNotification(
                `Impossible d’ouvrir l’analyse : ${erreur.message}`
            );
        }
    }

    async function chargerHistorique() {
        try {
            const reponse = await fetch(`${API_URL}/analyses`, {
                credentials: "include",
            });

            if (!reponse.ok) {
                throw new Error("Historique indisponible.");
            }

            const donnees = await reponse.json();
            analyses = donnees.analyses || [];
            afficherAnalyses();
        } catch (erreur) {
            historiqueVide.textContent = (
                "Impossible de charger l’historique. " +
                "Vérifiez que FastAPI est démarré."
            );
            historiqueVide.classList.remove("cache");
        }
    }

    recherche.addEventListener("input", afficherAnalyses);
    filtreType.addEventListener("change", afficherAnalyses);

    corpsHistorique.addEventListener("click", (evenement) => {
        const bouton = evenement.target.closest("[data-analyse-id]");

        if (bouton) {
            ouvrirAnalyse(bouton.dataset.analyseId);
        }
    });

    document
        .getElementById("fermer-detail")
        .addEventListener("click", () => {
            detailAnalyse.classList.add("cache");
        });

    chargerHistorique();
});
