# Configuration sécurisée de FraudShield

## Première installation

1. Copiez `.env.example` et renommez la copie `.env`.
2. Choisissez l’identifiant du premier administrateur.
3. Remplacez le mot de passe d’exemple par un mot de passe robuste d’au
   moins 12 caractères.
4. Installez les dépendances puis démarrez FastAPI.

Exemple de `.env` local :

```text
FRAUDSHIELD_USER=admin
FRAUDSHIELD_PASSWORD=votre_mot_de_passe_personnel
```

Le fichier `.env` est exclu de Git et ne doit jamais être envoyé avec le
projet, publié sur GitHub ou inclus dans une capture d’écran.

## Base déjà créée

Les comptes sont déjà enregistrés sous forme hachée dans SQLite. La mise à
jour de la configuration ne supprime ni les utilisateurs ni les analyses.
Les variables servent à créer le tout premier administrateur lorsque la base
est encore vide.

## Déploiement

Sur le serveur distant, renseignez `FRAUDSHIELD_USER` et
`FRAUDSHIELD_PASSWORD` dans les variables d’environnement de la plateforme.
Ne téléversez pas le fichier `.env`.
