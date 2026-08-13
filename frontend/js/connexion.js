const API_URL = "https://fraudshield-2srp.onrender.com";
const formulaire = document.getElementById("formulaire-connexion");
const bouton = document.getElementById("bouton-connexion");
const message = document.getElementById("message-connexion");

async function sessionExistante() {
    try {
        const reponse = await fetch(`${API_URL}/utilisateur-actuel`, {
            credentials: "include",
        });
        if (reponse.ok) window.location.replace("dashboard.html");
    } catch { /* L’utilisateur peut quand même tenter de se connecter. */ }
}

formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    bouton.disabled = true;
    bouton.textContent = "Connexion en cours...";
    message.classList.add("cache");
    try {
        const reponse = await fetch(`${API_URL}/connexion`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                identifiant: document.getElementById("identifiant").value.trim(),
                mot_de_passe: document.getElementById("mot-de-passe").value,
            }),
        });
        const resultat = await reponse.json();
        if (!reponse.ok) throw new Error(resultat.detail || "Connexion impossible.");
        window.location.replace("dashboard.html");
    } catch (erreur) {
        message.textContent = erreur.message === "Failed to fetch"
            ? "Impossible de contacter l’API. Vérifiez que FastAPI est démarré."
            : erreur.message;
        message.classList.remove("cache");
    } finally {
        bouton.disabled = false;
        bouton.textContent = "Se connecter";
    }
});

sessionExistante();
