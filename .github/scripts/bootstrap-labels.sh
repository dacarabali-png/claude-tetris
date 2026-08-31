#!/usr/bin/env bash
# Crea (o actualiza) las etiquetas del proyecto usadas por el triage automático
# de issues (.github/workflows/claude-issue-triage.yml).
#
# Uso: bash .github/scripts/bootstrap-labels.sh
# Requiere: GitHub CLI (`gh`) autenticado con permiso para administrar el repo.
#
# Es idempotente: `gh label create --force` crea la etiqueta si no existe, o
# actualiza su color/descripción si ya existe. Las etiquetas por defecto de
# GitHub (bug, enhancement, documentation, question, etc.) no se tocan aquí.

set -euo pipefail

create_label() {
  local name="$1" color="$2" description="$3"
  echo "Label: $name"
  gh label create "$name" --color "$color" --description "$description" --force
}

# tipo/área
create_label "area:gameplay"  "1d76db" "Lógica de juego: colisiones, rotación, wall kicks, gravedad"
create_label "area:rendering" "5319e7" "Dibujo en canvas, colores, ghost piece, vista previa"
create_label "area:ui"        "c2e0c6" "HUD, overlays, CSS, layout"
create_label "area:controls"  "fbca04" "Teclado, input, pausa"
create_label "area:scoring"   "bfd4f2" "Puntaje, líneas, niveles, velocidad de caída"
create_label "area:build"     "d4c5f9" "Workflows, tooling, configuración del repo"

# prioridad
create_label "prioridad:alta"  "b60205" "Bloquea el juego o afecta a todos los usuarios"
create_label "prioridad:media" "fbca04" "Afecta la experiencia pero tiene solución alterna"
create_label "prioridad:baja"  "0e8a16" "Cosmético o de bajo impacto"

# estado
create_label "needs-info" "d876e3" "Falta información para poder diagnosticar el issue"

echo "Listo. Etiquetas actuales:"
gh label list
