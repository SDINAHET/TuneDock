# Politique de confidentialité de TuneDock

Dernière mise à jour : 9 août 2026

## Résumé

TuneDock ne collecte, ne vend et ne partage aucune donnée personnelle. TuneDock ne possède aucun serveur, n'affiche aucune publicité et n'utilise aucun outil d'analyse d'audience.

## Données utilisées localement

Pour fournir son unique fonction — afficher et contrôler Spotify Web — TuneDock lit dans l'onglet `open.spotify.com` :

- le titre et l'artiste du contenu en cours ;
- la pochette fournie par Spotify ;
- l'état de lecture, la durée, la position et le volume ;
- l'état des commandes de lecture et des Titres likés.

Ces informations sont utilisées en temps réel dans l'interface TuneDock. Elles ne sont pas enregistrées dans une base de données et ne sont pas envoyées au développeur.

## Stockage Firefox

TuneDock utilise le stockage local de Firefox pour conserver :

- l'état ouvert/masqué du widget ;
- la préférence d'ouverture de Spotify au démarrage ;
- la position et la taille du widget ;
- la validation de l'écran de bienvenue.

Ces réglages restent dans le profil Firefox de l'utilisateur. TuneDock ne stocke aucun identifiant Spotify, mot de passe, Client ID ou jeton OAuth.

## Accès facultatif aux sites Web

Le widget flottant est facultatif et désactivé par défaut. Si l'utilisateur l'active, Firefox demande l'autorisation d'afficher TuneDock sur les pages HTTPS. Le script du widget ne lit pas le contenu, les formulaires, l'historique ou les mots de passe des pages visitées. Cet accès sert uniquement à afficher le mini-lecteur TuneDock au-dessus de la page.

L'utilisateur peut masquer le widget ou retirer l'autorisation depuis les réglages de Firefox.

## Services tiers

TuneDock communique uniquement avec Spotify Web afin d'exécuter les actions demandées par l'utilisateur et d'afficher les informations du lecteur. L'utilisation de Spotify reste soumise aux conditions et à la politique de confidentialité de Spotify.

La fonction facultative **Rechercher les paroles** ouvre une recherche Google contenant le titre et le nom de l'artiste uniquement après un clic explicite de l'utilisateur. TuneDock ne contacte pas Google en arrière-plan, ne récupère pas les résultats et ne stocke ni ne reproduit les paroles. L'utilisation de la page ouverte relève alors des règles de confidentialité de Google.

## Firefox Web Store Limited Use

L'utilisation des informations accessibles via Firefox respecte la politique relative aux données utilisateur du Firefox Web Store, y compris les exigences de Limited Use. Les données sont utilisées uniquement pour fournir la fonctionnalité visible de contrôle de Spotify Web.

## Sécurité

Tous les scripts TuneDock sont inclus dans l'extension. Aucun code distant n'est téléchargé ou exécuté. Les communications avec Spotify utilisent HTTPS.

## Contact

Développeur : Stéphane Dinahet  
Support et code source : https://github.com/SDINAHET/TuneDock

Les questions de confidentialité peuvent être déposées dans les issues du dépôt GitHub sans inclure de donnée personnelle.
