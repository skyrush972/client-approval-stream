# Rendre l'application plus intuitive

Objectif : que vous (admin) et vos clients trouviez tout de suite quoi faire, sans chercher.

## Côté admin (console)

1. **Page d'accueil guidée** — quand il n'y a aucun projet, un grand panneau « Commencer » avec 3 étapes numérotées : 1) Créer un projet client, 2) Déposer les rushs, 3) Copier le lien client. Aujourd'hui la console s'ouvre sur un tableau vide sans indication.
2. **Barre d'actions claire en haut du projet ouvert** — les actions importantes aujourd'hui dispersées (Copier le lien, Payé/Validé, Modifier, Archiver, Supprimer) regroupées dans une seule barre avec des libellés explicites : « Copier le lien client », « Débloquer le téléchargement », « Modifier », « Archiver ».
3. **Indicateur d'étape du projet** — sous le titre du projet, une frise simple : `Vidéos en ligne → Lien envoyé → Retours reçus → Payé / Validé → Archivé`, avec l'étape courante mise en avant. Vous voyez d'un coup où en est chaque projet.
4. **Libellés plus parlants** — « Payé / Validé » devient « Téléchargement débloqué » avec une courte explication (« le client peut télécharger ses fichiers ») ; « Ret. » devient « Retours » ; infobulles sur les interrupteurs.
5. **Retour visuel après chaque action** — confirmations déjà présentes, complétées là où elles manquent (ex. après copie du lien : « Lien copié — envoyez-le à votre client »).

## Côté client (page de livraison)

1. **Consigne visible en haut** — une phrase d'accueil simple : « Regardez vos vidéos, laissez vos commentaires à l'instant précis, puis téléchargez vos fichiers une fois la livraison validée. »
2. **Commentaires guidés** — la zone de commentaire explique en une ligne que l'instant de la vidéo est joint automatiquement, avec l'instant affiché en évidence (ex. « Votre commentaire sera lié à 1:24 ») au lieu de la case à cocher discrète actuelle.
3. **Bouton télécharger explicite** — quand c'est verrouillé, le bouton explique pourquoi (« Disponible une fois la livraison validée par Skyrush972 ») au lieu d'être simplement grisé.
4. **État vide plus chaleureux** — si aucun commentaire : « Soyez le premier à laisser un retour » plutôt qu'une phrase neutre.

## Détails techniques

- Aucun changement de base de données ni de logique serveur : uniquement de la présentation et du texte dans `src/routes/admin.tsx`, `src/components/AdminDashboard.tsx`, `src/routes/lien.$token.tsx` et `src/routes/espace.projet.$id.tsx`.
- Le style cinématique sombre (bleu nuit, doré, Playfair Display) est conservé tel quel.
- Vérification dans le navigateur (desktop + mobile) après chaque étape.
