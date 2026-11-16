"""Gera um ZIP limpo e independente do caminho absoluto da máquina."""
import hashlib
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist'/'LABIELOS-APRESENTACAO-Windows-x64.zip'
if not (ROOT/'.runtime/python/python.exe').is_file():
    raise SystemExit('Prepare .runtime/python antes de gerar o pacote.')
OUT.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(OUT,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for directory in ('html','css','js','content','backend','scripts','tests','.runtime/python'):
        for path in (ROOT/directory).rglob('*'):
            if path.is_file() and '__pycache__' not in path.parts and path.suffix!='.pyc':
                archive.write(path,Path('LABIELOS')/path.relative_to(ROOT))
    for name in ('index.html','run.py','INICIAR.bat','README.md'):
        archive.write(ROOT/name,Path('LABIELOS')/name)
    for name in ('apresentacao.md','variante-sqlite-local.md'):
        archive.write(ROOT/'docs'/name,Path('LABIELOS')/'docs'/name)
    archive.writestr('LABIELOS/data/.keep','O SQLite é criado automaticamente no primeiro início.\n')
digest=hashlib.sha256(OUT.read_bytes()).hexdigest()
OUT.with_suffix('.zip.sha256').write_text(digest+'  '+OUT.name+'\n')
print(f'Pacote: {OUT}\nTamanho: {OUT.stat().st_size/1024/1024:.1f} MB\nSHA256: {digest}')
