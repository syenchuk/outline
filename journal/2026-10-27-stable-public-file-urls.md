# Chemins URL stables `/file/<id>/<nom>` pour les pièces jointes publiques

## Contexte

Cette instance d'Outline (fork basé sur la version 1.12.0) héberge des collections publiques, partagées via des liens publics. Le stockage est local (`FILE_STORAGE=local`) et les pièces jointes sont créées avec l'ACL `public-read`.

## Problème

Dans le contenu d'un document, les images et fichiers sont référencés par `/api/attachments.redirect?id=<uuid>`. Pour le HTML d'un partage ([app.ts](../server/routes/app.ts), `DocumentHelper.toHTML` avec `signedUrls`), ces liens sont réécrits en URLs signées (JWT) valables 1 heure. De plus, `attachments.redirect` redirige vers une URL signée valable 5 minutes, même pour un fichier public.

Conséquences : les URLs expirent, ce qui empêche l'indexation par Google (images et fichiers en erreur après expiration), et la signature est inutile pour un contenu public.

## Objectif

- Une URL stable, sans signature ni expiration, pour toute pièce jointe publique.
- Compatible SEO : pas de doublons d'URL, URL canonique déclarée.
- Possibilité de forcer le téléchargement.
- Aucune modification de la base de données ; les pièces jointes privées restent protégées par signature.

## Solution proposée

Une route publique `GET /file/:id/:name` qui sert le fichier en continu.

- Pièce jointe publique : 200, contenu servi (avec gestion des plages d'octets).
- Pièce jointe privée : 403.
- Identifiant invalide ou inconnu : 404.
- Le nom dans l'URL ne sert qu'à la lisibilité ; il est ignoré pour retrouver le fichier.
- `?download` force `Content-Disposition: attachment`.
- Les deux variantes envoient `Link: <URL nue>; rel="canonical"` (pas de `noindex`), pour éviter les doublons côté Google.
- Le HTML ne contient que l'URL nue. Les liens de pièces jointes gardent l'attribut `download` du nœud éditeur ([Attachment.tsx](../shared/editor/nodes/Attachment.tsx)), qui force le téléchargement sans paramètre.

## Spécification technique

### Idée générale

1. Extraire la logique de service de fichier de `files.get` dans un utilitaire partagé.
2. Ajouter une route `/file/:id/:name` qui l'utilise après vérification de l'ACL.
3. Ajouter `Attachment.publicUrl` et l'utiliser partout où une URL signée était générée pour un fichier non privé.
4. Rediriger `attachments.redirect` vers cette URL pour les fichiers non privés.

Avec un stockage non local (S3), `publicUrl` retombe sur l'URL canonique du bucket et la route redirige vers elle.

### Composants impactés

| Composant                                                              | Changement                                                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [serveFile.ts](../plugins/storage/server/utils/serveFile.ts) (nouveau) | En-têtes, plages d'octets, CSP, `Content-Disposition`, `Link canonical` optionnel.                                             |
| [files.ts](../plugins/storage/server/api/files.ts)                     | `files.get` délègue à `serveFile` (comportement inchangé).                                                                     |
| [Attachment.ts](../server/models/Attachment.ts)                        | Nouveau getter `publicUrl`.                                                                                                    |
| [file.ts](../server/routes/file.ts) (nouveau)                          | Handler `renderFile` : 404 / 403 / redirection S3 / service du fichier.                                                        |
| [index.ts](../server/routes/index.ts)                                  | Enregistrement de `/file/:id/:name`, avant `/embeds/*`.                                                                        |
| [attachments.ts](../server/routes/api/attachments/attachments.ts)      | `attachments.redirect` : fichier non privé → redirection vers `publicUrl`, cache 1 semaine (`immutable`).                      |
| [TextHelper.ts](../server/models/helpers/TextHelper.ts)                | `attachmentsToSignedUrls` : URL absolue `publicUrl` pour les non privés, signature conservée pour les privés (e-mails inclus). |
| Tests                                                                  | `file.test.ts` (nouveau), `TextHelper.test.ts`, `attachments.test.ts` (deux tests adaptés).                                    |

### Limites et points d'attention

- Seules les pièces jointes `public-read` en bénéficient. Les anciennes pièces jointes privées gardent des URLs signées (aucune migration de données).
- Les anciens documents n'ont pas besoin d'être modifiés : leurs liens `attachments.redirect` sont réécrits à la volée.
- Le contenu réellement rendu côté navigateur passe encore par `attachments.redirect`, qui redirige désormais vers `/file/…`.
- Un reverse proxy (Caddy) doit transmettre `/file/*` à l'application ; c'est le cas avec un `reverse_proxy` global.

### Feuille de route d'implémentation

- [x] Extraire `serveFile` et refactorer `files.get`.
- [x] Ajouter `Attachment.publicUrl`.
- [x] Ajouter la route `/file/:id/:name` et ses tests.
- [x] Rediriger `attachments.redirect` pour les fichiers publics.
- [x] Utiliser `publicUrl` dans `attachmentsToSignedUrls`.
- [x] Adapter les tests existants ; `yarn test:server` et `yarn tsc` passent.
- [ ] Optionnel : exposer `?download` dans l'interface si le besoin apparaît.
- [ ] Optionnel : vérifier l'indexation dans Google Search Console après déploiement.

## Instructions de déploiement

Le changement est rétrocompatible (aucune migration, ancienne route conservée) : un déploiement en une seule étape suffit.

- [ ] Commiter et pousser sur le fork ; vérifier que la CI est verte.
- [ ] Créer un tag (`vX.Y.Z-sN`) pour publier l'image sur GHCR via `publish.yml`.
- [ ] Sauvegarder la base (`pg_dump`) et le volume de fichiers.
- [ ] Mettre à jour le tag de l'image dans le dépôt infra, puis `docker compose pull && docker compose up -d`.
- [ ] Vérifier `<URL>/_health` (`<URL>` : valeur de la variable d'environnement `URL`).
- [ ] Vérifier avec un fichier public : `curl -I <URL>/file/<id>/<nom>` → 200, en-tête `Link … rel="canonical"`.
- [ ] Vérifier avec un fichier privé : même URL → 403 ; avec `?download` → `Content-Disposition: attachment`.
- [ ] Ouvrir une page de collection publique : les images doivent pointer vers `/file/…` (code source de la page).
- [ ] En cas de problème : revenir au tag précédent de l'image (aucune donnée modifiée).
