# Télémétrie et vérification des mises à jour en opt-in

## Contexte

Ce fork vise l'auto-hébergement et la communauté, avec le moins de dépendances possible envers le service du éditeur d'origine.

## Problème

Par défaut, l'instance envoyait chaque jour des statistiques (nombre d'utilisateurs, d'équipes, de collections et de documents, version, identifiant haché) à `updates.getoutline.com`, sans consentement explicite.

## Objectif

Aucun appel sortant vers le fournisseur sans activation explicite, et un point de terminaison configurable.

## Solution proposée

- `ENABLE_UPDATES` / `TELEMETRY` vaut `false` par défaut.
- Nouvelle variable `UPDATES_URL` pour utiliser un point de terminaison communautaire.

### Alternatives non retenues

Supprimer entièrement la vérification : elle reste utile pour les messages de sécurité.

## Spécification technique

Voir [env.ts](../server/env.ts) et [updates.ts](../server/utils/updates.ts). Appelé depuis [main.ts](../server/main.ts) uniquement en production et si `TELEMETRY` est actif. Données envoyées : `id` (SHA-256 de la clé secrète tronquée et de l'URL), version, quatre compteurs.

Reste à faire (itérations suivantes) : centraliser les URLs du fournisseur ([UrlHelper.ts](../shared/utils/UrlHelper.ts)), revoir `isCloudHosted`, empaquetage et gouvernance.

## Instructions de déploiement

- [ ] Si la vérification est souhaitée, définir `ENABLE_UPDATES=true` (et éventuellement `UPDATES_URL`).
- [ ] Mettre à jour les déploiements Heroku utilisant `app.json`.
