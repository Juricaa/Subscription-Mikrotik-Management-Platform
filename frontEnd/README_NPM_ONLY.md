# Lancement avec npm uniquement

Ce projet est configuré pour fonctionner avec npm uniquement.

## Nettoyer les restes de pnpm

Si tu as déjà lancé pnpm dans ce dossier, supprime ses fichiers et `node_modules` :

```bat
cd "C:\Users\user\Desktop\project_clean_npm_only"
rmdir /s /q node_modules
del /q pnpm-lock.yaml 2>nul
del /q pnpm-workspace.yaml 2>nul
```

## Installer et lancer

```bat
npm cache verify
npm install --no-audit --no-fund
npm run dev
```

Puis ouvrir :

```text
http://localhost:5173
```

## Si npm affiche encore `Exit handler never called!`

Cette erreur vient de npm/Node installé sur Windows, pas du projet.

Solution recommandée :

1. Désinstaller Node.js depuis Windows.
2. Supprimer si besoin :
   - `C:\Program Files\nodejs`
   - `C:\Users\user\AppData\Roaming\npm`
   - `C:\Users\user\AppData\Roaming\npm-cache`
3. Installer Node.js LTS.
4. Ouvrir un nouveau terminal.
5. Relancer :

```bat
node -v
npm -v
npm install --no-audit --no-fund
npm run dev
```

## Docker sans pnpm

Les fichiers Docker utilisent aussi npm, pas pnpm.

Production :

```bat
docker compose up --build
```

Développement :

```bat
docker compose -f docker-compose.dev.yml up --build
```
