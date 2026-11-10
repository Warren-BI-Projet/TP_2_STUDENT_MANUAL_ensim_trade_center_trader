# ENSIM Trade Center — trader

Ce dépôt contient un signal de trading explicable, le fichier de décision lu par le marché, un tableau de bord et un rapport méthodologique. Le [manuel du TP](./TP_2_STUDENT_MANUAL_ensim_trade_center_trader.md) décrit les attentes.

## Mise en service

1. Publier ce dépôt en **public**. Transmettre à l'organisateur l'URL brute de `decision.json` : `https://raw.githubusercontent.com/<compte>/<depot>/main/decision.json`.
2. Attendre la confirmation d'inscription, puis inscrire l'identifiant exact du trader dans `config.json` (`trader_id`). Le script utilise cet identifiant pour lire `traders/<id>/holdings.json` dans le dépôt de l'organisateur.
3. Lancer `python scripts/algorithm.py` à la racine, puis vérifier `decision.json` et `data/performance.json`. Le script n'a aucune dépendance externe et copie la configuration et l'historique nécessaires dans `docs/`.
4. Publier les modifications. Dans **Settings → Actions → General**, autoriser **Read and write permissions**. Lancer **Auto decide** manuellement une fois dans l'onglet Actions, puis vérifier son résultat. Le programme s'exécute ensuite deux fois par heure.
5. Activer GitHub Pages avec la branche `main` et le dossier `/ (root)`. L'URL Pages du dépôt redirige alors vers le tableau de bord dans `docs/`.

Tant que `trader_id` est vide, `decision.json` reste à zéro et l'automatisation n'émet aucun ordre. L'identifiant doit venir de l'organisateur ; il ne faut pas le deviner.

## Règle de décision

La moyenne des 5 derniers prix est comparée à celle des 20 derniers. Il faut un écart d'au moins 1 % et un mouvement cohérent sur 5 tours pour agir. Le signal brut est limité à ±0,30, soit 30 unités maximum par tour et produit. Le script conserve au moins 50 unités monétaires, limite la valeur détenue d'un produit à 30 % de la valeur totale, et ne vend jamais plus que le stock possédé. Avec moins de 20 prix, il conserve.

Le script enregistre un instantané par tour dans `data/performance.json` : valeur du trader, valeurs des trois références et motifs de décision. Le tableau de bord calcule le drawdown à partir de ces instantanés. Il ne reconstitue pas artificiellement les performances passées avant l'inscription.

## Fichiers utiles

- [`config.json`](./config.json) : identifiant du trader et URL des flux publics.
- [`scripts/algorithm.py`](./scripts/algorithm.py) : signal et limites de risque.
- [`decision.json`](./decision.json) : ordre lu par le marché.
- [`data/performance.json`](./data/performance.json) : historique à partir du premier tour suivi.
- [`docs/index.html`](./docs/index.html) : tableau de bord.
- [`RAPPORT.md`](./RAPPORT.md) : justification de la stratégie et analyse à compléter avec les résultats observés.

Pour vérifier la logique hors réseau : `python -m unittest discover -s tests`.
