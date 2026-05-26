# Docker avec npm uniquement

Cette configuration Docker utilise `npm ci` / `npm run build`, pas pnpm.

# Lancer le projet avec Docker

Cette configuration évite les erreurs npm locales sur Windows : l'installation et le build se font dans un conteneur Linux.

## Mode production recommandé

Depuis le dossier qui contient `package.json` :

```bat
docker compose up --build
```

Puis ouvre :

```text
http://localhost:8080
```

Pour arrêter :

```bat
docker compose down
```

## Mode développement avec Vite

```bat
docker compose -f docker-compose.dev.yml up --build
```

Puis ouvre :

```text
http://localhost:5173
```

## Nettoyer et reconstruire

```bat
docker compose down --volumes
docker compose up --build
```

## Notes

- Tu n'as pas besoin de lancer `npm install` sur Windows.
- Docker utilise Node.js dans Linux, donc l'erreur `Exit handler never called!` de npm Windows ne devrait pas apparaître.
- Le mode production sert l'application avec Nginx.
