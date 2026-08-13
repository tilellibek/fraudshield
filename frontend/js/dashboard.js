document.addEventListener("DOMContentLoaded", () => {
    const totalAnalyses = document.getElementById(
        "total-analyses"
    );
    const totalTransactions = document.getElementById(
        "total-transactions-dashboard"
    );
    const totalFraudes = document.getElementById(
        "total-fraudes-dashboard"
    );
    const tauxFraude = document.getElementById(
        "taux-fraude-dashboard"
    );
    const nombreLegitimes = document.getElementById(
        "nombre-legitimes"
    );
    const nombreFraudes = document.getElementById(
        "nombre-fraudes"
    );
    const barreLegitimes = document.getElementById(
        "barre-legitimes"
    );
    const barreFraudes = document.getElementById(
        "barre-fraudes"
    );
    const listeAnalyses = document.getElementById(
        "liste-analyses-dashboard"
    );
    const dashboardVide = document.getElementById(
        "dashboard-vide"
    );
    const notification = document.getElementById("notification");
    const repartitionVide = document.getElementById(
        "repartition-vide"
    );
    const analysesVides = document.getElementById(
        "analyses-vides"
    );

    let graphiqueRepartition = null;
    let graphiqueAnalyses = null;

    function formaterNombre(valeur) {
        return new Intl.NumberFormat("fr-FR").format(
            Number(valeur) || 0
        );
    }

    function formaterDate(valeur) {
        const date = new Date(valeur);

        if (Number.isNaN(date.getTime())) {
            return valeur || "Date inconnue";
        }

        return new Intl.DateTimeFormat("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
        }).format(date);
    }

    function creerAnalyseRecente(analyse) {
        const element = document.createElement("div");
        element.className = "analyse-recente";

        const informations = document.createElement("div");
        const titre = document.createElement("strong");
        const details = document.createElement("span");

        titre.textContent = analyse.nom_fichier || (
            analyse.type_analyse === "individuelle"
                ? "Analyse individuelle"
                : "Analyse sans nom"
        );

        const type = analyse.type_analyse === "fichier"
            ? "Fichier CSV"
            : "Transaction individuelle";

        details.textContent = [
            type,
            formaterDate(analyse.date_analyse),
            `${formaterNombre(analyse.total_transactions)} transaction(s)`,
        ].join(" · ");

        informations.append(titre, details);

        const resume = document.createElement("div");
        resume.className = "resume-analyse";

        const fraudes = document.createElement("strong");
        const taux = document.createElement("span");

        fraudes.textContent = `${formaterNombre(
            analyse.total_fraudes
        )} fraude(s)`;

        taux.textContent = `${(
            Number(analyse.taux_fraude) * 100
        ).toFixed(2)} %`;

        resume.append(fraudes, taux);
        element.append(informations, resume);

        return element;
    }

    function optionsCommunesGraphiques() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: "#cbd5e1",
                        usePointStyle: true,
                        padding: 18,
                    },
                },
                tooltip: {
                    backgroundColor: "#0d1424",
                    borderColor: "#26334a",
                    borderWidth: 1,
                    titleColor: "#f1f5f9",
                    bodyColor: "#cbd5e1",
                },
            },
        };
    }

    function afficherGraphiques(donnees) {
        if (typeof Chart === "undefined") {
            throw new Error("La bibliothèque de graphiques est indisponible.");
        }

        const legitimes = Number(donnees.total_legitimes) || 0;
        const fraudes = Number(donnees.total_fraudes) || 0;
        const analyses = donnees.dernieres_analyses || [];
        const totalTransactions = legitimes + fraudes;

        repartitionVide.classList.toggle(
            "cache",
            totalTransactions > 0
        );
        document.getElementById(
            "graphique-repartition"
        ).classList.toggle("cache", totalTransactions === 0);

        if (totalTransactions > 0) {
            graphiqueRepartition?.destroy();
            graphiqueRepartition = new Chart(
                document.getElementById("graphique-repartition"),
                {
                    type: "doughnut",
                    data: {
                        labels: ["Légitimes", "Fraudes"],
                        datasets: [{
                            data: [legitimes, fraudes],
                            backgroundColor: ["#22c55e", "#ef4444"],
                            borderColor: "#111a2e",
                            borderWidth: 4,
                            hoverOffset: 6,
                        }],
                    },
                    options: {
                        ...optionsCommunesGraphiques(),
                        cutout: "68%",
                    },
                }
            );
        }

        analysesVides.classList.toggle("cache", analyses.length > 0);
        document.getElementById(
            "graphique-analyses"
        ).classList.toggle("cache", analyses.length === 0);

        if (analyses.length > 0) {
            const analysesChronologiques = [...analyses].reverse();

            graphiqueAnalyses?.destroy();
            graphiqueAnalyses = new Chart(
                document.getElementById("graphique-analyses"),
                {
                    type: "bar",
                    data: {
                        labels: analysesChronologiques.map(
                            (analyse) => analyse.nom_fichier ||
                                `Analyse #${analyse.id}`
                        ),
                        datasets: [{
                            label: "Fraudes détectées",
                            data: analysesChronologiques.map(
                                (analyse) => analyse.total_fraudes
                            ),
                            backgroundColor: "rgba(239, 68, 68, 0.72)",
                            borderColor: "#ef4444",
                            borderWidth: 1,
                            borderRadius: 7,
                            maxBarThickness: 55,
                        }],
                    },
                    options: {
                        ...optionsCommunesGraphiques(),
                        scales: {
                            x: {
                                ticks: {
                                    color: "#94a3b8",
                                    maxRotation: 25,
                                    minRotation: 0,
                                },
                                grid: { display: false },
                            },
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: "#94a3b8",
                                    precision: 0,
                                },
                                grid: {
                                    color: "rgba(148, 163, 184, 0.12)",
                                },
                            },
                        },
                    },
                }
            );
        }
    }

    function afficherDashboard(donnees) {
        const transactions = Number(
            donnees.total_transactions
        ) || 0;
        const legitimes = Number(
            donnees.total_legitimes
        ) || 0;
        const fraudes = Number(
            donnees.total_fraudes
        ) || 0;

        totalAnalyses.textContent = formaterNombre(
            donnees.total_analyses
        );
        totalTransactions.textContent = formaterNombre(transactions);
        totalFraudes.textContent = formaterNombre(fraudes);
        tauxFraude.textContent = `${(
            Number(donnees.taux_fraude) * 100
        ).toFixed(2)} %`;

        nombreLegitimes.textContent = formaterNombre(legitimes);
        nombreFraudes.textContent = formaterNombre(fraudes);

        const pourcentageLegitimes = transactions
            ? (legitimes / transactions) * 100
            : 0;
        const pourcentageFraudes = transactions
            ? (fraudes / transactions) * 100
            : 0;

        barreLegitimes.style.width = `${pourcentageLegitimes}%`;
        barreFraudes.style.width = `${pourcentageFraudes}%`;

        const analyses = donnees.dernieres_analyses || [];
        listeAnalyses.replaceChildren();

        analyses.forEach((analyse) => {
            listeAnalyses.appendChild(
                creerAnalyseRecente(analyse)
            );
        });

        dashboardVide.classList.toggle(
            "cache",
            analyses.length > 0
        );

        afficherGraphiques(donnees);
    }

    async function chargerDashboard() {
        try {
            const reponse = await fetch(`${API_URL}/dashboard`, {
                credentials: "include",
            });

            if (!reponse.ok) {
                throw new Error(
                    "Le tableau de bord est indisponible."
                );
            }

            const donnees = await reponse.json();
            afficherDashboard(donnees);
        } catch (erreur) {
            notification.textContent = (
                "Impossible de charger le tableau de bord. " +
                "Vérifiez que FastAPI est démarré."
            );
            notification.className = (
                "notification visible erreur"
            );

            console.error(erreur);
        }
    }

    chargerDashboard();
});
