@echo off
rem ====================================================================
rem  BiDash - lokale kopie van de CDMS-logmappen (DRIP uit map lezen)
rem
rem  Wat doet dit script?
rem  Het kopieert de mappen cdms\<vc>\log van de netwerkschijf naar je
rem  eigen computer met robocopy (zit standaard in Windows). De eerste
rem  keer gaat alles mee, daarna alleen nieuwe of gewijzigde bestanden.
rem  Er wordt nooit iets verwijderd, niet op de X-schijf en niet lokaal.
rem
rem  Daarna in BiDash: Data en export, DRIP uit map lezen (CDMS), en kies
rem  de lokale map (standaard C:\BiDash). Dat leest veel sneller.
rem
rem  Aanpassen? Wijzig hieronder BRON, DOEL of DAGEN (met Kladblok).
rem ====================================================================
setlocal EnableExtensions

rem Map op de netwerkschijf: de cdms-map, of de map waar cdms in staat.
set "BRON=X:\cdms"
rem Lokale map voor de kopie.
set "DOEL=C:\BiDash\cdms"
rem Alleen bestanden van de laatste zoveel dagen (0 = alles).
set "DAGEN=400"

title BiDash - CDMS-logs kopieren
if exist "%BRON%\cdms\" set "BRON=%BRON%\cdms"
if exist "%BRON%\" goto bron_ok
echo De map %BRON% is niet gevonden.
set /p "BRON=Typ het pad naar de cdms-map (bijvoorbeeld X:\data\cdms): "
if exist "%BRON%\cdms\" set "BRON=%BRON%\cdms"
if exist "%BRON%\" goto bron_ok
echo Ook die map is niet gevonden. Er is niets gekopieerd.
pause
exit /b 1

:bron_ok
if not exist "%DOEL%\" mkdir "%DOEL%" 2>nul
if not exist "%DOEL%\" set "DOEL=%USERPROFILE%\BiDash\cdms"
if not exist "%DOEL%\" mkdir "%DOEL%" 2>nul
if not exist "%DOEL%\" (
  echo De lokale map %DOEL% kon niet worden gemaakt.
  pause
  exit /b 1
)

set "LEEFTIJD="
if not "%DAGEN%"=="0" set "LEEFTIJD=/MAXAGE:%DAGEN%"
set "FOUTEN=0"
set "AANTAL=0"
echo Van:  %BRON%
echo Naar: %DOEL%
echo.
for /d %%V in ("%BRON%\*") do if exist "%%V\log\" call :kopieer "%%V" "%%~nxV"
echo.
if "%AANTAL%"=="0" (
  echo In %BRON% staan geen mappen met een log-map. Klopt de bronmap?
  pause
  exit /b 1
)
if not "%FOUTEN%"=="0" (
  echo Klaar, maar bij %FOUTEN% regio's ging iets mis. Zie de meldingen hierboven.
) else (
  echo Klaar. %AANTAL% regio's bijgewerkt.
)
echo Kies in BiDash bij DRIP uit map lezen de map %DOEL%
echo en gebruik de knop Vanaf laatst geladen datum.
pause
exit /b 0

:kopieer
set /a AANTAL+=1
echo Bezig met %~2 ...
robocopy "%~1\log" "%DOEL%\%~2\log" /E /XO /FFT /MT:16 /R:2 /W:5 /NP /NFL /NDL /NJH %LEEFTIJD%
if errorlevel 8 (
  set /a FOUTEN+=1
  echo   Let op: niet alle bestanden van %~2 zijn gekopieerd.
)
exit /b 0
