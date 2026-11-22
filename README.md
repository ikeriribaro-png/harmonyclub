# Rangos de fuerza desde Hevy

Web estática inspirada en el sistema de rangos de Symmetry. Subes el CSV que exporta **Hevy** y te devuelve un rango por grupo muscular (Bronce → Plata → Oro → Platino → Diamante → Simétrico → Top 1%), un rango general y un índice de simetría.

Todo se calcula en el navegador: el CSV no sale de tu dispositivo.

> Proyecto de aficionado. No está afiliado a Symmetry ni a Hevy, y los rangos son una estimación, no una medición oficial.

## Publicarlo en GitHub Pages

1. Crea un repositorio nuevo y sube estos archivos a la raíz: `index.html`, `style.css`, `app.js`, `ranks.js` y este `README.md`.
2. En el repositorio ve a **Settings → Pages**.
3. En **Build and deployment**, elige **Deploy from a branch**, rama `main` y carpeta `/ (root)`.
4. Guarda. En uno o dos minutos la web estará en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

Para probarlo en local basta con abrir `index.html` en el navegador.

## Cómo conseguir el CSV

En Hevy: **Perfil → Ajustes → Exportar datos → Exportar entrenamientos**. El archivo se llama `hevy_workouts.csv` y necesita, como mínimo, las columnas `exercise_title`, `weight_kg` y `reps`. Si también trae `start_time` y `set_type`, se usan para filtrar por periodo y descartar series de calentamiento. Las fechas en español (`19 nov 2026, 14:34`) o en inglés funcionan igual.

## Cómo se calcula

1. Se descartan las series de calentamiento y las que tienen más de 30 repeticiones.
2. Para cada ejercicio se toma el mejor 1RM estimado con la fórmula de Epley (las repeticiones se limitan a 12 para no inflar la estimación).
3. Se divide entre tu peso corporal y entre el coeficiente `k` del ejercicio, que indica lo difícil que es respecto al press banca con barra (`k = 1`). El resultado se compara con una curva de percentiles estimados (`ANCHORS` en `ranks.js`) que va de 0 a 100.
4. Cada músculo se puntúa con su **ejercicio guía**: el mejor puntuado entre los que tienen al menos 3 series. Puedes cambiarlo en el desplegable de la tarjeta de detalle.
5. El rango se asigna por percentil estimado:

| Rango | Top | Percentil mínimo |
|---|---|---|
| Bronce | 80% | 0 |
| Plata | 60% | 40 |
| Oro | 40% | 60 |
| Rubí | 30% | 70 |
| Esmeralda | 20% | 80 |
| Diamante | 10% | 90 |
| Maestro | 5% | 95 |
| Top 1% | 1% | 99 |

6. El **rango global** es la media de los músculos con datos. El **índice de simetría** baja cuanto más se separan unos músculos de otros (100 menos 1,5 veces la desviación típica de las puntuaciones). Con 85 o más aparece la insignia "Simétrico".
7. La tarjeta de detalle incluye un **simulador**: cambia la carga y las repeticiones y verás al momento cómo cambian el e1RM, el rango del músculo, el global y la simetría. El botón "Restablecer" vuelve a tu mejor serie real.

Para mujeres, los umbrales se multiplican por 0,62 (tren superior) y 0,8 (tren inferior). Los ejercicios con peso corporal (dominadas) suman tu peso al lastre.

## Limitaciones

- Los coeficientes de máquinas y poleas son aproximados: cada gimnasio y cada marca cargan distinto. Si una máquina te sale siempre demasiado alta o baja, ajusta su `k`.
- Las mancuernas se cuentan por mancuerna, como las registra Hevy.
- Los ejercicios que no están en la tabla se estiman por palabras clave (por ejemplo "curl" → bíceps) o se ignoran. La web te lista los que no ha podido catalogar.
- Hevy no exporta tu peso corporal, así que lo introduces a mano.

## Personalizar

Todo lo ajustable está al principio de `ranks.js`:

- `TIERS`: nombres, colores y percentil de cada rango.
- `ANCHORS`: curva de ratio de fuerza a percentil.
- `EX`: ejercicio → `[músculo, k, usaPesoCorporal]`. Añade tus ejercicios aquí.
- `FEMALE_FACTOR`: factores para mujeres.

## Estructura

```
index.html   Estructura de la página
style.css    Estilos
app.js       Interfaz: figura, lista de músculos, detalle y tabla
ranks.js     Lógica pura: lectura del CSV y cálculo de rangos (funciona también en Node)
```
