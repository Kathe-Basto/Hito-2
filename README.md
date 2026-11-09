# EstadiApp · MotoExpres S.A.S.

**EstadiApp es una aplicación web desarrollada para MotoExpres S.A.S.** 
Nuestra app orientada a la validación de datos del esquema oficial de 21 columnas y al análisis probabilístico e inferencial (Módulos M1 a M3).

## README de la integrante:
**Katherin Basto** 

## Integrantes del Equipo

**Katherin Basto** 
**Laura Valentina Torres Castiblanco** 

## Requisitos e Instalacion

Al ser una aplicación web de un solo archivo independiente que consume librerías desde CDN (**PapaParse para CSV y SheetJS / XLSX para Excel**), 
no requiere instalación de dependencias ni servidores backend.

## Prerrequisitos
Para abrir nuestra app se necesita un navegador web moderno, el recomendado en este caso Google Chrome o Microsoft Edge

## Pasos de Instalacion
1. Clona o descarga este repositorio en tu equipo local:
   ```bash
   git clone [https://github.com/Kathe-Basto/Hito-2.git](https://github.com/Kathe-Basto/Hito-2.git)

2. O simplemente descarga el archivo ZIP del repositorio y extráelo en una carpeta.


## Como Ejecutar la Aplicación

Existen dos maneras sencillas de ejecutar la aplicación:

## Opción A: Ejecución Directa (Recomendada)
1. Navega a la carpeta del proyecto.
2. Haz doble clic sobre el archivo `index.html` (o ábrelo directamente en tu navegador de preferencia).

## Opción B: Mediante Servidor Local (Live Server)
1. Abre la carpeta del proyecto en **Visual Studio Code**.
2. Haz clic derecho sobre el archivo `index.html` y selecciona **Open with Live Server** (requiere la extensión *Live Server*).

## Uso de la Aplicación

1. Módulo M1 (Cargar datos): Carga un archivo en formato `.csv` o `.xlsx` (hoja `datos`) que cumpla con el esquema oficial de 21 columnas de MotoExpres S.A.S. 
(ejemplo `MotoExpres_P1_Anual_2025.csv`, `MotoExpres_P4_Piloto_Magdalena.csv`).
2. Módulo M2 (Análisis descriptivo): Explora las estadísticas descriptivas, histogramas, diagramas de caja y resumen por sede o mecánico.
3. Módulo M3 (Probabilidad y Bayes): Visualiza las probabilidades básicas, la tabla de contingencia por mecánico, el análisis del Teorema de Bayes para el mecánico de mayor tasa de garantía y las pruebas de independencia con el umbral de $|\Delta| < 0.02$.