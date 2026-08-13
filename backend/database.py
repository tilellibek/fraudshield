import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Integer, String, Text,
    create_engine, delete, func, select, update,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


RACINE = Path(__file__).resolve().parent.parent
load_dotenv(RACINE / ".env")

URL_SQLITE = f"sqlite:///{(RACINE / 'data' / 'fraudshield.db').as_posix()}"
DATABASE_URL = os.getenv("DATABASE_URL", URL_SQLITE).strip()

# Render peut fournir une URL commençant par postgres://.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://", "postgresql+psycopg://", 1
    )
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgresql://", "postgresql+psycopg://", 1
    )

options = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    (RACINE / "data").mkdir(parents=True, exist_ok=True)
    options["connect_args"] = {"check_same_thread": False}

moteur = create_engine(DATABASE_URL, **options)
SessionLocale = sessionmaker(bind=moteur, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Analyse(Base):
    __tablename__ = "analyses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type_analyse: Mapped[str] = mapped_column(String(30), nullable=False)
    nom_fichier: Mapped[str | None] = mapped_column(String(255))
    date_analyse: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    total_transactions: Mapped[int] = mapped_column(Integer, nullable=False)
    total_legitimes: Mapped[int] = mapped_column(Integer, nullable=False)
    total_fraudes: Mapped[int] = mapped_column(Integer, nullable=False)
    taux_fraude: Mapped[float] = mapped_column(Float, nullable=False)


class TransactionDB(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    analyse_id: Mapped[int] = mapped_column(
        ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False
    )
    numero_ligne: Mapped[int] = mapped_column(Integer, nullable=False)
    donnees_json: Mapped[str] = mapped_column(Text, nullable=False)
    probabilite_fraude: Mapped[float] = mapped_column(Float, nullable=False)
    prediction: Mapped[int] = mapped_column(Integer, nullable=False)
    decision: Mapped[str] = mapped_column(String(30), nullable=False)
    statut: Mapped[str] = mapped_column(
        String(30), nullable=False, default="a_verifier"
    )
    commentaire: Mapped[str | None] = mapped_column(Text)
    date_traitement: Mapped[datetime | None] = mapped_column(DateTime)


class Utilisateur(Base):
    __tablename__ = "utilisateurs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    identifiant: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    mot_de_passe_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    sel: Mapped[str] = mapped_column(String(64), nullable=False)
    actif: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    date_creation: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class SessionDB(Base):
    __tablename__ = "sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    utilisateur_id: Mapped[int] = mapped_column(
        ForeignKey("utilisateurs.id", ondelete="CASCADE"), nullable=False
    )
    jeton_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    date_expiration: Mapped[datetime] = mapped_column(DateTime, nullable=False)


def _iso(valeur):
    return valeur.isoformat(timespec="seconds") if isinstance(valeur, datetime) else valeur


def _hacher_mot_de_passe(mot_de_passe, sel):
    return hashlib.pbkdf2_hmac(
        "sha256", mot_de_passe.encode(), bytes.fromhex(sel), 310_000
    ).hex()


def initialiser_base():
    Base.metadata.create_all(moteur)
    with SessionLocale.begin() as session:
        utilisateur = session.scalar(select(Utilisateur).limit(1))
        if utilisateur is None:
            identifiant = os.getenv("FRAUDSHIELD_USER", "").strip()
            mot_de_passe = os.getenv("FRAUDSHIELD_PASSWORD", "")
            if not identifiant or not mot_de_passe:
                raise RuntimeError(
                    "Renseignez FRAUDSHIELD_USER et FRAUDSHIELD_PASSWORD."
                )
            if len(mot_de_passe) < 12:
                raise RuntimeError("Le mot de passe doit contenir au moins 12 caractères.")
            sel = secrets.token_hex(16)
            session.add(Utilisateur(
                identifiant=identifiant.lower(), nom="Administrateur FraudShield",
                role="administrateur",
                mot_de_passe_hash=_hacher_mot_de_passe(mot_de_passe, sel),
                sel=sel, actif=True, date_creation=datetime.now(),
            ))
        session.execute(
            update(Utilisateur).where(
                Utilisateur.identifiant == "analyste",
                Utilisateur.role == "analyste",
            ).values(role="administrateur")
        )


def authentifier_utilisateur(identifiant, mot_de_passe):
    with SessionLocale() as session:
        u = session.scalar(select(Utilisateur).where(
            Utilisateur.identifiant == identifiant, Utilisateur.actif.is_(True)
        ))
        if not u or not hmac.compare_digest(
            _hacher_mot_de_passe(mot_de_passe, u.sel), u.mot_de_passe_hash
        ):
            return None
        return {"id": u.id, "identifiant": u.identifiant, "nom": u.nom, "role": u.role}


def creer_session(utilisateur_id):
    jeton = secrets.token_urlsafe(32)
    with SessionLocale.begin() as session:
        session.execute(delete(SessionDB).where(SessionDB.date_expiration < datetime.now()))
        session.add(SessionDB(
            utilisateur_id=utilisateur_id,
            jeton_hash=hashlib.sha256(jeton.encode()).hexdigest(),
            date_expiration=datetime.now() + timedelta(hours=8),
        ))
    return jeton


def obtenir_utilisateur_session(jeton):
    if not jeton:
        return None
    empreinte = hashlib.sha256(jeton.encode()).hexdigest()
    with SessionLocale() as session:
        ligne = session.execute(
            select(Utilisateur).join(SessionDB).where(
                SessionDB.jeton_hash == empreinte,
                SessionDB.date_expiration > datetime.now(),
                Utilisateur.actif.is_(True),
            )
        ).scalar_one_or_none()
        if not ligne:
            return None
        return {"id": ligne.id, "identifiant": ligne.identifiant,
                "nom": ligne.nom, "role": ligne.role}


def supprimer_session(jeton):
    if jeton:
        with SessionLocale.begin() as session:
            session.execute(delete(SessionDB).where(
                SessionDB.jeton_hash == hashlib.sha256(jeton.encode()).hexdigest()
            ))


def lister_utilisateurs():
    with SessionLocale() as session:
        lignes = session.scalars(select(Utilisateur).order_by(
            func.lower(Utilisateur.nom), func.lower(Utilisateur.identifiant)
        )).all()
        return [{"id": u.id, "identifiant": u.identifiant, "nom": u.nom,
                 "role": u.role, "actif": u.actif,
                 "date_creation": _iso(u.date_creation)} for u in lignes]


def creer_utilisateur(identifiant, nom, mot_de_passe, role):
    sel = secrets.token_hex(16)
    try:
        with SessionLocale.begin() as session:
            u = Utilisateur(
                identifiant=identifiant, nom=nom, role=role,
                mot_de_passe_hash=_hacher_mot_de_passe(mot_de_passe, sel),
                sel=sel, actif=True, date_creation=datetime.now(),
            )
            session.add(u)
            session.flush()
            resultat = {"id": u.id, "identifiant": u.identifiant,
                        "nom": u.nom, "role": u.role, "actif": True}
        return resultat
    except IntegrityError:
        return None


def modifier_activation_utilisateur(utilisateur_id, actif):
    with SessionLocale.begin() as session:
        u = session.get(Utilisateur, utilisateur_id)
        if not u:
            return None
        u.actif = actif
        if not actif:
            session.execute(delete(SessionDB).where(
                SessionDB.utilisateur_id == utilisateur_id
            ))
        return {"id": u.id, "identifiant": u.identifiant, "nom": u.nom,
                "role": u.role, "actif": actif}


def enregistrer_analyse(type_analyse, nom_fichier, resultats):
    total = len(resultats)
    fraudes = sum(int(r["prediction"]) for r in resultats)
    with SessionLocale.begin() as session:
        analyse = Analyse(
            type_analyse=type_analyse, nom_fichier=nom_fichier,
            date_analyse=datetime.now(), total_transactions=total,
            total_legitimes=total - fraudes, total_fraudes=fraudes,
            taux_fraude=fraudes / total if total else 0,
        )
        session.add(analyse)
        session.flush()
        for numero, r in enumerate(resultats, 1):
            donnees = {k: v for k, v in r.items() if k not in {
                "probabilite_fraude", "prediction", "decision"
            }}
            session.add(TransactionDB(
                analyse_id=analyse.id, numero_ligne=numero,
                donnees_json=json.dumps(donnees, ensure_ascii=False, default=str),
                probabilite_fraude=float(r["probabilite_fraude"]),
                prediction=int(r["prediction"]), decision=str(r["decision"]),
                statut="a_verifier",
            ))
        return analyse.id


def _analyse_dict(a):
    return {"id": a.id, "type_analyse": a.type_analyse,
            "nom_fichier": a.nom_fichier, "date_analyse": _iso(a.date_analyse),
            "total_transactions": a.total_transactions,
            "total_legitimes": a.total_legitimes,
            "total_fraudes": a.total_fraudes, "taux_fraude": a.taux_fraude}


def obtenir_statistiques_dashboard():
    with SessionLocale() as session:
        total, transactions, legitimes, fraudes = session.execute(select(
            func.count(Analyse.id), func.coalesce(func.sum(Analyse.total_transactions), 0),
            func.coalesce(func.sum(Analyse.total_legitimes), 0),
            func.coalesce(func.sum(Analyse.total_fraudes), 0),
        )).one()
        recentes = session.scalars(select(Analyse).order_by(Analyse.id.desc()).limit(5)).all()
        return {"total_analyses": int(total), "total_transactions": int(transactions),
                "total_legitimes": int(legitimes), "total_fraudes": int(fraudes),
                "taux_fraude": round(fraudes / transactions, 6) if transactions else 0,
                "dernieres_analyses": [_analyse_dict(a) for a in recentes]}


def obtenir_analyses():
    with SessionLocale() as session:
        return [_analyse_dict(a) for a in session.scalars(
            select(Analyse).order_by(Analyse.id.desc())
        ).all()]


def obtenir_analyse_par_id(analyse_id):
    with SessionLocale() as session:
        a = session.get(Analyse, analyse_id)
        if not a:
            return None
        lignes = session.scalars(select(TransactionDB).where(
            TransactionDB.analyse_id == analyse_id
        ).order_by(TransactionDB.probabilite_fraude.desc())).all()
        resultat = {**_analyse_dict(a), "transactions": []}
        for t in lignes:
            resultat["transactions"].append({
                "id": t.id, "numero_ligne": t.numero_ligne,
                **json.loads(t.donnees_json),
                "probabilite_fraude": t.probabilite_fraude,
                "prediction": t.prediction, "decision": t.decision,
            })
        return resultat


def obtenir_alertes():
    with SessionLocale() as session:
        lignes = session.execute(
            select(TransactionDB, Analyse).join(Analyse).where(
                TransactionDB.prediction == 1
            ).order_by(TransactionDB.probabilite_fraude.desc(), TransactionDB.id.desc())
        ).all()
        return [{
            "id": t.id, "analyse_id": t.analyse_id,
            "numero_ligne": t.numero_ligne, **json.loads(t.donnees_json),
            "probabilite_fraude": t.probabilite_fraude,
            "prediction": t.prediction, "decision_modele": t.decision,
            "statut": t.statut, "commentaire": t.commentaire,
            "date_traitement": _iso(t.date_traitement),
            "nom_fichier": a.nom_fichier, "date_analyse": _iso(a.date_analyse),
        } for t, a in lignes]


def mettre_a_jour_alerte(transaction_id, statut, commentaire):
    with SessionLocale.begin() as session:
        t = session.get(TransactionDB, transaction_id)
        if not t or t.prediction != 1:
            return None
        t.statut, t.commentaire, t.date_traitement = statut, commentaire, datetime.now()
        return {"id": t.id, "statut": statut, "commentaire": commentaire,
                "date_traitement": _iso(t.date_traitement)}
