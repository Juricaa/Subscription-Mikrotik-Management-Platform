# Notes de refactorisation

## Changements principaux

- Réorganisation de la structure active :
  - `src/config/navigation.ts` pour la configuration du menu.
  - `src/components/layout/` pour `Sidebar`, `Topbar` et `Toast`.
  - `src/components/ui/` pour les composants réutilisables : `Card`, `Button`, `Input`, `Select`, `Modal`, `TableCard`, `Badge`, `FilterTabs`, etc.
  - `src/pages/` conserve les vues métier : Dashboard, abonnements, clients connectés, logs, routeur et paramètres.
- Déplacement des anciens composants Figma/shadcn non utilisés vers `legacy/figma/components` afin de ne plus surcharger le CSS généré par Tailwind.
- Amélioration responsive : grilles adaptatives, tables avec scroll horizontal, formulaires en 1 colonne sur mobile et 2/3 colonnes sur grands écrans.
- Nouveau style moderne : cartes arrondies, surfaces glass/light, ombres douces, radius plus généreux, topbar sticky et sidebar mobile.
- Animations simples et légères : entrée de page, entrée de cartes/lignes, modal/toast, hover lift discret. Elles respectent `prefers-reduced-motion`.
- Optimisation de chargement : pages chargées avec `React.lazy` + `Suspense`, ce qui évite de charger tout le dashboard/Recharts dès l’ouverture.

## Validation

Commande testée avec succès :

```bash
npm run build
```

Build généré sans erreur. Le CSS final est passé d’environ 107 kB à environ 41 kB après isolation des composants legacy hors de `src`.

## Lancer le projet

```bash
npm install
npm run dev
```
