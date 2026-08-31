---
description: Consulta el clima actual de una ciudad (o el de tu ubicación por IP) usando datos reales desde la terminal, sin API key.
argument-hint: [ciudad opcional]
---

Quiero que consultes el clima actual y me lo muestres en español, de forma clara y breve.

Argumento recibido del usuario (puede venir vacío): $ARGUMENTS

## Pasos

1. Determina la ubicación:
   - Si `$ARGUMENTS` no está vacío, usa ese texto como ciudad (reemplaza espacios por `+` si es necesario para la URL).
   - Si está vacío, deja la ubicación en blanco para que el servicio la detecte automáticamente por IP.

2. Ejecuta la consulta con la herramienta Bash (no PowerShell) usando `curl`, que ya viene disponible:

   ```
   curl -s "wttr.in/<CIUDAD_O_VACIO>?lang=es&format=%l:+%C+%t+(sensación+%f)+%h+humedad+viento+%w"
   ```

   - `<CIUDAD_O_VACIO>` es la ciudad codificada para URL, o nada si no se especificó ciudad.
   - Si el comando falla o no hay conexión a internet, informa al usuario claramente que no se pudo obtener el clima y sugiere revisar la conexión — no inventes datos.

3. Con la respuesta cruda, preséntala al usuario en un formato legible en español, por ejemplo:

   ```
   📍 Ciudad: <ciudad>
   🌡️  Temperatura: <temp> (sensación <sensación>)
   ☁️  Condición: <condición>
   💧 Humedad: <humedad>
   💨 Viento: <viento>
   ```

   Si algún dato no vino en la respuesta, omite esa línea en vez de mostrar valores vacíos o inventados.

4. No guardes ni envíes esta información a ningún otro servicio; es solo para mostrarla en la conversación.
