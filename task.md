# Task List - YouStream

## Context

Brainstorming initial pour la création d'une nouvelle application nommée "YouStream".

## Current Focus

Implémentation d'un système de gestion de compte (Cookie Import) et amélioration de la Sidebar.

## Master Plan

- [x] Brainstorming initial avec l'utilisateur
- [x] Création du Product Brief
- [x] Définition de l'architecture technique (gestion sans pub)
- [x] Initialisation technique (Vite + Docker)
- [ ] Conception du design (UI interactive)
- [x] Implémentation du MVP 1 (Services & Flux)
- [x] Tests et Déploiement
  - [x] Test local via Docker
  - [x] Initialisation Git et Commit
  - [x] Push sur le dépôt distant
- [x] Améliorer la qualité vidéo (Support HLS)
    - [x] Analyser les formats disponibles via Invidious
    - [x] Intégrer hls.js pour le streaming adaptatif
    - [x] Prioriser les flux HLS dans `invidiousService.js`
    - [x] Vérifier la configuration proxy Nginx pour les segments HLS
    - [x] Valider le chargement des hautes résolutions (720p/1080p)
- [x] fonctionnalités avancées
  - [x] Gestion des abonnements (S'abonner/Se désabonner)
  - [x] Vue détaillée d'une chaîne
  - [x] Liste des abonnements dans la sidebar
  - [x] Synchronisation Rapide (Magic Button)
  - [ ] Débogage des erreurs persistantes 500 et 403
    - [/] Analyser la configuration Invidious et les logs du compagnon
    - [x] Mettre à jour l'image Invidious vers `quay.io/invidious/invidious:master`.
- [x] Supprimer `INVIDIOUS_VISITOR_DATA` et configurer le client (`WEB`, `ANDROID`, puis `IOS` pour stabilité).
- [x] Vérifier la résolution des erreurs 500 sur les vidéos de chaînes (fixé via client `IOS`).
- [x] Vérifier la résolution des erreurs 403 sur la lecture vidéo (via `pot` tokens).
- [/] Valider l'intégration HLS et le fallback MP4 dans l'UI.

## Progress Log

- 2026-01-13: Implémentation du Magic Button pour la synchronisation automatique en un clic. Docker et Git totalement synchronisés.
