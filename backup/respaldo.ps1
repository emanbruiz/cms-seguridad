<#
Respaldo y prueba de restauracion de MongoDB (servicio mongo del docker-compose).

Uso, desde la raiz del repositorio:
  powershell -ExecutionPolicy Bypass -File .\backup\respaldo.ps1 -Accion respaldar
  powershell -ExecutionPolicy Bypass -File .\backup\respaldo.ps1 -Accion probar

respaldar: genera un archivo comprimido en .\backups\ (cms-AAAAMMDD-HHmm.gz).
probar:    toma el respaldo mas reciente, lo restaura en bases temporales (nombre_restore),
           compara la cantidad de documentos con las originales y borra las temporales.
           El resultado queda en docs\evidencias\respaldo-restauracion.txt.

Las credenciales no salen del contenedor: se usan sus variables MONGO_INITDB_ROOT_*.
El respaldo contiene hashes y semillas MFA cifradas: la carpeta backups\ no se sube a Git.
#>
param(
  [ValidateSet('respaldar', 'probar')][string]$Accion = 'respaldar',
  [string]$Archivo = ''
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$tmp = Join-Path $env:TEMP 'cms-respaldo'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$dest = Join-Path (Get-Location) 'backups'
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$shRespaldo = @'
#!/bin/sh
set -e
exec 2>&1
mongodump --archive=/tmp/respaldo.gz --gzip -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin
ls -l /tmp/respaldo.gz
'@

$shRestaurar = @'
#!/bin/sh
set -e
exec 2>&1
mongorestore --archive=/tmp/restaurar.gz --gzip -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --nsExclude 'admin.*' --nsExclude 'config.*' --nsFrom '$db$.$collection$' --nsTo '$db$_restore.$collection$'
mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --quiet /tmp/comparar.js
'@

$jsComparar = @'
const nombres = db.adminCommand({ listDatabases: 1 }).databases.map((d) => d.name);
const temporales = nombres.filter((n) => n.endsWith('_restore'));
if (temporales.length === 0) print('No se encontraron bases restauradas');
for (const temporal of temporales) {
  const original = temporal.replace(/_restore$/, '');
  for (const coleccion of db.getSiblingDB(temporal).getCollectionNames()) {
    const a = db.getSiblingDB(original).getCollection(coleccion).countDocuments();
    const b = db.getSiblingDB(temporal).getCollection(coleccion).countDocuments();
    print(original + '.' + coleccion + ': original ' + a + ', restaurado ' + b + (a === b ? ', OK' : ', DIFERENTE (puede ser por eventos nuevos)'));
  }
  db.getSiblingDB(temporal).dropDatabase();
}
print('Bases temporales eliminadas');
'@

function Write-Lf($ruta, $texto) {
  [System.IO.File]::WriteAllText($ruta, $texto.Replace("`r`n", "`n"), $utf8)
}

function Invoke-Docker {
  $ErrorActionPreference = 'Continue'
  & docker @args
  if ($LASTEXITCODE -ne 0) { throw "docker $($args -join ' ') fallo con codigo $LASTEXITCODE" }
}

if ($Accion -eq 'respaldar') {
  Write-Lf (Join-Path $tmp 'respaldo.sh') $shRespaldo
  Invoke-Docker compose cp (Join-Path $tmp 'respaldo.sh') mongo:/tmp/respaldo.sh
  Invoke-Docker compose exec -T mongo sh /tmp/respaldo.sh
  $salida = Join-Path $dest ('cms-' + (Get-Date -Format 'yyyyMMdd-HHmm') + '.gz')
  Invoke-Docker compose cp mongo:/tmp/respaldo.gz $salida
  Invoke-Docker compose exec -T mongo rm -f /tmp/respaldo.gz /tmp/respaldo.sh
  Write-Host "Respaldo guardado en $salida"
}
else {
  if (-not $Archivo) {
    $ultimo = Get-ChildItem $dest -Filter 'cms-*.gz' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($ultimo) { $Archivo = $ultimo.FullName }
  }
  if (-not $Archivo -or -not (Test-Path $Archivo)) { throw 'No hay un respaldo para probar. Corre primero: -Accion respaldar' }

  $log = 'docs\evidencias\respaldo-restauracion.txt'
  New-Item -ItemType Directory -Force -Path (Split-Path $log -Parent) | Out-Null
  ('Prueba de restauracion ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') + ' con ' + (Split-Path $Archivo -Leaf)) | Out-File -Encoding utf8 $log

  Write-Lf (Join-Path $tmp 'restaurar.sh') $shRestaurar
  Write-Lf (Join-Path $tmp 'comparar.js') $jsComparar
  Invoke-Docker compose cp $Archivo mongo:/tmp/restaurar.gz
  Invoke-Docker compose cp (Join-Path $tmp 'restaurar.sh') mongo:/tmp/restaurar.sh
  Invoke-Docker compose cp (Join-Path $tmp 'comparar.js') mongo:/tmp/comparar.js
  $resultado = Invoke-Docker compose exec -T mongo sh /tmp/restaurar.sh
  $resultado | ForEach-Object { Write-Host $_ }
  Add-Content -Path $log -Value $resultado -Encoding UTF8
  Invoke-Docker compose exec -T mongo rm -f /tmp/restaurar.gz /tmp/restaurar.sh /tmp/comparar.js
  Write-Host "Resultado guardado en $log"
}
