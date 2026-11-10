# Rapport — ENSIM Trade Center

## Objectif et décision

À chaque tour, le marché lit `decision.json`. Pour A, B et C, une valeur positive achète `100 × signal` unités, une valeur négative en vend. L'objectif retenu est d'obtenir une progression de la valeur totale tout en limitant le risque de perte depuis un sommet. La performance est comparée aux traders de référence `random_trader`, `random_buyer` et `random_seller`.

## Données et limites

Le signal ne lit que l'historique des prix déjà publiés. Le solde et les stocks servent uniquement à limiter les ordres. Le prix futur et la formule cachée du marché ne sont pas connus. Les données sont obtenues par les URL publiques du marché, des avoirs du trader et du classement. La série de performance commence au premier tour où notre script s'exécute ; aucune performance antérieure n'est reconstruite à partir du seul état courant.

## Modèle choisi

Pour chaque produit, la moyenne mobile sur 5 tours représente la direction récente ; celle sur 20 tours sert de référence plus lente. Si l'écart est inférieur à 1 %, la décision est de conserver. Pour acheter, la moyenne courte doit dépasser la longue **et** le dernier prix doit dépasser celui d'il y a quatre tours. Les conditions inverses produisent une vente. Un désaccord entre les deux mesures déclenche une conservation. Sans 20 observations, le signal est nul.

L'intensité augmente avec l'écart relatif entre les deux moyennes, puis est limitée à 0,30. Cette règle suit une tendance observée sans supposer que chaque oscillation se corrigera immédiatement. Elle peut réagir tardivement après un retournement : c'est le principal coût du filtrage des mouvements faibles. Les seuils de 5, 20 et 1 % sont des choix de conception, à réévaluer sur les résultats observés, sans prétendre qu'ils sont optimaux.

## Faisabilité et contrôle du risque

Les ventes sont plafonnées au stock existant. Les achats sont réduits si le solde tomberait sous 50 unités monétaires ou si la valeur du produit dépasserait 30 % de la valeur totale du portefeuille. Chaque produit ne peut faire l'objet de plus de 30 unités d'achat ou de vente par tour. Les ventes sont traitées avant les achats et la trésorerie disponible est mise à jour après chaque décision ; plusieurs achats ne peuvent donc pas dépenser deux fois le même argent. Ces filtres excluent les ordres impossibles ou trop concentrés avant de comparer leur rendement potentiel.

## Tableau de bord et indicateurs

Le tableau de bord montre la valeur actuelle, l'écart avec la meilleure des trois références, une courbe des valeurs enregistrées par tour, le drawdown maximal et actuel, les prix et moyennes mobiles de chaque produit, puis un journal des décisions avec motif. La courbe sert à voir si la stratégie progresse relativement aux références ; le drawdown évite d'interpréter une seule valeur finale comme une réussite complète ; le détail des signaux aide à vérifier les décisions à chaque tour.

## Résultats à renseigner après plusieurs tours

L'inscription du trader n'est pas encore configurée dans ce dépôt. Après plusieurs tours, reporter ici : période observée, valeur initiale et finale, rendement, valeurs finales des trois références, drawdown maximal, quelques décisions marquantes et les éventuels changements de règle. Appuyer ces observations sur `data/performance.json` et le journal du tableau de bord. Ne pas attribuer au modèle une performance non encore observée.
