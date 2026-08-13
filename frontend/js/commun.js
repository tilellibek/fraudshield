const API_URL = "http://127.0.0.1:8000";

const sidebar = document.getElementById("sidebar");
const boutonMenu = document.getElementById("bouton-menu");
const fondMenu = document.getElementById("fond-menu");

async function verifierSession() {
    if (window.location.pathname.endsWith("connexion.html")) return;

    try {
        const reponse = await fetch(`${API_URL}/utilisateur-actuel`, {
            credentials: "include",
        });

        if (reponse.status === 401) {
            window.location.replace("connexion.html");
            return;
        }

        if (!reponse.ok) throw new Error("Session indisponible");

        const donnees = await reponse.json();
        const utilisateur = donnees.utilisateur;
        document.querySelectorAll(".profil-texte strong").forEach(
            (element) => { element.textContent = utilisateur.nom; }
        );

        if (utilisateur.role === "administrateur") {
            document.querySelectorAll(".navigation").forEach((navigation) => {
                if (!navigation.querySelector(".lien-administration")) {
                    const lien = document.createElement("a");
                    lien.href = "utilisateurs.html";
                    lien.className = "lien-navigation lien-administration";
                    lien.innerHTML = '<span class="icone-navigation">♙</span><span>Utilisateurs</span>';
                    const apropos = [...navigation.querySelectorAll("a")].find(
                        (element) => element.getAttribute("href") === "apropos.html"
                    );
                    navigation.insertBefore(lien, apropos || null);
                }
            });
        } else {
            document.querySelectorAll(".lien-administration").forEach(
                (element) => element.remove()
            );
            if (window.location.pathname.endsWith("utilisateurs.html")) {
                window.location.replace("dashboard.html");
                return;
            }
        }

        const profil = document.querySelector(".profil");
        if (profil && !document.getElementById("bouton-deconnexion")) {
            const bouton = document.createElement("button");
            bouton.id = "bouton-deconnexion";
            bouton.type = "button";
            bouton.textContent = "Déconnexion";
            bouton.style.cssText = "padding:8px 11px;border:1px solid #26334a;border-radius:8px;background:#111a2e;color:#f1f5f9;cursor:pointer";
            bouton.addEventListener("click", async () => {
                await fetch(`${API_URL}/deconnexion`, {
                    method: "POST",
                    credentials: "include",
                });
                window.location.replace("connexion.html");
            });
            profil.prepend(bouton);
        }
    } catch {
        window.location.replace("connexion.html");
    }
}

function ouvrirFermerMenu() {
    sidebar?.classList.toggle("ouverte");
    fondMenu?.classList.toggle("visible");
}

boutonMenu?.addEventListener("click", ouvrirFermerMenu);
fondMenu?.addEventListener("click", ouvrirFermerMenu);

// Fermer le menu mobile après avoir sélectionné une page
document.querySelectorAll(".lien-navigation").forEach((lien) => {
    lien.addEventListener("click", () => {
        sidebar?.classList.remove("ouverte");
        fondMenu?.classList.remove("visible");
    });
});

// Vérifier automatiquement si l’API fonctionne
async function verifierAPI() {
    const statut = document.querySelector(".statut-systeme");

    if (!statut) return;

    const point = statut.querySelector(".point-statut");
    const titre = statut.querySelector("strong");
    const detail = statut.querySelector("small");

    try {
        const reponse = await fetch(`${API_URL}/health`);

        if (!reponse.ok) {
            throw new Error("API indisponible");
        }

        const donnees = await reponse.json();

        point.style.background = "#22c55e";
        point.style.boxShadow = "0 0 12px #22c55e";
        titre.textContent = "API opérationnelle";
        detail.textContent =
            `XGBoost chargé · seuil ${Math.round(donnees.seuil * 100)} %`;
    } catch (erreur) {
        point.style.background = "#ef4444";
        point.style.boxShadow = "0 0 12px #ef4444";
        titre.textContent = "API hors ligne";
        detail.textContent = "Démarrez le serveur FastAPI";
    }
}

verifierAPI();
verifierSession();
