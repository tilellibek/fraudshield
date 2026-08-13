# Connexion de FraudShield à PostgreSQL sur Render

Le projet utilise maintenant PostgreSQL quand la variable `DATABASE_URL` est définie. Sans cette variable, il continue d'utiliser SQLite en local.

## 1. Variables du futur Web Service backend

Dans **Render > Web Service > Environment**, ajouter :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | L'**Internal Database URL** de la base Render |
| `FRAUDSHIELD_USER` | `admin` |
| `FRAUDSHIELD_PASSWORD` | Un mot de passe d'au moins 12 caractères |
| `ENVIRONMENT` | `production` |
| `FRONTEND_URL` | L'URL HTTPS du frontend, lorsqu'elle sera connue |

Ne jamais publier la valeur de `DATABASE_URL` ni le mot de passe dans GitHub.

## 2. Commandes du Web Service

- Build Command : `pip install -r requirements.txt`
- Start Command : `uvicorn backend.app:app --host 0.0.0.0 --port $PORT`
- Health Check Path : `/health`

Au premier démarrage, l'API crée automatiquement les tables et le premier compte administrateur.

## 3. Facultatif : transférer les données SQLite existantes

Cette opération doit être faite avant le premier démarrage du Web Service, car la base PostgreSQL doit être vide.

Dans PowerShell, depuis le dossier du projet :

```powershell
$env:DATABASE_URL="COLLER_ICI_L_EXTERNAL_DATABASE_URL"
python scripts/migrer_sqlite_vers_postgresql.py
```

Le script copie les analyses, transactions et utilisateurs. Les anciennes sessions de connexion ne sont volontairement pas copiées.

## 4. Vérification

Après le déploiement, ouvrir :

```text
https://ADRESSE-DU-BACKEND.onrender.com/health
```

La réponse doit contenir `"status": "ok"`.
