# FraudShield

FraudShield est une application web de détection de fraudes dans les transactions bancaires. Elle utilise un modèle de machine learning XGBoost pour estimer la probabilité de fraude et aider les analystes à examiner les transactions suspectes.

## Application en ligne

[Accéder à FraudShield](https://fraudshield-2srp.onrender.com/connexion.html)

> Le service utilise une instance Render gratuite. Après une période d’inactivité, le premier chargement peut prendre quelques secondes.

## Fonctionnalités

* authentification sécurisée des utilisateurs ;
* gestion des rôles Analyste et Administrateur ;
* analyse manuelle d’une transaction ;
* analyse d’un fichier CSV ;
* calcul de la probabilité de fraude ;
* classification selon un seuil optimisé ;
* tableau de bord avec statistiques ;
* suivi et traitement des alertes ;
* historique des analyses ;
* gestion des utilisateurs.

## Technologies utilisées

### Backend

* Python
* FastAPI
* SQLAlchemy
* PostgreSQL
* Uvicorn

### Machine learning

* XGBoost
* Scikit-learn
* Pandas
* NumPy
* Joblib

### Frontend

* HTML
* CSS
* JavaScript

### Déploiement

* Render Web Service
* Render PostgreSQL
* GitHub

## Modèle de détection

Le modèle final est basé sur XGBoost. Il a été entraîné sur des transactions bancaires prétraitées et utilise notamment les variables suivantes :

* montant de la transaction ;
* âge du client ;
* heure, jour et mois ;
* transaction nocturne ou effectuée le week-end ;
* distance entre le client et le commerçant ;
* population de la ville ;
* catégorie du commerçant ;
* genre du client.

Le seuil de classification final est fixé à `0,90` afin de maintenir un rappel élevé tout en limitant les faux positifs.

## Structure du projet

```text
fraudshield/
├── backend/
│   ├── app.py
│   └── database.py
├── frontend/
│   ├── css/
│   ├── js/
│   └── *.html
├── modeles/
│   ├── pipeline_xgb_optimise.joblib
│   └── seuil_xgb_optimise.json
├── data/
├── requirements.txt
└── README.md
```

## Installation locale

### 1. Cloner le dépôt

```bash
git clone https://github.com/tilellibek/fraudshield.git
cd fraudshield
```

### 2. Créer un environnement virtuel

```bash
python -m venv .venv
```

Sous Windows :

```powershell
.venv\Scripts\activate
```

### 3. Installer les dépendances

```bash
pip install -r requirements.txt
```

### 4. Configurer les variables d’environnement

Créer un fichier `.env` à la racine du projet :

```env
DATABASE_URL=
FRAUDSHIELD_USER=admin
FRAUDSHIELD_PASSWORD=mot-de-passe-securise
FRONTEND_URL=http://127.0.0.1:8000
ENVIRONMENT=development
```


### 5. Démarrer l’application

```bash
uvicorn backend.app:app --reload
```

Ouvrir ensuite :

```text
http://127.0.0.1:8000/connexion.html
```

## API

La documentation interactive de l’API est disponible à l’adresse suivante :

[Documentation Swagger](https://fraudshield-2srp.onrender.com/docs)

L’état du service peut être vérifié ici :

[Health check](https://fraudshield-2srp.onrender.com/health)

## Sécurité

* mots de passe stockés sous forme de hachage avec sel ;
* sessions sécurisées par cookies HTTP-only ;
* contrôle des rôles ;
* secrets conservés dans les variables d’environnement Render ;
* accès à PostgreSQL par une URL privée en production.

## Auteur

**Tilelli Bektache**
