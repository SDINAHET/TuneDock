# ![alt text](icons/tunedock-32.png) TuneDock

TuneDock est une extension Chrome Manifest V3 qui contrôle **Spotify Web** depuis le panneau latéral de Chrome ou depuis un widget flottant facultatif.

Projet créé par **Stéphane Dinahet**. TuneDock est un projet indépendant, non affilié, non approuvé et non sponsorisé par Spotify AB.

## Fonctionnalités

- ouverture automatique de Spotify Web en un clic ;
- morceau, artiste, pochette et progression en cours ;
- lecture/pause, précédent et suivant ;
- navigation dans le morceau et réglage du volume ;
- lecture aléatoire et répétition lorsque Spotify les autorise ;
- ajout/retrait des Titres likés avec état synchronisé ;
- ouverture du sélecteur d'appareils Spotify ;
- lien direct vers le contenu dans Spotify ;
- widget flottant compact ou agrandi, déplaçable et facultatif ;
- mémorisation locale des préférences.

TuneDock ne diffuse aucun son : la lecture reste assurée par le lecteur officiel `open.spotify.com`.

## Compatibilité

- Google Chrome 116 ou version ultérieure ;
- Spotify Web ouvert et connecté ;
- compte Spotify Free ou Premium, dans la limite des actions autorisées par Spotify pour le compte et le contenu concernés.

Spotify peut modifier son interface Web. TuneDock utilise des sélecteurs de secours français et anglais, mais une modification importante du lecteur peut nécessiter une mise à jour de l'extension.

## Installation locale

1. Télécharger ou cloner ce dépôt.
2. Ouvrir `chrome://extensions`.
3. Activer **Mode développeur**.
4. Cliquer sur **Charger l'extension non empaquetée**.
5. Sélectionner le dossier contenant `manifest.json`.
6. Cliquer sur l'icône TuneDock.

Après une mise à jour locale, rechargez l'extension puis l'onglet Spotify Web.

## Utilisation

Au premier lancement, cliquez sur **Continuer avec Spotify**. Spotify Web s'ouvre sur son site officiel. Une fois connecté à Spotify, TuneDock récupère l'état du lecteur et affiche les commandes.

Le widget est désactivé par défaut. Son activation demande facultativement l'accès aux pages HTTPS afin de pouvoir afficher le mini-lecteur au-dessus de la page courante. TuneDock ne lit ni ne transmet le contenu de ces pages.

## Permissions Chrome

| Permission | Utilisation |
| --- | --- |
| `storage` | Conserver localement les préférences, la position et l'état du widget. |
| `sidePanel` | Afficher TuneDock dans le panneau latéral de Chrome. |
| `scripting` | Enregistrer et afficher le widget flottant après accord de l'utilisateur. |
| `https://open.spotify.com/*` | Lire l'état visible du lecteur Spotify Web et déclencher ses commandes. |
| `https://*/*` facultatif | Afficher uniquement le widget sur les pages HTTPS après activation explicite. |

L'extension ne demande plus de Client ID Spotify, n'utilise pas la Web API Spotify et ne stocke aucun jeton OAuth.

## Confidentialité

- aucun compte TuneDock ;
- aucun serveur TuneDock ;
- aucune publicité ni analyse d'audience ;
- aucune vente ou transmission de données personnelles ;
- préférences stockées localement par Chrome ;
- données musicales lues uniquement depuis l'onglet Spotify Web afin d'afficher et contrôler la lecture.

Consultez [PRIVACY.md](PRIVACY.md) pour la politique complète.

## Architecture

```text
sidepanel.html / sidepanel.js
        │
        ▼
background.js (service worker)
        │ messages Chrome
        ▼
spotify-web.js dans open.spotify.com
        │
        └── état et commandes du lecteur officiel

widget.js ── widget facultatif sur les pages HTTPS autorisées
```

Tous les scripts exécutés par l'extension sont inclus dans le dépôt et dans le paquet. Aucun code JavaScript distant n'est chargé.

## Développement

Le projet utilise uniquement HTML, CSS et JavaScript natifs : aucune compilation n'est nécessaire.

Vérifications rapides :

```bash
node --check background.js
node --check sidepanel.js
node --check spotify-web.js
node --check widget.js
```

## Signaler un problème

Ouvrez une issue GitHub avec :

- la version de Chrome ;
- la langue de Spotify Web ;
- l'action concernée ;
- une capture sans information personnelle ;
- les erreurs visibles dans `chrome://extensions` si disponibles.

## Marques et contenus

Spotify, son logo et ses marques appartiennent à Spotify AB. Les pochettes, noms d'artistes et métadonnées appartiennent à leurs ayants droit. Le logo Spotify inclus dans ce projet provient du kit officiel et n'est utilisé que pour l'attribution requise.

Le logo TuneDock est original et volontairement distinct de l'identité visuelle Spotify.

## Licence

Le code original TuneDock est distribué sous licence MIT. Cette licence ne couvre pas les marques Spotify, le logo Spotify, les contenus musicaux, les pochettes ou les autres éléments appartenant à des tiers. Voir [LICENSE](LICENSE).
