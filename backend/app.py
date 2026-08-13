import json
import os
from io import BytesIO
from pathlib import Path

import joblib
import pandas as pd
from fastapi import (
    Cookie,
    Depends,
    FastAPI,
    File,
    HTTPException,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.database import (
    authentifier_utilisateur,
    creer_session,
    enregistrer_analyse,
    initialiser_base,
    creer_utilisateur,
    lister_utilisateurs,
    mettre_a_jour_alerte,
    obtenir_analyse_par_id,
    obtenir_analyses,
    obtenir_alertes,
    obtenir_statistiques_dashboard,
    obtenir_utilisateur_session,
    supprimer_session,
    modifier_activation_utilisateur,
)


# ============================================================
# CHEMINS DU PROJET
# ============================================================

RACINE = Path(__file__).resolve().parent.parent

FICHIER_MODELE = (
    RACINE
    / "modeles"
    / "pipeline_xgb_optimise.joblib"
)

FICHIER_SEUIL = (
    RACINE
    / "modeles"
    / "seuil_xgb_optimise.json"
)


# ============================================================
# CHARGEMENT DU MODÈLE ET DU SEUIL
# ============================================================

pipeline = joblib.load(FICHIER_MODELE)

with open(
    FICHIER_SEUIL,
    "r",
    encoding="utf-8",
) as fichier:
    seuil = float(
        json.load(fichier)["seuil_final"]
    )


# ============================================================
# VARIABLES ATTENDUES PAR LE MODÈLE
# ============================================================

COLONNES_ATTENDUES = [
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
]


# ============================================================
# MODÈLE DES DONNÉES D’UNE TRANSACTION
# ============================================================

class Transaction(BaseModel):
    log_amt: float

    age: int = Field(
        ge=0,
        le=120,
    )

    hour: int = Field(
        ge=0,
        le=23,
    )

    day_of_week: int = Field(
        ge=0,
        le=6,
    )

    month: int = Field(
        ge=1,
        le=12,
    )

    is_weekend: int = Field(
        ge=0,
        le=1,
    )

    is_night: int = Field(
        ge=0,
        le=1,
    )

    distance_km: float = Field(
        ge=0,
    )

    log_city_pop: float
    category: str
    gender: str


class TraitementAlerte(BaseModel):
    statut: str
    commentaire: str = Field(
        default="",
        max_length=1000,
    )


class ConnexionUtilisateur(BaseModel):
    identifiant: str = Field(min_length=1, max_length=100)
    mot_de_passe: str = Field(min_length=8, max_length=200)


class NouvelUtilisateur(BaseModel):
    identifiant: str = Field(
        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9._-]+$",
    )
    nom: str = Field(min_length=2, max_length=100)
    mot_de_passe: str = Field(min_length=12, max_length=200)
    role: str = "analyste"


class ActivationUtilisateur(BaseModel):
    actif: bool


# ============================================================
# CRÉATION DE L’APPLICATION FASTAPI
# ============================================================

app = FastAPI(
    title="API de détection de fraude",
    description=(
        "Prédiction de fraude avec le pipeline "
        "XGBoost optimisé"
    ),
    version="1.0.0",
)

initialiser_base()


# ============================================================
# AUTORISATION DU FRONTEND
# ============================================================

ORIGINES_FRONTEND = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
]

if os.getenv("FRONTEND_URL"):
    ORIGINES_FRONTEND.append(os.environ["FRONTEND_URL"].rstrip("/"))

MODE_PRODUCTION = os.getenv("ENVIRONMENT", "development").lower() == "production"

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINES_FRONTEND,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# PAGE D’ACCUEIL DE L’API
# ============================================================

@app.get("/")
def accueil():
    return {
        "message": "API de détection de fraude",
        "documentation": "/docs",
    }


# ============================================================
# VÉRIFICATION DE L’ÉTAT DE L’API
# ============================================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "modele_charge": True,
        "seuil": seuil,
    }


# ============================================================
# AUTHENTIFICATION
# ============================================================

NOM_COOKIE_SESSION = "fraudshield_session"


def exiger_utilisateur(
    jeton: str | None = Cookie(
        default=None,
        alias=NOM_COOKIE_SESSION,
    ),
):
    utilisateur = obtenir_utilisateur_session(jeton)

    if utilisateur is None:
        raise HTTPException(
            status_code=401,
            detail="Authentification requise.",
        )

    return utilisateur


def exiger_administrateur(
    utilisateur=Depends(exiger_utilisateur),
):
    if utilisateur["role"] != "administrateur":
        raise HTTPException(
            status_code=403,
            detail="Accès réservé à l’administrateur.",
        )

    return utilisateur


@app.post("/connexion")
def connexion(
    donnees: ConnexionUtilisateur,
    response: Response,
):
    utilisateur = authentifier_utilisateur(
        donnees.identifiant.strip(),
        donnees.mot_de_passe,
    )

    if utilisateur is None:
        raise HTTPException(
            status_code=401,
            detail="Identifiant ou mot de passe incorrect.",
        )

    jeton = creer_session(utilisateur["id"])
    response.set_cookie(
        key=NOM_COOKIE_SESSION,
        value=jeton,
        httponly=True,
        samesite="none" if MODE_PRODUCTION else "lax",
        secure=MODE_PRODUCTION,
        max_age=8 * 60 * 60,
        path="/",
    )

    return {"utilisateur": utilisateur}


@app.get("/utilisateur-actuel")
def utilisateur_actuel(
    utilisateur=Depends(exiger_utilisateur),
):
    return {"utilisateur": utilisateur}


@app.post("/deconnexion")
def deconnexion(
    response: Response,
    jeton: str | None = Cookie(
        default=None,
        alias=NOM_COOKIE_SESSION,
    ),
):
    supprimer_session(jeton)
    response.delete_cookie(
        key=NOM_COOKIE_SESSION,
        path="/",
    )
    return {"message": "Déconnexion réussie."}


# ============================================================
# GESTION DES UTILISATEURS
# ============================================================

ROLES_UTILISATEURS = {"analyste", "administrateur"}


@app.get("/utilisateurs")
def utilisateurs(
    administrateur=Depends(exiger_administrateur),
):
    return {"utilisateurs": lister_utilisateurs()}


@app.post("/utilisateurs", status_code=201)
def ajouter_utilisateur(
    donnees: NouvelUtilisateur,
    administrateur=Depends(exiger_administrateur),
):
    role = donnees.role.strip().lower()

    if role not in ROLES_UTILISATEURS:
        raise HTTPException(
            status_code=400,
            detail="Le rôle doit être analyste ou administrateur.",
        )

    utilisateur = creer_utilisateur(
        identifiant=donnees.identifiant.strip().lower(),
        nom=donnees.nom.strip(),
        mot_de_passe=donnees.mot_de_passe,
        role=role,
    )

    if utilisateur is None:
        raise HTTPException(
            status_code=409,
            detail="Cet identifiant existe déjà.",
        )

    return {"utilisateur": utilisateur}


@app.patch("/utilisateurs/{utilisateur_id}/activation")
def changer_activation_utilisateur(
    utilisateur_id: int,
    donnees: ActivationUtilisateur,
    administrateur=Depends(exiger_administrateur),
):
    if utilisateur_id == administrateur["id"] and not donnees.actif:
        raise HTTPException(
            status_code=400,
            detail="Vous ne pouvez pas désactiver votre propre compte.",
        )

    utilisateur = modifier_activation_utilisateur(
        utilisateur_id,
        donnees.actif,
    )

    if utilisateur is None:
        raise HTTPException(
            status_code=404,
            detail="Utilisateur introuvable.",
        )

    return {"utilisateur": utilisateur}


# ============================================================
# DONNÉES DU TABLEAU DE BORD
# ============================================================

@app.get("/dashboard")
def dashboard(utilisateur=Depends(exiger_utilisateur)):
    return obtenir_statistiques_dashboard()


# ============================================================
# HISTORIQUE DES ANALYSES
# ============================================================

@app.get("/analyses")
def analyses(utilisateur=Depends(exiger_utilisateur)):
    return {
        "analyses": obtenir_analyses(),
    }


@app.get("/analyses/{analyse_id}")
def detail_analyse(
    analyse_id: int,
    utilisateur=Depends(exiger_utilisateur),
):
    analyse = obtenir_analyse_par_id(analyse_id)

    if analyse is None:
        raise HTTPException(
            status_code=404,
            detail="Analyse introuvable.",
        )

    return analyse


# ============================================================
# GESTION DES ALERTES
# ============================================================

STATUTS_ALERTES = {
    "a_verifier",
    "en_cours",
    "fraude_confirmee",
    "legitime",
}


@app.get("/alertes")
def alertes(utilisateur=Depends(exiger_utilisateur)):
    return {
        "alertes": obtenir_alertes(),
    }


@app.put("/alertes/{transaction_id}")
def traiter_alerte(
    transaction_id: int,
    traitement: TraitementAlerte,
    utilisateur=Depends(exiger_utilisateur),
):
    if traitement.statut not in STATUTS_ALERTES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Statut invalide. Valeurs autorisées : "
                + ", ".join(sorted(STATUTS_ALERTES))
            ),
        )

    resultat = mettre_a_jour_alerte(
        transaction_id=transaction_id,
        statut=traitement.statut,
        commentaire=traitement.commentaire.strip(),
    )

    if resultat is None:
        raise HTTPException(
            status_code=404,
            detail="Alerte introuvable.",
        )

    return resultat


# ============================================================
# PRÉDICTION D’UNE TRANSACTION
# ============================================================

@app.post("/predict")
def predict(
    transaction: Transaction,
    utilisateur=Depends(exiger_utilisateur),
):
    try:
        donnees = pd.DataFrame(
            [transaction.model_dump()],
            columns=COLONNES_ATTENDUES,
        )

        probabilite = float(
            pipeline.predict_proba(donnees)[0, 1]
        )

        prediction = int(
            probabilite >= seuil
        )

        decision = (
            "Fraude"
            if prediction == 1
            else "Légitime"
        )

        analyse_id = enregistrer_analyse(
            type_analyse="individuelle",
            nom_fichier=None,
            resultats=[{
                **transaction.model_dump(),
                "probabilite_fraude": round(
                    probabilite,
                    6,
                ),
                "prediction": prediction,
                "decision": decision,
            }],
        )

        return {
            "probabilite_fraude": round(
                probabilite,
                6,
            ),
            "seuil": seuil,
            "prediction": prediction,
            "decision": decision,
            "analyse_id": analyse_id,
        }

    except Exception as erreur:
        raise HTTPException(
            status_code=500,
            detail=(
                "Erreur pendant la prédiction : "
                f"{erreur}"
            ),
        ) from erreur


# ============================================================
# ANALYSE D’UN FICHIER CSV
# ============================================================

@app.post("/predict-file")
async def predict_file(
    fichier: UploadFile = File(...),
    utilisateur=Depends(exiger_utilisateur),
):
    try:
        nom_fichier = fichier.filename or ""

        if not nom_fichier.lower().endswith(".csv"):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Le fichier doit être au format CSV."
                ),
            )

        contenu = await fichier.read()

        if not contenu:
            raise HTTPException(
                status_code=400,
                detail="Le fichier CSV est vide.",
            )

        try:
            donnees = pd.read_csv(
                BytesIO(contenu)
            )

        except Exception as erreur:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Impossible de lire le fichier CSV. "
                    "Vérifiez son format."
                ),
            ) from erreur

        if donnees.empty:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Le fichier ne contient "
                    "aucune transaction."
                ),
            )

        colonnes_manquantes = [
            colonne
            for colonne in COLONNES_ATTENDUES
            if colonne not in donnees.columns
        ]

        if colonnes_manquantes:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Colonnes manquantes : "
                    + ", ".join(colonnes_manquantes)
                ),
            )

        donnees_modele = donnees[
            COLONNES_ATTENDUES
        ].copy()

        probabilites = pipeline.predict_proba(
            donnees_modele
        )[:, 1]

        predictions = (
            probabilites >= seuil
        ).astype(int)

        resultats = donnees.copy()

        resultats["probabilite_fraude"] = (
            probabilites.round(6)
        )

        resultats["prediction"] = predictions

        resultats["decision"] = [
            (
                "Fraude"
                if prediction == 1
                else "Légitime"
            )
            for prediction in predictions
        ]

        total_transactions = len(resultats)

        total_fraudes = int(
            predictions.sum()
        )

        total_legitimes = (
            total_transactions
            - total_fraudes
        )

        taux_fraude = (
            total_fraudes
            / total_transactions
        )

        resultats_enregistres = resultats.to_dict(
            orient="records"
        )

        analyse_id = enregistrer_analyse(
            type_analyse="fichier",
            nom_fichier=nom_fichier,
            resultats=resultats_enregistres,
        )

        return {
            "total_transactions": (
                total_transactions
            ),
            "total_legitimes": (
                total_legitimes
            ),
            "total_fraudes": (
                total_fraudes
            ),
            "taux_fraude": round(
                taux_fraude,
                6,
            ),
            "seuil": seuil,
            "analyse_id": analyse_id,
            "resultats": resultats_enregistres,
        }

    except HTTPException:
        raise

    except Exception as erreur:
        raise HTTPException(
            status_code=500,
            detail=(
                "Erreur pendant l’analyse "
                f"du fichier : {erreur}"
            ),
        ) from erreur

    finally:
        await fichier.close()
