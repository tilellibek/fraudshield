"""Copie les données SQLite existantes vers une base PostgreSQL vide.

Utilisation (PowerShell) :
    $env:DATABASE_URL="postgresql://..."
    python scripts/migrer_sqlite_vers_postgresql.py
"""

import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import func, select, text


RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))

if not os.getenv("DATABASE_URL", "").startswith(("postgres://", "postgresql://")):
    raise SystemExit("DATABASE_URL doit désigner la base PostgreSQL de destination.")

from backend.database import (  # noqa: E402
    Analyse,
    Base,
    SessionLocale,
    TransactionDB,
    Utilisateur,
    moteur,
)


def convertir_date(valeur):
    return datetime.fromisoformat(valeur) if valeur else None


source = RACINE / "data" / "fraudshield.db"
if not source.exists():
    raise SystemExit(f"Base SQLite introuvable : {source}")

Base.metadata.create_all(moteur)

with SessionLocale() as destination:
    if destination.scalar(select(func.count(Analyse.id))) or destination.scalar(
        select(func.count(Utilisateur.id))
    ):
        raise SystemExit(
            "La base PostgreSQL n'est pas vide. Migration annulée pour éviter les doublons."
        )

with sqlite3.connect(source) as origine:
    origine.row_factory = sqlite3.Row
    analyses = origine.execute("SELECT * FROM analyses ORDER BY id").fetchall()
    transactions = origine.execute("SELECT * FROM transactions ORDER BY id").fetchall()
    utilisateurs = origine.execute("SELECT * FROM utilisateurs ORDER BY id").fetchall()

with SessionLocale.begin() as destination:
    for ligne in analyses:
        donnees = dict(ligne)
        donnees["date_analyse"] = convertir_date(donnees["date_analyse"])
        destination.add(Analyse(**donnees))

    for ligne in transactions:
        donnees = dict(ligne)
        donnees["date_traitement"] = convertir_date(donnees["date_traitement"])
        destination.add(TransactionDB(**donnees))

    for ligne in utilisateurs:
        donnees = dict(ligne)
        donnees["actif"] = bool(donnees["actif"])
        donnees["date_creation"] = convertir_date(donnees["date_creation"])
        destination.add(Utilisateur(**donnees))

    destination.flush()
    for table in ("analyses", "transactions", "utilisateurs"):
        destination.execute(text(
            f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
            f"COALESCE((SELECT MAX(id) FROM {table}), 1), true)"
        ))

print(
    f"Migration terminée : {len(analyses)} analyse(s), "
    f"{len(transactions)} transaction(s), {len(utilisateurs)} utilisateur(s)."
)
